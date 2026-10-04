-- SalesDesk quantity type support
-- Run this once in Supabase SQL Editor before creating new SO/dispatch records.
alter table public.sales
  add column if not exists qty_type text;

update public.sales s
set qty_type = coalesce(
  s.qty_type,
  (select p.unit from public.products p where p.code = s.product_code),
  'QTL'
)
where s.qty_type is null;

alter table public.sales
  drop constraint if exists sales_qty_type_check;

alter table public.sales
  add constraint sales_qty_type_check
  check (qty_type in ('QTL','KG','MT','PCS','BAG'));

create index if not exists sales_so_product_qty_type_idx
  on public.sales(so, product_code, qty_type);
