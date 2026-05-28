-- Per-quote tax exemption flag. When true, no tax is applied at approval
-- time regardless of the tenant's tax_enabled / tax_rate_percent settings.
-- Useful for nonprofits, schools, government, resale customers, etc.

alter table public.quotes
  add column if not exists tax_exempt boolean not null default false;

comment on column public.quotes.tax_exempt is
  'When true, no sales tax is added on quote approval even if tenant has tax enabled globally. Admin sets this per-quote for exempt customers (nonprofits, schools, government, resellers).';
