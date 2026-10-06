-- Stage 2 transaction integrity and receivable workflow.
create sequence if not exists public.erp_invoice_no_seq;

create table if not exists public.payment_allocations(
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(18,2) not null check(amount > 0),
  allocated_at timestamptz not null default now(),
  unique(payment_id, invoice_id)
);
create index if not exists idx_payment_alloc_payment on public.payment_allocations(payment_id);
create index if not exists idx_payment_alloc_invoice on public.payment_allocations(invoice_id);
alter table public.payment_allocations enable row level security;
revoke all on table public.payment_allocations from anon;
grant select,insert,update,delete on table public.payment_allocations to authenticated;
drop policy if exists sd_payment_alloc_finance on public.payment_allocations;
create policy sd_payment_alloc_finance on public.payment_allocations
for all to authenticated
using ((select public.has_permission('finance')))
with check ((select public.has_permission('finance')));

create or replace function public.create_invoice_from_dispatch(
  p_sales_ids text[],
  p_invoice_date date default current_date
)
returns table(invoice_id uuid, invoice_no text, party_code text, so_no text, grand_total numeric)
language plpgsql security invoker set search_path=public
as $$
declare
  v_party text; v_so text; v_invoice_id uuid; v_invoice_no text;
  v_subtotal numeric(18,2):=0; v_cgst numeric(18,2):=0; v_sgst numeric(18,2):=0; v_total numeric(18,2):=0;
  r record; v_gst numeric(6,2); v_line_total numeric(18,2); v_taxable numeric(18,2); v_tax numeric(18,2);
begin
  if not (public.has_permission('sales') or public.has_permission('finance')) then raise exception 'You do not have permission to create invoices.'; end if;
  if coalesce(array_length(p_sales_ids,1),0)=0 then raise exception 'At least one dispatch row is required.'; end if;
  select s."partyCode",s.so into v_party,v_so from public.sales s where s.id=any(p_sales_ids) order by s.id limit 1 for update;
  if v_party is null then raise exception 'Dispatch rows not found.'; end if;
  if exists(select 1 from public.sales s where s.id=any(p_sales_ids) and s."partyCode" is distinct from v_party) then raise exception 'All dispatch rows must belong to the same party.'; end if;
  if exists(select 1 from public.sales s where s.id=any(p_sales_ids) and coalesce(nullif(trim(s.invoice_id),''),'')<>'') then raise exception 'One or more selected dispatch rows are already invoiced.'; end if;

  v_invoice_no:='INV-'||lpad(nextval('public.erp_invoice_no_seq')::text,8,'0');
  v_invoice_id:=gen_random_uuid();
  insert into public.invoices(id,invoice_no,party_code,invoice_date,so_no,subtotal,cgst,sgst,igst,round_off,grand_total,status,notes)
  values(v_invoice_id,v_invoice_no,v_party,coalesce(p_invoice_date,current_date),v_so,0,0,0,0,0,0,'ISSUED','Created from dispatch');

  for r in
    select s.*,p.name product_name,p.hsn,p.unit product_unit,coalesce(p.gst_rate,0)::numeric product_gst
    from public.sales s left join public.products p on p.code=s."productCode"
    where s.id=any(p_sales_ids) order by s.id
  loop
    v_gst:=r.product_gst;
    v_line_total:=round(coalesce(r.qty,0)::numeric*coalesce(r.rate,0)::numeric,2);
    v_taxable:=round(v_line_total/(1+v_gst/100),2);
    v_tax:=round(v_line_total-v_taxable,2);
    insert into public.invoice_lines(invoice_id,product_code,description,hsn,unit,quantity,rate,gst_rate,taxable,gst_amount,total)
    values(v_invoice_id,r."productCode",coalesce(r.product_name,r."productCode"),r.hsn,coalesce(r.qty_type,r.product_unit),r.qty,
      case when coalesce(r.qty,0)=0 then 0 else round(v_taxable/r.qty,2) end,v_gst,v_taxable,v_tax,v_line_total);
    v_subtotal:=v_subtotal+v_taxable;
    if v_gst>0 then v_cgst:=v_cgst+round(v_tax/2,2); v_sgst:=v_sgst+(v_tax-round(v_tax/2,2)); end if;
    v_total:=v_total+v_line_total;
  end loop;

  update public.invoices set subtotal=round(v_subtotal,2),cgst=round(v_cgst,2),sgst=round(v_sgst,2),grand_total=round(v_total,2) where id=v_invoice_id;
  update public.sales set invoice_id=v_invoice_id::text,invoice=v_invoice_no where id=any(p_sales_ids);
  return query select v_invoice_id,v_invoice_no,v_party,v_so,round(v_total,2);
end;
$$;
revoke execute on function public.create_invoice_from_dispatch(text[],date) from public,anon;
grant execute on function public.create_invoice_from_dispatch(text[],date) to authenticated;

create or replace function public.allocate_payment(p_payment_id uuid,p_invoice_id uuid,p_amount numeric)
returns table(payment_id uuid,invoice_id uuid,allocated numeric,invoice_paid numeric,invoice_balance numeric,invoice_status text)
language plpgsql security invoker set search_path=public
as $$
declare
  v_payment public.payments%rowtype; v_invoice public.invoices%rowtype;
  v_existing_payment numeric(18,2); v_existing_invoice numeric(18,2); v_new_invoice_paid numeric(18,2); v_status text;
begin
  if not public.has_permission('finance') then raise exception 'You do not have finance permission.'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Allocation amount must be greater than zero.'; end if;
  select * into v_payment from public.payments where id=p_payment_id for update;
  if not found then raise exception 'Payment not found.'; end if;
  select * into v_invoice from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found.'; end if;
  if v_payment.party_code is distinct from v_invoice.party_code then raise exception 'Payment and invoice belong to different parties.'; end if;
  select coalesce(sum(amount),0) into v_existing_payment from public.payment_allocations where payment_id=p_payment_id;
  select coalesce(sum(amount),0) into v_existing_invoice from public.payment_allocations where invoice_id=p_invoice_id;
  if v_existing_payment+p_amount>v_payment.amount+0.005 then raise exception 'Allocation exceeds the unallocated payment amount.'; end if;
  if v_existing_invoice+p_amount>v_invoice.grand_total+0.005 then raise exception 'Allocation exceeds the invoice outstanding amount.'; end if;
  insert into public.payment_allocations(payment_id,invoice_id,amount) values(p_payment_id,p_invoice_id,round(p_amount,2))
    on conflict(payment_id,invoice_id) do update set amount=public.payment_allocations.amount+excluded.amount,allocated_at=now();
  select coalesce(sum(amount),0) into v_new_invoice_paid from public.payment_allocations where invoice_id=p_invoice_id;
  v_status:=case when v_new_invoice_paid>=v_invoice.grand_total-0.005 then 'PAID' when v_new_invoice_paid>0 then 'PART_PAID' else 'ISSUED' end;
  update public.invoices set status=v_status where id=p_invoice_id;
  update public.payments set invoice_id=case when (select count(*) from public.payment_allocations where payment_id=p_payment_id)=1 then p_invoice_id else null end where id=p_payment_id;
  return query select p_payment_id,p_invoice_id,round(p_amount,2),round(v_new_invoice_paid,2),round(v_invoice.grand_total-v_new_invoice_paid,2),v_status;
end;
$$;
revoke execute on function public.allocate_payment(uuid,uuid,numeric) from public,anon;
grant execute on function public.allocate_payment(uuid,uuid,numeric) to authenticated;

create or replace view public.invoice_balances with(security_invoker=true) as
select i.id,i.invoice_no,i.party_code,i.invoice_date,i.so_no,i.grand_total,
  coalesce(sum(pa.amount),0)::numeric(18,2) paid_amount,
  greatest(i.grand_total-coalesce(sum(pa.amount),0),0)::numeric(18,2) balance_amount,
  case when greatest(i.grand_total-coalesce(sum(pa.amount),0),0)<=0.005 then 'PAID'
       when coalesce(sum(pa.amount),0)>0 then 'PART_PAID' else i.status end calculated_status,
  greatest(current_date-i.invoice_date,0) age_days,
  case when greatest(current_date-i.invoice_date,0)<=30 then '0-30'
       when greatest(current_date-i.invoice_date,0)<=60 then '31-60'
       when greatest(current_date-i.invoice_date,0)<=90 then '61-90' else '90+' end ageing_bucket
from public.invoices i left join public.payment_allocations pa on pa.invoice_id=i.id group by i.id;
revoke all on table public.invoice_balances from anon;
grant select on public.invoice_balances to authenticated;
