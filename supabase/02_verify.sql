-- Run after 01_security_rls.sql. Expected results in comments.

-- A) Every table should show rls_enabled = true, rls_forced = true
select relname, relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
from pg_class where relnamespace='public'::regnamespace and relkind='r' order by 1;

-- B) Policies: none should mention role anon or use (true)
select tablename, policyname, cmd, roles, qual from pg_policies where schemaname='public' order by 1,2;

-- C) anon should have NO privileges on your tables (expect zero rows)
select table_name, privilege_type from information_schema.role_table_grants
where grantee='anon' and table_schema='public';

-- D) Who can log in to the app
select email, role, created_at from public.app_users;

-- E) Recent changes (admin view)
select at, user_id, table_name, action from public.audit_log order by at desc limit 50;
