-- ─────────────────────────────────────────────────────────────────────────
-- BACKFILL: settings that should exist for every tenant
-- ─────────────────────────────────────────────────────────────────────────
-- Some settings rows (added by older one-off migrations like
-- min_booking_lead.sql, damage_protection.sql) were never created for the
-- IAF tenant — they only got created later for the demo tenant via the
-- seed script. After the multi-tenant proxy wrap started filtering
-- site_settings by tenant_id, /admin/diagnostics correctly reports them
-- as "Setting not found" for tenants that never had them.
--
-- This script inserts the missing default rows for EVERY existing tenant
-- so each one falls back to the same code defaults the app already used
-- when the row was absent. Safe to re-run (uses on conflict do nothing
-- on the (tenant_id, key) composite unique).
-- ─────────────────────────────────────────────────────────────────────────

insert into public.site_settings (tenant_id, key, value, description, category)
select t.id, s.key, s.value, s.description, s.category
from public.tenants t
cross join (values
  ('min_booking_lead_hours', '48',
    'Minimum hours from now before a date is selectable in the public booking wizard. Default 48 = no bookings within 2 days. Set 0 to allow same-day bookings.',
    'general'),
  ('damage_protection_enabled', 'true',
    'Show damage protection opt-in at checkout. Set to false to hide.',
    'general'),
  ('damage_protection_price_cents', '2500',
    'Flat fee charged for damage protection ($25 = 2500). One-time per booking.',
    'general'),
  ('damage_protection_coverage_cents', '50000',
    'Max damage covered when customer opts in ($500 = 50000).',
    'general')
) as s(key, value, description, category)
on conflict (tenant_id, key) do nothing;

-- Verify
select t.business_name,
       s.key,
       s.value
from public.site_settings s
join public.tenants t on t.id = s.tenant_id
where s.key in (
  'min_booking_lead_hours',
  'damage_protection_enabled',
  'damage_protection_price_cents',
  'damage_protection_coverage_cents'
)
order by t.business_name, s.key;
