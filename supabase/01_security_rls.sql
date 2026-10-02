-- SalesDesk security setup. Run ONCE in Supabase -> SQL Editor. Safe to re-run.
-- Result: only users listed in app_users can touch data; anonymous access is blocked;
-- only 'admin' can delete; every change is written to an audit log.

-- 1) Allow-list of people permitted to use the app
create table if not exists public.app_users(
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null check (role in ('admin','staff')),
  created_at timestamptz not null default now());
alter table public.app_users enable row level security;
alter table public.app_users force row level security;
revoke all on public.app_users from anon, authenticated;   -- no direct API access

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.app_users where user_id = auth.uid() $$;
revoke all on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;

-- 2) Audit log (admins can read; nobody can edit)
create table if not exists public.audit_log(
  id bigserial primary key, at timestamptz not null default now(),
  user_id uuid, table_name text, action text, row_data jsonb);
alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log for select to authenticated
  using (public.my_role() = 'admin');

create or replace function public.audit_trg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log(user_id, table_name, action, row_data)
  values (auth.uid(), tg_table_name, tg_op,
          case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return null;
end $$;

-- 3) Lock the four business tables
do $$
declare t text; p record;
begin
  foreach t in array array['parties','products','orders','sales'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I', p.policyname, t);   -- remove old open policies
    end loop;
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke all on public.%I from authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    execute format('create policy %I on public.%I for select to authenticated using (public.my_role() in (''admin'',''staff''))', t||'_sel', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.my_role() in (''admin'',''staff''))', t||'_ins', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.my_role() in (''admin'',''staff'')) with check (public.my_role() in (''admin'',''staff''))', t||'_upd', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.my_role() = ''admin'')', t||'_del', t);

    execute format('drop trigger if exists %I on public.%I', t||'_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_trg()', t||'_audit', t);
  end loop;
end $$;

-- 4) Add yourself as admin (create the user first: Authentication -> Users -> Add user).
-- Replace the email, then run:
-- insert into public.app_users(user_id,email,role)
--   select id,email,'admin' from auth.users where email='you@example.com'
--   on conflict (user_id) do update set role='admin';
-- Staff user (cannot delete):  same statement with 'staff'.
