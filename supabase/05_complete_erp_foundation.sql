-- SalesDesk complete ERP foundation
create extension if not exists pgcrypto;

create table if not exists public.quotations(
 id uuid primary key default gen_random_uuid(), quotation_no text not null unique,
 party_code text not null references public.parties(code), quotation_date date not null default current_date,
 valid_until date, status text not null default 'DRAFT' check(status in('DRAFT','SENT','ACCEPTED','REJECTED','EXPIRED','CONVERTED')),
 remarks text, created_at timestamptz not null default now()
);
create table if not exists public.quotation_lines(
 id uuid primary key default gen_random_uuid(), quotation_id uuid not null references public.quotations(id) on delete cascade,
 product_code text not null references public.products(code), quantity numeric(18,3) not null check(quantity>0),
 rate numeric(18,2) not null check(rate>=0), gst_rate numeric(6,2) not null default 0, unit text
);

create table if not exists public.party_product_prices(
 id uuid primary key default gen_random_uuid(), party_code text not null references public.parties(code) on delete cascade,
 product_code text not null references public.products(code) on delete cascade,
 rate numeric(18,2) not null check(rate>=0), valid_from date not null default current_date, valid_to date,
 source text default 'MANUAL', created_at timestamptz not null default now(),
 unique(party_code,product_code,valid_from)
);
create table if not exists public.price_history(
 id uuid primary key default gen_random_uuid(), product_code text not null references public.products(code),
 party_code text references public.parties(code), rate numeric(18,2) not null, gst_rate numeric(6,2) default 0,
 effective_from timestamptz not null default now(), source text default 'MANUAL', note text, created_at timestamptz default now()
);

create table if not exists public.invoices(
 id uuid primary key default gen_random_uuid(), invoice_no text not null unique,
 party_code text not null references public.parties(code), invoice_date date not null default current_date,
 so_no text, subtotal numeric(18,2) default 0, cgst numeric(18,2) default 0, sgst numeric(18,2) default 0,
 igst numeric(18,2) default 0, round_off numeric(18,2) default 0, grand_total numeric(18,2) default 0,
 status text not null default 'DRAFT' check(status in('DRAFT','ISSUED','PART_PAID','PAID','CANCELLED')),
 notes text, created_at timestamptz default now()
);
create table if not exists public.invoice_lines(
 id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.invoices(id) on delete cascade,
 product_code text references public.products(code), description text, hsn text, unit text,
 quantity numeric(18,3) default 0, rate numeric(18,2) default 0, gst_rate numeric(6,2) default 0,
 taxable numeric(18,2) default 0, gst_amount numeric(18,2) default 0, total numeric(18,2) default 0
);

create table if not exists public.payments(
 id uuid primary key default gen_random_uuid(), receipt_no text not null unique,
 party_code text not null references public.parties(code), invoice_id uuid references public.invoices(id),
 payment_date date not null default current_date, amount numeric(18,2) not null check(amount>0),
 mode text not null default 'BANK', reference_no text, remarks text, created_at timestamptz default now()
);

create table if not exists public.inventory_movements(
 id uuid primary key default gen_random_uuid(), movement_date date not null default current_date,
 product_code text not null references public.products(code), movement_type text not null,
 quantity numeric(18,3) not null, unit text, reference_type text, reference_id text,
 remarks text, created_at timestamptz default now()
);

create table if not exists public.party_requests(
 id uuid primary key default gen_random_uuid(), party_code text references public.parties(code),
 request_type text not null check(request_type in('PRODUCT','PRICE','DISPATCH','BALANCE','OTHER')),
 product_code text references public.products(code), quantity numeric(18,3),
 message text, status text not null default 'OPEN' check(status in('OPEN','IN_PROGRESS','DONE','REJECTED')),
 requested_at timestamptz default now(), resolved_at timestamptz
);

create table if not exists public.approvals(
 id uuid primary key default gen_random_uuid(), entity_type text not null, entity_id text not null,
 action text not null, requested_by uuid references auth.users(id), approved_by uuid references auth.users(id),
 status text not null default 'PENDING' check(status in('PENDING','APPROVED','REJECTED')),
 reason text, created_at timestamptz default now(), decided_at timestamptz
);

create table if not exists public.notifications(
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
 type text not null, title text not null, message text, entity_type text, entity_id text,
 read_at timestamptz, created_at timestamptz default now()
);

create index if not exists idx_q_party on public.quotations(party_code);
create index if not exists idx_price_party_product on public.party_product_prices(party_code,product_code);
create index if not exists idx_price_history_product on public.price_history(product_code,effective_from desc);
create index if not exists idx_invoice_party on public.invoices(party_code,invoice_date desc);
create index if not exists idx_payment_party on public.payments(party_code,payment_date desc);
create index if not exists idx_inventory_product on public.inventory_movements(product_code,movement_date desc);
create index if not exists idx_requests_status on public.party_requests(status,requested_at desc);
create index if not exists idx_notifications_user on public.notifications(user_id,read_at,created_at desc);

alter table public.quotations enable row level security;
alter table public.quotation_lines enable row level security;
alter table public.party_product_prices enable row level security;
alter table public.price_history enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.payments enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.party_requests enable row level security;
alter table public.approvals enable row level security;
alter table public.notifications enable row level security;

do $$ declare t text; begin
foreach t in array array['quotations','quotation_lines','party_product_prices','price_history','invoices','invoice_lines','payments','inventory_movements','party_requests','approvals'] loop
 execute format('drop policy if exists sd_staff_all on public.%I',t);
 execute format('create policy sd_staff_all on public.%I for all to authenticated using(public.my_role() in(''admin'',''staff'')) with check(public.my_role() in(''admin'',''staff''))',t);
end loop; end $$;
drop policy if exists sd_notifications on public.notifications;
create policy sd_notifications on public.notifications for all to authenticated using(user_id=auth.uid() or public.my_role()='admin') with check(user_id=auth.uid() or public.my_role()='admin');

-- Expanded roles are stored in the existing app_users role column.
-- Existing admin/staff users remain valid; UI can progressively expose granular permissions.
