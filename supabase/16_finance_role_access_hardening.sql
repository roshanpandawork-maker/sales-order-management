-- Restrict finance data by capability and keep destructive operations admin-only.
-- Apply after 15_admin_role_management.sql. RLS stays the enforcement boundary.

revoke all on table public.sales_invoices from public, anon, authenticated;
grant select, insert, update, delete on table public.sales_invoices to authenticated;

drop policy if exists sales_invoices_sel on public.sales_invoices;
drop policy if exists sales_invoices_ins on public.sales_invoices;
drop policy if exists sales_invoices_upd on public.sales_invoices;
drop policy if exists sales_invoices_del on public.sales_invoices;
create policy sales_invoices_sel on public.sales_invoices
  for select to authenticated using ((select public.has_permission('finance')));
create policy sales_invoices_ins on public.sales_invoices
  for insert to authenticated with check ((select public.has_permission('finance')));
create policy sales_invoices_upd on public.sales_invoices
  for update to authenticated
  using ((select public.has_permission('finance')))
  with check ((select public.has_permission('finance')));
create policy sales_invoices_del on public.sales_invoices
  for delete to authenticated using (public.my_role() = 'admin');

revoke all on table public.company_profile from public, anon, authenticated;
grant select, insert, update on table public.company_profile to authenticated;
drop policy if exists company_profile_sel on public.company_profile;
create policy company_profile_sel on public.company_profile
  for select to authenticated using ((select public.has_permission('finance')));
drop policy if exists company_profile_ins on public.company_profile;
create policy company_profile_ins on public.company_profile
  for insert to authenticated with check (public.my_role() = 'admin');
drop policy if exists company_profile_upd on public.company_profile;
create policy company_profile_upd on public.company_profile
  for update to authenticated
  using (public.my_role() = 'admin')
  with check (public.my_role() = 'admin');

revoke all on table public.payments from public, anon, authenticated;
grant select, insert, update, delete on table public.payments to authenticated;
drop policy if exists payments_sel on public.payments;
drop policy if exists payments_ins on public.payments;
drop policy if exists payments_upd on public.payments;
drop policy if exists payments_del on public.payments;
drop policy if exists sd_payment_access on public.payments;
create policy payments_sel on public.payments
  for select to authenticated using ((select public.has_permission('finance')));
create policy payments_ins on public.payments
  for insert to authenticated with check ((select public.has_permission('finance')));
create policy payments_upd on public.payments
  for update to authenticated
  using ((select public.has_permission('finance')))
  with check ((select public.has_permission('finance')));
create policy payments_del on public.payments
  for delete to authenticated using (public.my_role() = 'admin');
