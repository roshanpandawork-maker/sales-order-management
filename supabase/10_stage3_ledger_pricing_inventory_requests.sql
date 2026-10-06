-- SalesDesk Stage 3: ledger, pricing, inventory integration, requests and approvals.
alter table public.party_requests
  add column if not exists requested_by uuid references auth.users(id),
  add column if not exists resolved_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_party_requests_party_status on public.party_requests(party_code,status,requested_at desc);
create index if not exists idx_approvals_status_created on public.approvals(status,created_at desc);
create index if not exists idx_notifications_user_read on public.notifications(user_id,read_at,created_at desc);

insert into public.role_permissions(role,permission,allowed) values
('manager','approvals',true),('manager','requests',true),('manager','inventory',true),('manager','dispatch',true),
('accountant','approvals',true),('store','approvals',true)
on conflict(role,permission) do update set allowed=excluded.allowed;

revoke insert,update,delete on table public.party_product_prices from authenticated;
grant select on table public.party_product_prices to authenticated;
revoke insert,update,delete on table public.price_history from authenticated;
grant select on table public.price_history to authenticated;

create or replace function public.set_party_product_price(p_party_code text,p_product_code text,p_rate numeric,p_valid_from date default current_date,p_source text default 'MANUAL',p_note text default null)
returns table(id uuid,rate numeric,valid_from date,valid_to date)
language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_date date:=coalesce(p_valid_from,current_date);
begin
 if not (public.has_permission('sales') or public.has_permission('finance')) then raise exception 'You do not have permission to change selling prices.'; end if;
 if p_rate is null or p_rate<0 then raise exception 'Rate cannot be negative.'; end if;
 if not exists(select 1 from public.parties where code=p_party_code) then raise exception 'Party not found.'; end if;
 if not exists(select 1 from public.products where code=p_product_code) then raise exception 'Product not found.'; end if;
 update public.party_product_prices set valid_to=v_date-1
 where party_code=p_party_code and product_code=p_product_code and valid_from<v_date and (valid_to is null or valid_to>=v_date);
 select pp.id into v_id from public.party_product_prices pp
 where pp.party_code=p_party_code and pp.product_code=p_product_code and pp.valid_from=v_date limit 1 for update;
 if v_id is null then
   insert into public.party_product_prices(party_code,product_code,rate,valid_from,valid_to,source)
   values(p_party_code,p_product_code,round(p_rate,2),v_date,null,coalesce(nullif(trim(p_source),''),'MANUAL'))
   returning public.party_product_prices.id into v_id;
 else
   update public.party_product_prices set rate=round(p_rate,2),valid_to=null,source=coalesce(nullif(trim(p_source),''),'MANUAL')
   where public.party_product_prices.id=v_id;
 end if;
 insert into public.price_history(product_code,party_code,rate,gst_rate,effective_from,source,note)
 select p_product_code,p_party_code,round(p_rate,2),coalesce(p.gst_rate,0),v_date::timestamptz,
        coalesce(nullif(trim(p_source),''),'MANUAL'),p_note from public.products p where p.code=p_product_code;
 return query select pp.id,pp.rate,pp.valid_from,pp.valid_to from public.party_product_prices pp where pp.id=v_id;
end;
$$;
revoke execute on function public.set_party_product_price(text,text,numeric,date,text,text) from public,anon;
grant execute on function public.set_party_product_price(text,text,numeric,date,text,text) to authenticated;

drop view if exists public.party_ledger;
create view public.party_ledger with(security_invoker=true) as
with tx as (
 select i.party_code,i.invoice_date transaction_date,1 sort_order,i.created_at,i.id::text entity_id,
 'INVOICE'::text transaction_type,i.invoice_no reference_no,coalesce(i.so_no,'') source_ref,
 coalesce(i.notes,'GST invoice') description,round(i.grand_total,2)::numeric(18,2) debit,0::numeric(18,2) credit
 from public.invoices i where i.status<>'CANCELLED'
 union all
 select p.party_code,coalesce(p.payment_date,p.transaction_date,current_date),2,p.created_at,p.id::text,
 'RECEIPT'::text,p.receipt_no,coalesce(p.invoice_no,''),
 coalesce(nullif(p.remarks,''),nullif(p.notes,''),'Customer payment'),0::numeric(18,2),round(p.amount,2)::numeric(18,2)
 from public.payments p where coalesce(p.status,'')<>'CANCELLED'
)
select t.*,sum(t.debit-t.credit) over(partition by t.party_code order by t.transaction_date,t.sort_order,t.created_at,t.entity_id rows between unbounded preceding and current row)::numeric(18,2) running_balance
from tx t;
revoke all on public.party_ledger from anon;
grant select on public.party_ledger to authenticated;

drop view if exists public.party_receivable_summary;
create view public.party_receivable_summary with(security_invoker=true) as
with inv as(select party_code,sum(grand_total)::numeric(18,2) invoiced from public.invoices where status<>'CANCELLED' group by party_code),
alloc as(select i.party_code,sum(pa.amount)::numeric(18,2) allocated from public.payment_allocations pa join public.invoices i on i.id=pa.invoice_id where i.status<>'CANCELLED' group by i.party_code),
pay as(select party_code,sum(amount)::numeric(18,2) received from public.payments where coalesce(status,'')<>'CANCELLED' group by party_code)
select p.code party_code,p.name party_name,coalesce(inv.invoiced,0)::numeric(18,2) invoiced_amount,
coalesce(alloc.allocated,0)::numeric(18,2) allocated_amount,
greatest(coalesce(inv.invoiced,0)-coalesce(alloc.allocated,0),0)::numeric(18,2) outstanding_amount,
greatest(coalesce(pay.received,0)-coalesce(alloc.allocated,0),0)::numeric(18,2) unallocated_receipt_amount
from public.parties p left join inv on inv.party_code=p.code left join alloc on alloc.party_code=p.code left join pay on pay.party_code=p.code;
revoke all on public.party_receivable_summary from anon;
grant select on public.party_receivable_summary to authenticated;

create or replace function public.sync_sales_inventory()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if tg_op='DELETE' then
   delete from public.inventory_movements where reference_type='DISPATCH' and reference_id=old.id; return old;
 end if;
 if tg_op='UPDATE' then
   delete from public.inventory_movements where reference_type='DISPATCH' and reference_id=old.id;
 end if;
 if coalesce(new.qty,0)>0 then
   insert into public.inventory_movements(movement_date,product_code,movement_type,quantity,unit,reference_type,reference_id,remarks)
   values(coalesce(nullif(new.date,'')::date,current_date),new."productCode",'OUT',abs(new.qty),coalesce(new.qty_type,'QTL'),'DISPATCH',new.id,coalesce(new.remarks,'Sales dispatch'));
 end if;
 return new;
end;
$$;
revoke execute on function public.sync_sales_inventory() from public,anon,authenticated;
drop trigger if exists trg_sales_inventory on public.sales;
create trigger trg_sales_inventory after insert or update or delete on public.sales for each row execute function public.sync_sales_inventory();

insert into public.inventory_movements(movement_date,product_code,movement_type,quantity,unit,reference_type,reference_id,remarks)
select coalesce(nullif(s.date,'')::date,current_date),s."productCode",'OUT',abs(s.qty),coalesce(s.qty_type,'QTL'),'DISPATCH',s.id,coalesce(s.remarks,'Sales dispatch (backfill)')
from public.sales s where coalesce(s.qty,0)>0
and not exists(select 1 from public.inventory_movements m where m.reference_type='DISPATCH' and m.reference_id=s.id);

drop view if exists public.inventory_balances;
create view public.inventory_balances with(security_invoker=true) as
select p.code product_code,p.name product_name,p.unit,
coalesce(sum(case when upper(m.movement_type) in('IN','PURCHASE','OPENING','PRODUCTION') then abs(m.quantity) else -abs(m.quantity) end),0)::numeric(18,3) stock_balance,
count(m.id)::bigint movement_count
from public.products p left join public.inventory_movements m on m.product_code=p.code group by p.code,p.name,p.unit;
revoke all on public.inventory_balances from anon;
grant select on public.inventory_balances to authenticated;

drop view if exists public.inventory_ledger;
create view public.inventory_ledger with(security_invoker=true) as
select m.id,m.movement_date,m.product_code,p.name product_name,m.movement_type,m.quantity,m.unit,m.reference_type,m.reference_id,m.remarks,m.created_at,
case when upper(m.movement_type) in('IN','PURCHASE','OPENING','PRODUCTION') then abs(m.quantity) else -abs(m.quantity) end::numeric(18,3) signed_quantity
from public.inventory_movements m left join public.products p on p.code=m.product_code;
revoke all on public.inventory_ledger from anon;
grant select on public.inventory_ledger to authenticated;

revoke insert,update,delete on table public.party_requests from authenticated;
grant select on table public.party_requests to authenticated;

create or replace function public.create_party_request(p_party_code text,p_request_type text,p_product_code text default null,p_quantity numeric default null,p_message text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_uid uuid:=auth.uid();
begin
 if not(public.has_permission('requests') or public.has_permission('sales')) then raise exception 'You do not have permission to create customer requests.'; end if;
 if p_request_type not in('PRODUCT','PRICE','DISPATCH','BALANCE','OTHER') then raise exception 'Invalid request type.'; end if;
 if p_party_code is not null and not exists(select 1 from public.parties where code=p_party_code) then raise exception 'Party not found.'; end if;
 if p_product_code is not null and not exists(select 1 from public.products where code=p_product_code) then raise exception 'Product not found.'; end if;
 insert into public.party_requests(party_code,request_type,product_code,quantity,message,status,requested_by)
 values(p_party_code,p_request_type,p_product_code,p_quantity,p_message,'OPEN',v_uid) returning id into v_id;
 insert into public.notifications(user_id,type,title,message,entity_type,entity_id)
 select au.user_id,'CUSTOMER_REQUEST','New customer request',coalesce(p_request_type,'OTHER')||' request received for party '||coalesce(p_party_code,'Unknown'),'PARTY_REQUEST',v_id::text
 from public.app_users au where au.role in('admin','manager');
 return v_id;
end;
$$;
revoke execute on function public.create_party_request(text,text,text,numeric,text) from public,anon;
grant execute on function public.create_party_request(text,text,text,numeric,text) to authenticated;

create or replace function public.set_party_request_status(p_request_id uuid,p_status text,p_message text default null)
returns public.party_requests language plpgsql security definer set search_path=''
as $$
declare v_row public.party_requests%rowtype;
begin
 if not public.has_permission('requests') then raise exception 'You do not have permission to update requests.'; end if;
 if p_status not in('OPEN','IN_PROGRESS','DONE','REJECTED') then raise exception 'Invalid request status.'; end if;
 update public.party_requests set status=p_status,message=coalesce(p_message,message),
 resolved_at=case when p_status in('DONE','REJECTED') then now() else null end,
 resolved_by=case when p_status in('DONE','REJECTED') then auth.uid() else null end,updated_at=now()
 where id=p_request_id returning * into v_row;
 if not found then raise exception 'Request not found.'; end if;
 if v_row.requested_by is not null then
   insert into public.notifications(user_id,type,title,message,entity_type,entity_id)
   values(v_row.requested_by,'CUSTOMER_REQUEST_STATUS','Customer request updated','Request '||p_status||' for party '||coalesce(v_row.party_code,'Unknown'),'PARTY_REQUEST',v_row.id::text);
 end if;
 return v_row;
end;
$$;
revoke execute on function public.set_party_request_status(uuid,text,text) from public,anon;
grant execute on function public.set_party_request_status(uuid,text,text) to authenticated;

revoke insert,update,delete on table public.approvals from authenticated;
grant select on table public.approvals to authenticated;

create or replace function public.create_approval(p_entity_type text,p_entity_id text,p_action text,p_reason text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_uid uuid:=auth.uid();
begin
 if not(public.has_permission('sales') or public.has_permission('finance') or public.has_permission('inventory')) then raise exception 'You do not have permission to request approval.'; end if;
 insert into public.approvals(entity_type,entity_id,action,requested_by,status,reason)
 values(trim(p_entity_type),trim(p_entity_id),trim(p_action),v_uid,'PENDING',p_reason) returning id into v_id;
 insert into public.notifications(user_id,type,title,message,entity_type,entity_id)
 select au.user_id,'APPROVAL_REQUEST','Approval required',trim(p_action)||' approval requested for '||trim(p_entity_type)||' '||trim(p_entity_id),trim(p_entity_type),trim(p_entity_id)
 from public.app_users au where au.role in('admin','manager');
 return v_id;
end;
$$;
revoke execute on function public.create_approval(text,text,text,text) from public,anon;
grant execute on function public.create_approval(text,text,text,text) to authenticated;

create or replace function public.decide_approval(p_approval_id uuid,p_status text,p_reason text default null)
returns public.approvals language plpgsql security definer set search_path=''
as $$
declare v_row public.approvals%rowtype;
begin
 if not public.has_permission('approvals') then raise exception 'You do not have approval permission.'; end if;
 if p_status not in('APPROVED','REJECTED') then raise exception 'Approval decision must be APPROVED or REJECTED.'; end if;
 update public.approvals set status=p_status,approved_by=auth.uid(),reason=coalesce(p_reason,reason),decided_at=now()
 where id=p_approval_id and status='PENDING' returning * into v_row;
 if not found then raise exception 'Pending approval not found.'; end if;
 if v_row.requested_by is not null then
   insert into public.notifications(user_id,type,title,message,entity_type,entity_id)
   values(v_row.requested_by,'APPROVAL_DECISION','Approval decision: '||p_status,trim(v_row.action)||' for '||trim(v_row.entity_type)||' '||trim(v_row.entity_id),v_row.entity_type,v_row.entity_id);
 end if;
 return v_row;
end;
$$;
revoke execute on function public.decide_approval(uuid,text,text) from public,anon;
grant execute on function public.decide_approval(uuid,text,text) to authenticated;

drop policy if exists sd_notifications_user on public.notifications;
create policy sd_notifications_user on public.notifications for select to authenticated
using ((select auth.uid())=user_id or (select public.has_permission('admin')));
drop policy if exists sd_notifications_update on public.notifications;
create policy sd_notifications_update on public.notifications for update to authenticated
using ((select auth.uid())=user_id or (select public.has_permission('admin')))
with check ((select auth.uid())=user_id or (select public.has_permission('admin')));