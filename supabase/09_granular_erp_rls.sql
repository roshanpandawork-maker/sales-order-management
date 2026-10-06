-- Align ERP foundation RLS with granular role permissions and restrict permission RPCs.
-- Applied to Supabase project noldgjtoqhwefqdzdpzs.
-- See 08_transaction_integrity.sql for transaction functions.
do $$
declare t text;
begin
  foreach t in array array['quotations','quotation_lines','party_product_prices','price_history','invoices','invoice_lines'] loop
    execute format('drop policy if exists sd_staff_all on public.%I',t);
  end loop;
end $$;

create policy sd_quotations_access on public.quotations for all to authenticated
using ((select public.has_permission('sales')) or (select public.has_permission('finance')))
with check ((select public.has_permission('sales')) or (select public.has_permission('finance')));

create policy sd_quotation_lines_access on public.quotation_lines for all to authenticated
using ((select public.has_permission('sales')) or (select public.has_permission('finance')))
with check ((select public.has_permission('sales')) or (select public.has_permission('finance')));

create policy sd_price_access on public.party_product_prices for all to authenticated
using ((select public.has_permission('sales')) or (select public.has_permission('finance')))
with check ((select public.has_permission('sales')) or (select public.has_permission('finance')));

create policy sd_price_history_access on public.price_history for all to authenticated
using ((select public.has_permission('sales')) or (select public.has_permission('finance')))
with check ((select public.has_permission('sales')) or (select public.has_permission('finance')));

create policy sd_invoice_access on public.invoices for all to authenticated
using ((select public.has_permission('sales')) or (select public.has_permission('finance')))
with check ((select public.has_permission('sales')) or (select public.has_permission('finance')));

create policy sd_invoice_lines_access on public.invoice_lines for all to authenticated
using ((select public.has_permission('sales')) or (select public.has_permission('finance')))
with check ((select public.has_permission('sales')) or (select public.has_permission('finance')));

drop policy if exists sd_staff_all on public.payments;
create policy sd_payment_access on public.payments for all to authenticated
using ((select public.has_permission('finance')))
with check ((select public.has_permission('finance')));

drop policy if exists sd_staff_all on public.inventory_movements;
create policy sd_inventory_access on public.inventory_movements for all to authenticated
using ((select public.has_permission('inventory')) or (select public.has_permission('dispatch')))
with check ((select public.has_permission('inventory')) or (select public.has_permission('dispatch')));

drop policy if exists sd_staff_all on public.party_requests;
create policy sd_request_access on public.party_requests for all to authenticated
using ((select public.has_permission('requests')) or (select public.has_permission('sales')))
with check ((select public.has_permission('requests')) or (select public.has_permission('sales')));

drop policy if exists sd_staff_all on public.approvals;
create policy sd_approval_access on public.approvals for all to authenticated
using ((select public.has_permission('sales')) or (select public.has_permission('finance')) or (select public.has_permission('inventory')))
with check ((select public.has_permission('sales')) or (select public.has_permission('finance')) or (select public.has_permission('inventory')));

revoke execute on function public.has_permission(text) from public,anon;
grant execute on function public.has_permission(text) to authenticated;
revoke execute on function public.get_dashboard_role() from public,anon;
grant execute on function public.get_dashboard_role() to authenticated;
