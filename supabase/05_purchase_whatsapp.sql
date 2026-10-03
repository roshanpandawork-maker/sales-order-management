-- Purchase WhatsApp module. Run once in Supabase SQL Editor.
create table if not exists public.purchase_suppliers(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mobile text,
  contact text,
  gstin text,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_messages(
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.purchase_suppliers(id) on delete set null,
  supplier_name text not null,
  mobile text,
  date date not null,
  gr_no text,
  truck_no text,
  bags numeric not null default 0,
  weight numeric not null default 0,
  rate numeric not null default 0,
  oil numeric not null default 0,
  ffa text,
  remarks text,
  message text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.purchase_suppliers enable row level security;
alter table public.purchase_suppliers force row level security;
alter table public.purchase_messages enable row level security;
alter table public.purchase_messages force row level security;

revoke all on public.purchase_suppliers from anon, authenticated;
revoke all on public.purchase_messages from anon, authenticated;
grant select, insert, update, delete on public.purchase_suppliers to authenticated;
grant select, insert, update, delete on public.purchase_messages to authenticated;

drop policy if exists purchase_suppliers_sel on public.purchase_suppliers;
drop policy if exists purchase_suppliers_ins on public.purchase_suppliers;
drop policy if exists purchase_suppliers_upd on public.purchase_suppliers;
drop policy if exists purchase_suppliers_del on public.purchase_suppliers;
create policy purchase_suppliers_sel on public.purchase_suppliers for select to authenticated using (public.my_role() in ('admin','staff'));
create policy purchase_suppliers_ins on public.purchase_suppliers for insert to authenticated with check (public.my_role() in ('admin','staff'));
create policy purchase_suppliers_upd on public.purchase_suppliers for update to authenticated using (public.my_role() in ('admin','staff')) with check (public.my_role() in ('admin','staff'));
create policy purchase_suppliers_del on public.purchase_suppliers for delete to authenticated using (public.my_role() = 'admin');

drop policy if exists purchase_messages_sel on public.purchase_messages;
drop policy if exists purchase_messages_ins on public.purchase_messages;
drop policy if exists purchase_messages_upd on public.purchase_messages;
drop policy if exists purchase_messages_del on public.purchase_messages;
create policy purchase_messages_sel on public.purchase_messages for select to authenticated using (public.my_role() in ('admin','staff'));
create policy purchase_messages_ins on public.purchase_messages for insert to authenticated with check (public.my_role() in ('admin','staff'));
create policy purchase_messages_upd on public.purchase_messages for update to authenticated using (public.my_role() in ('admin','staff')) with check (public.my_role() in ('admin','staff'));
create policy purchase_messages_del on public.purchase_messages for delete to authenticated using (public.my_role() = 'admin');

drop trigger if exists purchase_suppliers_audit on public.purchase_suppliers;
create trigger purchase_suppliers_audit after insert or update or delete on public.purchase_suppliers for each row execute function public.audit_trg();
drop trigger if exists purchase_messages_audit on public.purchase_messages;
create trigger purchase_messages_audit after insert or update or delete on public.purchase_messages for each row execute function public.audit_trg();
