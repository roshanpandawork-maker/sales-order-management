# Supabase migrations

The repository currently contains migrations 01 through 12 plus feature files that share numeric prefixes. The live production database is the source of truth until a full schema snapshot is reviewed.

Do not delete or rename an existing migration until a clean database replay has been tested.

Key production objects verified on 2026-10-07 include parties, products, orders, sales, company_profile, party_public_links, sales_orders, sales_order_items, sales_entries, sales_entry_items, invoices, invoice_lines, payments, payment_allocations, quotations, quotation_lines, inventory_movements, payroll tables and Payment Desk tables.

Run 99_verify.sql after migrations. A healthy result is zero rows.

Important: the complete 00_base_schema.sql from the original staged plan is deliberately not generated from guessed columns. The live schema was inspected directly; a full reproducible base migration should be generated from an approved production schema dump before replacing the existing migration set.
