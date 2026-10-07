-- SalesDesk final schema/security verification. Returns rows only when a finding exists.
select 'table_without_rls' as finding, tablename as object_name from pg_tables where schemaname='public' and rowsecurity=false;
select 'anon_table_grant' as finding, table_name as object_name from information_schema.role_table_grants where table_schema='public' and grantee='anon' and privilege_type in ('SELECT','INSERT','UPDATE','DELETE');
select 'policy_using_true' as finding, tablename||'.'||policyname as object_name from pg_policies where schemaname='public' and (coalesce(qual,'') ilike '%true%' or coalesce(with_check,'') ilike '%true%');
