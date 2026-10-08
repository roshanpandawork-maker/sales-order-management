-- SalesDesk admin role management. Run after migrations 01-14.
-- These functions keep app_users private and require an authenticated admin.
create or replace function public.admin_get_role_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.my_role() is distinct from 'admin' then
    raise exception 'Only admins can manage roles.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'users', coalesce((select jsonb_agg(jsonb_build_object('user_id',u.user_id,'email',u.email,'role',u.role) order by u.email)
      from public.app_users u), '[]'::jsonb),
    'permissions', coalesce((select jsonb_agg(jsonb_build_object('role',rp.role,'permission',rp.permission,'allowed',rp.allowed))
      from public.role_permissions rp where rp.role in ('manager','accounts','store','staff')), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_set_user_role(p_email text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid; v_email text; v_old_role text;
begin
  if public.my_role() is distinct from 'admin' then
    raise exception 'Only admins can assign roles.' using errcode = '42501';
  end if;
  if p_role not in ('admin','manager','accounts','store','staff') then
    raise exception 'Choose one of the supported roles.';
  end if;
  if p_email is null or length(trim(p_email))=0 then raise exception 'Email is required.'; end if;
  select id,email into v_user_id,v_email from auth.users where lower(email)=lower(trim(p_email)) limit 1;
  if v_user_id is null then raise exception 'No Supabase account has that email. Create the account first.'; end if;
  select role into v_old_role from public.app_users where user_id=v_user_id;
  if v_old_role='admin' and p_role<>'admin'
     and (select count(*) from public.app_users where role='admin')<=1 then
    raise exception 'Keep at least one admin account.';
  end if;
  insert into public.app_users(user_id,email,role) values(v_user_id,v_email,p_role)
  on conflict(user_id) do update set email=excluded.email,role=excluded.role;
  insert into public.audit_log(user_id,table_name,action,row_data)
    values(auth.uid(),'app_users','ROLE_ASSIGNMENT',jsonb_build_object('email',v_email,'previous_role',v_old_role,'role',p_role));
  return jsonb_build_object('email',v_email,'role',p_role);
end;
$$;

create or replace function public.admin_set_role_permission(p_role text,p_permission text,p_allowed boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.my_role() is distinct from 'admin' then
    raise exception 'Only admins can change permissions.' using errcode = '42501';
  end if;
  if p_role not in ('manager','accounts','store','staff') then raise exception 'This role cannot be edited here.'; end if;
  if p_permission not in ('sales','customers','finance','reports','inventory','dispatch','purchases','requests','approvals') then
    raise exception 'Unsupported permission.';
  end if;
  insert into public.role_permissions(role,permission,allowed) values(p_role,p_permission,coalesce(p_allowed,false))
  on conflict(role,permission) do update set allowed=excluded.allowed;
  insert into public.audit_log(user_id,table_name,action,row_data)
    values(auth.uid(),'role_permissions','PERMISSION_CHANGE',jsonb_build_object('role',p_role,'permission',p_permission,'allowed',coalesce(p_allowed,false)));
  return jsonb_build_object('role',p_role,'permission',p_permission,'allowed',coalesce(p_allowed,false));
end;
$$;

revoke all on function public.admin_get_role_data() from public,anon;
revoke all on function public.admin_set_user_role(text,text) from public,anon;
revoke all on function public.admin_set_role_permission(text,text,boolean) from public,anon;
grant execute on function public.admin_get_role_data() to authenticated;
grant execute on function public.admin_set_user_role(text,text) to authenticated;
grant execute on function public.admin_set_role_permission(text,text,boolean) to authenticated;

-- Seed the actual roles accepted by app_users_role_check. Payroll remains admin-only.
insert into public.role_permissions(role,permission,allowed) values
 ('manager','sales',true),('manager','customers',true),('manager','finance',true),('manager','reports',true),
 ('manager','inventory',true),('manager','dispatch',true),('manager','purchases',true),('manager','requests',true),('manager','approvals',true),
 ('accounts','finance',true),('accounts','reports',true),
 ('store','inventory',true),('store','dispatch',true),('store','purchases',true),('store','approvals',true),
 ('staff','sales',true),('staff','customers',true),('staff','requests',true)
on conflict(role,permission) do nothing;

-- Keep payroll history when an employee leaves the active workforce.
alter table public.payslips drop constraint if exists payslips_emp_id_fkey;
alter table public.payslips add constraint payslips_emp_id_fkey
  foreign key (emp_id) references public.employees(id) on delete restrict;

-- Replace the legacy admin/staff-only foundation policies with the same
-- permission checks the admin matrix controls. Deletes stay admin-only.
do $$
declare t text; p record; permission_name text;
begin
  foreach t in array array['parties','products','orders','sales'] loop
    if to_regclass('public.'||t) is not null then
      for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
        if p.policyname <> 'admin_full_access' then execute format('drop policy %I on public.%I',p.policyname,t); end if;
      end loop;
      permission_name := case when t in ('parties','products') then 'customers' when t='sales' then 'dispatch' else 'sales' end;
      execute format('create policy sd_role_read on public.%I for select to authenticated using (public.has_permission(%L) or (public.has_permission(''sales'') and %L=''dispatch''))',t,permission_name,permission_name);
      execute format('create policy sd_role_write on public.%I for insert to authenticated with check (public.has_permission(%L) or (public.has_permission(''sales'') and %L=''dispatch''))',t,permission_name,permission_name);
      execute format('create policy sd_role_update on public.%I for update to authenticated using (public.has_permission(%L) or (public.has_permission(''sales'') and %L=''dispatch'')) with check (public.has_permission(%L) or (public.has_permission(''sales'') and %L=''dispatch''))',t,permission_name,permission_name,permission_name,permission_name);
      execute format('create policy sd_role_delete on public.%I for delete to authenticated using (public.my_role()=''admin'')',t);
    end if;
  end loop;
  foreach t in array array['stock_ledger','purchase_suppliers','purchase_messages'] loop
    if to_regclass('public.'||t) is not null then
      for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
        if p.policyname <> 'admin_full_access' then execute format('drop policy %I on public.%I',p.policyname,t); end if;
      end loop;
      permission_name := case when t='stock_ledger' then 'inventory' else 'purchases' end;
      execute format('create policy sd_role_access on public.%I for all to authenticated using (public.has_permission(%L)) with check (public.has_permission(%L))',t,permission_name,permission_name);
    end if;
  end loop;
end;
$$;
