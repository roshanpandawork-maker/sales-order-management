-- SalesDesk Stage 4: daily customer pricing and quotation workflow.
-- Applied to production Supabase project noldgjtoqhwefqdzdpzs.
create table if not exists public.daily_product_prices(
  id uuid primary key default gen_random_uuid(),
  product_code text not null references public.products(code) on delete cascade,
  rate numeric(18,2) not null check(rate>=0),
  valid_date date not null default current_date,
  source text not null default 'MANUAL',
  note text,
  created_at timestamptz not null default now(),
  unique(product_code,valid_date)
);
create index if not exists idx_daily_product_prices_date on public.daily_product_prices(valid_date desc,product_code);
alter table public.daily_product_prices enable row level security;
drop policy if exists sd_daily_price_select on public.daily_product_prices;
create policy sd_daily_price_select on public.daily_product_prices for select to authenticated using ((select public.has_permission('sales')) or (select public.has_permission('finance')) or (select public.has_permission('admin')));
drop policy if exists sd_daily_price_admin on public.daily_product_prices;
create policy sd_daily_price_admin on public.daily_product_prices for all to authenticated using ((select public.has_permission('admin'))) with check ((select public.has_permission('admin')));

create or replace function public.set_daily_product_price(p_product_code text,p_rate numeric,p_valid_date date default current_date,p_source text default 'MANUAL',p_note text default null)
returns public.daily_product_prices language plpgsql security definer set search_path=public as $$
declare v_row public.daily_product_prices%rowtype; v_date date:=coalesce(p_valid_date,current_date);
begin
 if not(public.has_permission('sales') or public.has_permission('finance')) then raise exception 'You do not have permission to change daily prices.'; end if;
 if p_rate is null or p_rate<0 then raise exception 'Rate cannot be negative.'; end if;
 if not exists(select 1 from public.products where code=p_product_code) then raise exception 'Product not found.'; end if;
 insert into public.daily_product_prices(product_code,rate,valid_date,source,note)
 values(p_product_code,round(p_rate,2),v_date,coalesce(nullif(trim(p_source),''),'MANUAL'),p_note)
 on conflict(product_code,valid_date) do update set rate=excluded.rate,source=excluded.source,note=excluded.note
 returning * into v_row;
 insert into public.price_history(product_code,party_code,rate,gst_rate,effective_from,source,note)
 select p_product_code,null,round(p_rate,2),coalesce(p.gst_rate,0),v_date::timestamptz,coalesce(nullif(trim(p_source),''),'MANUAL'),p_note
 from public.products p where p.code=p_product_code;
 return v_row;
end $$;
revoke execute on function public.set_daily_product_price(text,numeric,date,text,text) from public,anon;
grant execute on function public.set_daily_product_price(text,numeric,date,text,text) to authenticated;

create or replace function public.create_quotation(p_party_code text,p_valid_until date default null,p_remarks text default null,p_status text default 'SENT',p_lines jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_no text; v_line jsonb; v_product text; v_qty numeric; v_rate numeric; v_gst numeric; v_unit text;
begin
 if not(public.has_permission('sales') or public.has_permission('finance')) then raise exception 'You do not have permission to create quotations.'; end if;
 if not exists(select 1 from public.parties where code=p_party_code) then raise exception 'Party not found.'; end if;
 if p_status not in('DRAFT','SENT') then raise exception 'Invalid quotation status.'; end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'Add at least one quotation item.'; end if;
 v_no:='QT-'||to_char(current_date,'YYYYMMDD')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
 insert into public.quotations(quotation_no,party_code,quotation_date,valid_until,status,remarks)
 values(v_no,p_party_code,current_date,p_valid_until,p_status,p_remarks) returning id into v_id;
 for v_line in select * from jsonb_array_elements(p_lines) loop
   v_product:=nullif(trim(v_line->>'product_code'),''); v_qty:=nullif(v_line->>'quantity','')::numeric; v_rate:=nullif(v_line->>'rate','')::numeric; v_gst:=coalesce(nullif(v_line->>'gst_rate','')::numeric,0);
   select unit into v_unit from public.products where code=v_product;
   if v_product is null or v_qty is null or v_qty<=0 or v_rate is null or v_rate<0 then raise exception 'Invalid quotation line.'; end if;
   if not exists(select 1 from public.products where code=v_product) then raise exception 'Product not found: %',v_product; end if;
   insert into public.quotation_lines(quotation_id,product_code,quantity,rate,gst_rate,unit) values(v_id,v_product,v_qty,round(v_rate,2),v_gst,v_unit);
 end loop;
 return v_id;
exception when others then
 if v_id is not null then delete from public.quotations where id=v_id; end if;
 raise;
end $$;
revoke execute on function public.create_quotation(text,date,text,text,jsonb) from public,anon;
grant execute on function public.create_quotation(text,date,text,text,jsonb) to authenticated;

alter table public.party_requests drop constraint if exists party_requests_request_type_check;
alter table public.party_requests add constraint party_requests_request_type_check check(request_type in('PRODUCT','PRICE','DISPATCH','BALANCE','QUOTATION','OTHER'));

create or replace function public.create_customer_quote_request(p_token text,p_product_code text,p_quantity numeric,p_message text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_party text; v_id uuid;
begin
 select party_code into v_party from public.party_public_links where token=p_token and active=true limit 1;
 if v_party is null then return jsonb_build_object('ok',false,'error','Invalid or inactive customer link'); end if;
 if p_quantity is null or p_quantity<=0 then return jsonb_build_object('ok',false,'error','Quantity must be greater than zero'); end if;
 if not exists(select 1 from public.products where code=p_product_code) then return jsonb_build_object('ok',false,'error','Product not found'); end if;
 insert into public.party_requests(party_code,request_type,product_code,quantity,message,status) values(v_party,'QUOTATION',p_product_code,p_quantity,p_message,'OPEN') returning id into v_id;
 return jsonb_build_object('ok',true,'request_id',v_id);
end $$;
revoke execute on function public.create_customer_quote_request(text,text,numeric,text) from public;
grant execute on function public.create_customer_quote_request(text,text,numeric,text) to anon;

create or replace function public.get_party_portal(p_token text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_party_code text; v_party_name text; v_today date:=current_date;
begin
 select l.party_code,p.name into v_party_code,v_party_name from public.party_public_links l join public.parties p on p.code=l.party_code where l.token=p_token and l.active=true limit 1;
 if v_party_code is null then return jsonb_build_object('ok',false,'error','Invalid or inactive customer link'); end if;
 return jsonb_build_object(
  'ok',true,'party_code',v_party_code,'party_name',v_party_name,'date',v_today,
  'prices',coalesce((select jsonb_agg(jsonb_build_object('product_code',p.code,'product_name',p.name,'unit',p.unit,'rate',coalesce(pp.rate,dp.rate,p.rate),'gst_rate',p.gst_rate) order by p.name)
    from public.products p
    left join lateral(select x.rate from public.party_product_prices x where x.party_code=v_party_code and x.product_code=p.code and x.valid_from<=v_today and (x.valid_to is null or x.valid_to>=v_today) order by x.valid_from desc,x.created_at desc limit 1) pp on true
    left join lateral(select x.rate from public.daily_product_prices x where x.product_code=p.code and x.valid_date=v_today limit 1) dp on true),'[]'::jsonb),
  'orders',coalesce((select jsonb_agg(jsonb_build_object('so',o.no,'date',o.date,'due',o.due,'status',o.status,'items',o.lines) order by o.date desc,o.no desc) from public.orders o where o.partyCode=v_party_code and coalesce(o.status,'')<>'Cancelled'),'[]'::jsonb),
  'quotations',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'quotation_no',q.quotation_no,'date',q.quotation_date,'valid_until',q.valid_until,'status',q.status,'remarks',q.remarks,'lines',(select coalesce(jsonb_agg(jsonb_build_object('product_code',ql.product_code,'quantity',ql.quantity,'rate',ql.rate,'gst_rate',ql.gst_rate,'unit',ql.unit) order by ql.id),'[]'::jsonb) from public.quotation_lines ql where ql.quotation_id=q.id)) order by q.quotation_date desc) from public.quotations q where q.party_code=v_party_code),'[]'::jsonb)
 );
end $$;
revoke execute on function public.get_party_portal(text) from public;
grant execute on function public.get_party_portal(text) to anon;

create or replace function public.get_party_portal_by_slug(p_slug text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_token text; v_data jsonb;
begin
 select token into v_token from public.party_public_links where public_slug=p_slug and active=true limit 1;
 if v_token is null then return jsonb_build_object('ok',false,'error','Invalid or inactive customer link'); end if;
 v_data:=public.get_party_portal(v_token);
 return v_data || jsonb_build_object('balances',coalesce((select jsonb_agg(jsonb_build_object('party_code',x.party_code,'party_name',x.party_name,'product_code',x.product_code,'product_name',x.product_name,'unit',x.unit,'rate',x.rate,'ordered',x.ordered,'dispatched',x.dispatched,'balance',x.balance) order by x.product_name) from public.get_party_live_balance_by_slug(p_slug) x),'[]'::jsonb));
end $$;
revoke execute on function public.get_party_portal_by_slug(text) from public;
grant execute on function public.get_party_portal_by_slug(text) to anon;


create or replace function public.create_customer_quote_request_by_slug(p_slug text,p_product_code text,p_quantity numeric,p_message text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_token text;
begin
 select token into v_token from public.party_public_links where public_slug=p_slug and active=true limit 1;
 if v_token is null then return jsonb_build_object('ok',false,'error','Invalid or inactive customer link'); end if;
 return public.create_customer_quote_request(v_token,p_product_code,p_quantity,p_message);
end $$;
revoke execute on function public.create_customer_quote_request_by_slug(text,text,numeric,text) from public;
grant execute on function public.create_customer_quote_request_by_slug(text,text,numeric,text) to anon;
