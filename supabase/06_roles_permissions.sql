create table if not exists public.role_permissions(
 role text not null, permission text not null, allowed boolean not null default false,
 primary key(role,permission)
);
insert into public.role_permissions(role,permission,allowed) values
('admin','*',true),('manager','sales',true),('manager','finance',true),('manager','reports',true),
('sales','sales',true),('sales','customers',true),('sales','requests',true),
('accountant','finance',true),('accountant','reports',true),
('store','inventory',true),('store','dispatch',true),
('viewer','reports',true)
on conflict do nothing;

create or replace function public.has_permission(p text) returns boolean
language sql stable security definer set search_path=public as
$$ select public.my_role()='admin' or exists(
 select 1 from public.role_permissions rp join public.app_users u on u.role=rp.role
 where u.user_id=auth.uid() and (rp.permission='*' or rp.permission=p) and rp.allowed=true
) $$;

create or replace function public.get_dashboard_role() returns jsonb
language sql stable security definer set search_path=public as
$$
select jsonb_build_object(
 'role',coalesce(public.my_role(),'viewer'),
 'permissions',coalesce((select jsonb_agg(permission) from public.role_permissions rp join public.app_users u on u.role=rp.role where u.user_id=auth.uid() and rp.allowed), '[]'::jsonb)
)
$$;
