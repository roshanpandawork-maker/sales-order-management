# SalesDesk -> ERP: what changed and where to change more

## Run order (setup)
1. Supabase SQL Editor: run `supabase/01_security_rls.sql` (already done), then **`supabase/03_erp_schema.sql`** (new).
2. Upload the folder as before. Hard-refresh the browser (Ctrl+F5).
3. New sidebar tabs: Inventory, Invoices (GST), Payments, Reports.

## Files ADDED
| File | Purpose | Change here when you want to... |
|---|---|---|
| `supabase/03_erp_schema.sql` | Roles (admin/manager/accounts/store/staff), auto numbering `next_number()`, `payments`, `stock_ledger`, RLS + audit | add tables (copy the `payments` block + add name to the `array[...]` in the loop) |
| `js/erp.js` | Inventory, Invoices, Payments, Reports screens | add a module: add a section id in `SECS`, build HTML in `draw()` |
| `css/erp.css` | Sidebar layout, print styles | colours -> `:root` vars in `styles.css`; sidebar width -> `230px` (3 places) |

## Files EDITED
| File | Edit |
|---|---|
| `index.html` | Link to `erp.css`; 4 new sidebar buttons (after "Party Balance"); 4 empty `<section>`s before `.foot`; `erp.js` script after `app.js` |

## Files UNCHANGED (your next steps live here)
- `js/app.js` - still one big file. **Next:** split into `js/core/` (db, utils) and `js/modules/` (parties, products, orders, dispatch). Move one function group at a time; `erp.js` shows the pattern.
- `js/security.js` - `ALLOWED` list is for `data-act` buttons. Add a role->screens map here to hide tabs per role (call `supabaseClient.rpc('my_role')`).
- `supabase/01_security_rls.sql` - delete is still admin-only for the 4 original tables; give `manager` delete rights by editing the `_del` policy.
- `_headers` / CSP - no change needed (erp.js is same-origin). Add a host to `connect-src`/`script-src` only if you add external libraries.

## How the ERP parts work
- **Invoices** are built automatically from dispatch lines that have an *Invoice / dispatch no.* (Sales tab). GST % is one box on the Invoices tab (default 5).
- **Stock on hand** = stock ledger entries - dispatched qty. "Short" flag shows when stock < pending SO quantity.
- **Payments** are saved against an invoice with an auto receipt number (RCT00001...). Overpayment is blocked.
- **Reports**: receivables ageing, sales by party, sales by product.

## Still to build (in this order)
1. Move invoices into a real table with CGST/SGST/IGST by party state, and per-product GST.
2. Purchase module: suppliers, purchase orders, goods receipt (writes `Receipt` rows to `stock_ledger`).
3. Database functions for dispatch (row lock + stock check) so rules can't be bypassed; replace client-generated IDs in `app.js` (`id()`) with `next_number()`.
4. Server-side paging, toasts instead of `alert()`, dark mode, role-based tab hiding, audit log screen.
