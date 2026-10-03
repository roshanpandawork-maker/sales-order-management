-- Payment Desk: isolated payment follow-up module
-- Run this in the SAME Supabase project used by SalesDesk.
create extension if not exists pgcrypto;

create table if not exists public.payment_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null default 'payment_user',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_parties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  phone text,
  whatsapp text,
  broker_name text,
  broker_phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_invoices (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.payment_parties(id) on delete cascade,
  invoice_no text not null,
  invoice_date date not null default current_date,
  amount numeric(14,2) not null default 0,
  received_amount numeric(14,2) not null default 0,
  due_date date not null,
  remarks text,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_payments (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.payment_parties(id) on delete cascade,
  invoice_id uuid references public.payment_invoices(id) on delete set null,
  payment_date date not null default current_date,
  amount numeric(14,2) not null default 0,
  mode text,
  reference text,
  remarks text,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_followups (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.payment_parties(id) on delete cascade,
  followup_date date not null default current_date,
  mode text,
  person_contacted text,
  discussion text,
  promise_date date,
  promise_amount numeric(14,2) not null default 0,
  next_followup date,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_invoices_party on public.payment_invoices(party_id);
create index if not exists idx_payment_invoices_due on public.payment_invoices(due_date);
create index if not exists idx_payment_payments_party on public.payment_payments(party_id);
create index if not exists idx_payment_followups_party on public.payment_followups(party_id);
create index if not exists idx_payment_followups_next on public.payment_followups(next_followup);

alter table public.payment_users enable row level security;
alter table public.payment_parties enable row level security;
alter table public.payment_invoices enable row level security;
alter table public.payment_payments enable row level security;
alter table public.payment_followups enable row level security;

drop policy if exists payment_users_self on public.payment_users;
create policy payment_users_self on public.payment_users
for select to authenticated using (user_id=auth.uid());

drop policy if exists payment_parties_access on public.payment_parties;
create policy payment_parties_access on public.payment_parties
for all to authenticated using (
  exists(select 1 from public.payment_users u where u.user_id=auth.uid() and u.active=true)
) with check (
  exists(select 1 from public.payment_users u where u.user_id=auth.uid() and u.active=true)
);

drop policy if exists payment_invoices_access on public.payment_invoices;
create policy payment_invoices_access on public.payment_invoices
for all to authenticated using (
  exists(select 1 from public.payment_users u where u.user_id=auth.uid() and u.active=true)
) with check (
  exists(select 1 from public.payment_users u where u.user_id=auth.uid() and u.active=true)
);

drop policy if exists payment_payments_access on public.payment_payments;
create policy payment_payments_access on public.payment_payments
for all to authenticated using (
  exists(select 1 from public.payment_users u where u.user_id=auth.uid() and u.active=true)
) with check (
  exists(select 1 from public.payment_users u where u.user_id=auth.uid() and u.active=true)
);

drop policy if exists payment_followups_access on public.payment_followups;
create policy payment_followups_access on public.payment_followups
for all to authenticated using (
  exists(select 1 from public.payment_users u where u.user_id=auth.uid() and u.active=true)
) with check (
  exists(select 1 from public.payment_users u where u.user_id=auth.uid() and u.active=true)
);

grant usage on schema public to authenticated;
grant select,insert,update,delete on public.payment_users,public.payment_parties,public.payment_invoices,public.payment_payments,public.payment_followups to authenticated;

-- After creating the worker's account in Supabase Authentication,
-- replace WORKER-USER-UUID below with that user's Auth UUID:
-- insert into public.payment_users(user_id) values ('WORKER-USER-UUID');


-- Current Tally/Excel debtor-line-up support.
alter table public.payment_parties add column if not exists broker_name text;
alter table public.payment_parties add column if not exists broker_phone text;

create table if not exists public.payment_opening_balances (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null unique references public.payment_parties(id) on delete cascade,
  opening_date date not null default current_date,
  total_amount numeric(14,2) not null default 0,
  received_amount numeric(14,2) not null default 0,
  due_text text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payment_opening_party on public.payment_opening_balances(party_id);
alter table public.payment_opening_balances enable row level security;

drop policy if exists payment_opening_access on public.payment_opening_balances;
create policy payment_opening_access on public.payment_opening_balances
for all to authenticated using (
  exists(select 1 from public.payment_users u where u.user_id=auth.uid() and u.active=true)
) with check (
  exists(select 1 from public.payment_users u where u.user_id=auth.uid() and u.active=true)
);

grant select,insert,update,delete on public.payment_opening_balances to authenticated;
