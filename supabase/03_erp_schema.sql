-- Run AFTER 01_security_rls.sql. Safe to re-run.
-- Adds: more roles, auto numbering, payments, stock ledger.
alter table public.app_users drop constraint if exists app_users_role_check;
alter table public.app_users add constraint app_users_role_check
  check (role in ('admin','manager','accounts','store','staff'));

create table if not exists public.number_sequences(prefix text primary key, last_no bigint not null default 0);
alter table public.number_sequences enable row level security;
alter table public.number_sequences force row level security;
revoke all on public.number_sequences from anon, authenticated;
create or replace function public.next_number(p text) returns text
language plpgsql security definer set search_path=public as $$
declare n bigint; begin
  if public.my_role() is null then raise exception 'not allowed'; end if;
  insert into number_sequences(prefix,last_no) values(p,1)
    on conflict(prefix) do update set last_no=number_sequences.last_no+1 returning last_no into n;
  return p||lpad(n::text,5,'0'); end $$;
revoke all on function public.next_number(text) from public, anon;
grant execute on function public.next_number(text) to authenticated;

create table if not exists public.payments(
  id uuid primary key default gen_random_uuid(), receipt_no text unique,
  date date not null default current_date, party_code text, invoice_no text,
  amount numeric(14,2) not null check (amount>0), mode text, ref text,
  created_by uuid default auth.uid(), created_at timestamptz default now());
create table if not exists public.stock_ledger(
  id bigserial primary key, date date not null default current_date, product_code text not null,
  kind text not null check (kind in ('Opening','Receipt','Adjustment')),
  qty numeric(14,3) not null, note text,
  created_by uuid default auth.uid(), created_at timestamptz default now());
grant usage, select on sequence public.stock_ledger_id_seq to authenticated;

do $$ declare t text; p record; begin
  foreach t in array array['payments','stock_ledger'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I', p.policyname, t); end loop;
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.my_role() is not null)', t||'_sel', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.my_role() is not null)', t||'_ins', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.my_role() is not null) with check (public.my_role() is not null)', t||'_upd', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.my_role() = ''admin'')', t||'_del', t);
    execute format('drop trigger if exists %I on public.%I', t||'_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_trg()', t||'_audit', t);
  end loop; end $$;
