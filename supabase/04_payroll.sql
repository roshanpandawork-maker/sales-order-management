-- Payroll v2 migration. Run AFTER 01_security_rls.sql and 03_erp_schema.sql.
-- Safe to run on an existing Payroll v1 database.
-- Policy: monthly salary is the salary for the month; daily rate = monthly salary / 30.
-- Each employee receives 4 paid leave days per month by default.
-- LW = worked on a paid-leave day and earns one extra daily-rate payment.

create table if not exists public.employees(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  designation text,
  phone text,
  daily_rate numeric(10,2) not null default 0 check (daily_rate >= 0),
  monthly_salary numeric(12,2),
  paid_leave_quota integer not null default 4 check (paid_leave_quota between 0 and 31),
  joined date,
  active boolean not null default true,
  created_at timestamptz default now()
);

alter table public.employees add column if not exists monthly_salary numeric(12,2);
alter table public.employees add column if not exists paid_leave_quota integer not null default 4;

-- Existing employees used daily_rate in Payroll v1. Convert them to the new model.
update public.employees
set monthly_salary = round(daily_rate * 30, 2)
where monthly_salary is null;

alter table public.employees alter column monthly_salary set default 0;
update public.employees set monthly_salary = 0 where monthly_salary is null;
alter table public.employees alter column monthly_salary set not null;

create table if not exists public.attendance(
  id bigserial primary key,
  emp_id uuid not null references public.employees(id) on delete cascade,
  date date not null,
  status text not null,
  unique (emp_id, date)
);

-- Recreate the status constraint so the new LW status is accepted.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid='public.attendance'::regclass
      and contype='c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.attendance drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.attendance
  add constraint attendance_status_check
  check (status in ('P','H','L','LW','A'));

create table if not exists public.pay_adjustments(
  id bigserial primary key,
  emp_id uuid not null references public.employees(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  kind text not null check (kind in ('Bonus','Overtime','Advance','Deduction')),
  amount numeric(12,2) not null check (amount > 0),
  note text,
  created_at timestamptz default now()
);

grant usage, select on sequence public.attendance_id_seq, public.pay_adjustments_id_seq to authenticated;

do $$
declare t text; p record;
begin
  foreach t in array array['employees','attendance','pay_adjustments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.my_role() = ''admin'') with check (public.my_role() = ''admin'')',
      t||'_admin',t
    );
    execute format('drop trigger if exists %I on public.%I',t||'_audit',t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_trg()',t||'_audit',t);
  end loop;
end $$;
