-- Run AFTER 01 and 03. Safe to re-run. Payroll data is visible and editable by ADMIN only.
create table if not exists public.employees(
  id uuid primary key default gen_random_uuid(), name text not null, designation text, phone text,
  daily_rate numeric(10,2) not null default 0 check (daily_rate >= 0), joined date,
  active boolean not null default true, created_at timestamptz default now());
create table if not exists public.attendance(
  id bigserial primary key, emp_id uuid not null references public.employees(id) on delete cascade,
  date date not null, status text not null check (status in ('P','A','H','L')), unique (emp_id, date));
create table if not exists public.pay_adjustments(
  id bigserial primary key, emp_id uuid not null references public.employees(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  kind text not null check (kind in ('Bonus','Overtime','Advance','Deduction')),
  amount numeric(12,2) not null check (amount > 0), note text, created_at timestamptz default now());
grant usage, select on sequence public.attendance_id_seq, public.pay_adjustments_id_seq to authenticated;
do $$ declare t text; p record; begin
  foreach t in array array['employees','attendance','pay_adjustments'] loop
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
