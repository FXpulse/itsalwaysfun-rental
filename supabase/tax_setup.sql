-- Per-tenant configurable sales tax / IVA / VAT.
-- Admin sets tax_enabled + tax_rate_percent at /admin/site.
-- Public booking + quote approval auto-calculate tax on the final amount
-- and store it on bookings.tax_cents. Admins can still manually override
-- tax on individual quotes (quotes.tax_cents) for exemptions.

alter table public.bookings
  add column if not exists tax_cents integer not null default 0;

comment on column public.bookings.tax_cents is
  'Sales tax / IVA / VAT charged on this booking. Stored separately so it can be reported, refunded, and itemized on receipts. Included in total_amount.';

-- Seed defaults for every existing tenant (idempotent via on conflict)
insert into public.site_settings (tenant_id, key, value, description, category)
select t.id, k.key, k.value, k.description, 'tax'
from public.tenants t
cross join (values
  ('tax_enabled',      'false', 'Apply sales tax to every booking + quote. Set rate below.'),
  ('tax_rate_percent', '0',     'Tax rate as a decimal percent. Example: 7.5 means 7.5%. Florida is around 7%, NY ~8.875%, CA ~7.25-10.25%.'),
  ('tax_label',        'Sales tax', 'How tax shows on the customer''s receipt + payment summary. Examples: "Sales tax", "IVA", "VAT".')
) as k(key, value, description)
on conflict (tenant_id, key) do nothing;
