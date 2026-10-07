# SalesDesk access matrix

Generated from the live Supabase public.pg_policies state on 2026-10-07. RLS is enabled on the application tables. Public customer-link access is implemented through dedicated RPC functions rather than table access.

| Area | anon | authenticated | customer-link |
|---|---|---|---|
| parties/orders/products/sales | blocked by table RLS | role policies | blocked |
| invoices/invoice_lines | blocked | sales/finance permission policies | blocked |
| payments/payment_allocations | blocked | finance/role policies | blocked |
| quotations/quotation_lines | blocked | sales/finance permission policies | blocked |
| party_public_links | blocked | authenticated roles manage links | blocked |
| notifications | blocked | own notifications or admin | blocked |
| audit_log | blocked | admin select | blocked |
| payroll tables | blocked | admin policies | blocked |
| payment-desk tables | blocked | active payment users | blocked |

Table grants are not the effective authorization boundary; RLS policies are the controlling layer. The live audit also shows broad authenticated table grants on some tables, constrained by RLS. No production permission was changed by this documentation stage.
