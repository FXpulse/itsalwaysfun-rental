-- supabase/seo_settings_extra.sql
--
-- Additional SEO settings that feed the LocalBusiness JSON-LD on the
-- public homepage. All optional — when blank, the schema helper simply
-- omits the field (no broken markup).
--
-- New keys:
--   geo_latitude     — decimal degrees, e.g. 30.3322 (Jacksonville)
--   geo_longitude    — decimal degrees, e.g. -81.6557
--   price_range      — Google's $-$$$$ notation
--
-- These help Google rank the business for "near me" searches and let it
-- pin the location on Maps without scraping the address. price_range
-- shows in some rich results.
--
-- Idempotent — on conflict do nothing so a tenant that's already set them
-- (via /admin/site) keeps their value.

insert into public.site_settings (tenant_id, key, value, description, category)
select t.id, k.key, k.value, k.description, 'seo'
from public.tenants t
cross join (values
  (
    'geo_latitude',
    '',
    'Your business latitude in decimal degrees. Find it on Google Maps: right-click your location → coordinates appear at top. Example: 30.3322. Helps Google rank you for "near me" searches.'
  ),
  (
    'geo_longitude',
    '',
    'Your business longitude in decimal degrees. Same place as latitude. Negative for US (West). Example: -81.6557.'
  ),
  (
    'price_range',
    '$$',
    'Approximate price range shown in some Google rich results. Use $ (cheap), $$ (mid), $$$ (premium), $$$$ (luxury). Most party rentals = $$.'
  )
) as k(key, value, description)
on conflict (tenant_id, key) do nothing;
