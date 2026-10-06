-- SalesDesk Stage 3 hardening: privileged implementations live outside the API-exposed public schema.
create schema if not exists private;
grant usage on schema private to authenticated;

alter function public.set_party_product_price(text,text,numeric,date,text,text) set schema private;
alter function public.create_party_request(text,text,text,numeric,text) set schema private;
alter function public.set_party_request_status(uuid,text,text) set schema private;
alter function public.create_approval(text,text,text,text) set schema private;
alter function public.decide_approval(uuid,text,text) set schema private;

revoke all on function private.set_party_product_price(text,text,numeric,date,text,text) from public,anon,authenticated;
revoke all on function private.create_party_request(text,text,text,numeric,text) from public,anon,authenticated;
revoke all on function private.set_party_request_status(uuid,text,text) from public,anon,authenticated;
revoke all on function private.create_approval(text,text,text,text) from public,anon,authenticated;
revoke all on function private.decide_approval(uuid,text,text) from public,anon,authenticated;
grant execute on function private.set_party_product_price(text,text,numeric,date,text,text) to authenticated;
grant execute on function private.create_party_request(text,text,text,numeric,text) to authenticated;
grant execute on function private.set_party_request_status(uuid,text,text) to authenticated;
grant execute on function private.create_approval(text,text,text,text) to authenticated;
grant execute on function private.decide_approval(uuid,text,text) to authenticated;

create or replace function public.set_party_product_price(p_party_code text,p_product_code text,p_rate numeric,p_valid_from date default current_date,p_source text default 'MANUAL',p_note text default null)
returns table(id uuid,rate numeric,valid_from date,valid_to date)
language sql security invoker set search_path=''
as $$ select * from private.set_party_product_price($1,$2,$3,$4,$5,$6) $$;

create or replace function public.create_party_request(p_party_code text,p_request_type text,p_product_code text default null,p_quantity numeric default null,p_message text default null)
returns uuid language sql security invoker set search_path=''
as $$ select private.create_party_request($1,$2,$3,$4,$5) $$;

create or replace function public.set_party_request_status(p_request_id uuid,p_status text,p_message text default null)
returns public.party_requests language sql security invoker set search_path=''
as $$ select * from private.set_party_request_status($1,$2,$3) $$;

create or replace function public.create_approval(p_entity_type text,p_entity_id text,p_action text,p_reason text default null)
returns uuid language sql security invoker set search_path=''
as $$ select private.create_approval($1,$2,$3,$4) $$;

create or replace function public.decide_approval(p_approval_id uuid,p_status text,p_reason text default null)
returns public.approvals language sql security invoker set search_path=''
as $$ select * from private.decide_approval($1,$2,$3) $$;

revoke execute on function public.set_party_product_price(text,text,numeric,date,text,text) from public,anon;
revoke execute on function public.create_party_request(text,text,text,numeric,text) from public,anon;
revoke execute on function public.set_party_request_status(uuid,text,text) from public,anon;
revoke execute on function public.create_approval(text,text,text,text) from public,anon;
revoke execute on function public.decide_approval(uuid,text,text) from public,anon;
grant execute on function public.set_party_product_price(text,text,numeric,date,text,text) to authenticated;
grant execute on function public.create_party_request(text,text,text,numeric,text) to authenticated;
grant execute on function public.set_party_request_status(uuid,text,text) to authenticated;
grant execute on function public.create_approval(text,text,text,text) to authenticated;
grant execute on function public.decide_approval(uuid,text,text) to authenticated;

drop policy if exists sd_notifications on public.notifications;
drop policy if exists sd_notifications_user on public.notifications;
drop policy if exists sd_notifications_update on public.notifications;
create policy sd_notifications_user on public.notifications
for select to authenticated
using ((select auth.uid())=user_id or (select public.has_permission('admin')));
create policy sd_notifications_update on public.notifications
for update to authenticated
using ((select auth.uid())=user_id or (select public.has_permission('admin')))
with check ((select auth.uid())=user_id or (select public.has_permission('admin')));