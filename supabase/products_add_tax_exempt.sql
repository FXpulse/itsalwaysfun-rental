-- Per-product tax exemption flag. Used by the quote editor + public booking
-- flow to skip tax on specific items (e.g., resold gift cards, deposits,
-- non-taxable services in jurisdictions where they apply).
--
-- When true: the product's revenue is INCLUDED in the booking/quote total
-- but EXCLUDED from the taxable base when auto-calculating tax.

alter table public.products
  add column if not exists tax_exempt boolean not null default false;

comment on column public.products.tax_exempt is
  'When true, this product is excluded from the taxable base on bookings + quotes. Revenue still counts toward the total — only tax is skipped on its share.';
