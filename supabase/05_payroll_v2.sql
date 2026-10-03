-- Run AFTER 04_payroll.sql. Safe to re-run. Admin only.
alter table public.employees add column if not exists pf_applicable boolean not null default true;
create table if not exists public.payroll_settings(
  id int primary key default 1 check (id = 1),
  paid_leave_days int not null default 4 check (paid_leave_days >= 0),
  pf_percent numeric(5,2) not null default 12, pf_threshold numeric(10,2) not null default 1000,
  pf_mode text not null default 'full' check (pf_mode in ('full','excess')),
  company_name text, company_address text);
insert into public.payroll_settings(id) values (1) on conflict do nothing;
create table if not exists public.payslips(
  id bigserial primary key, emp_id uuid not null references public.employees(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'), d jsonb not null,
  status text not null default 'Draft' check (status in ('Draft','Final')),
  edited boolean not null default false, updated_at timestamptz default now(), unique (emp_id, month));
grant usage, select on sequence public.payslips_id_seq to authenticated;
do $$ declare t text; p record; begin
  foreach t in array array['payroll_settings','payslips'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I', p.policyname, t); end loop;
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.my_role() = ''admin'') with check (public.my_role() = ''admin'')', t||'_admin', t);
    execute format('drop trigger if exists %I on public.%I', t||'_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_trg()', t||'_audit', t);
  end loop; end $$;
