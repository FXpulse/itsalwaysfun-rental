-- SEO settings — editable per tenant from /admin/site.
--
-- These keys control:
--   * Page <title> and <meta name="description"> shown in search results
--   * Open Graph image when the URL is shared on Facebook / WhatsApp / Twitter
--   * Google Search Console + Bing Webmaster Tools verification meta tags
--   * Google Business Profile URL — added to LocalBusiness JSON-LD sameAs[]
--     so Google can cross-link the site with the GBP listing
--
-- All keys default to empty string ('') — pages fall back to auto-generated
-- titles built from business_name + city when the tenant hasn't customized.
--
-- Idempotent: on conflict do nothing — running again won't overwrite existing
-- values a tenant has already customized.

insert into public.site_settings (tenant_id, key, value, description, category)
select t.id, k.key, k.value, k.description, 'seo'
from public.tenants t
cross join (values
  (
    'seo_default_title',
    '',
    'Page title shown in browser tabs and Google results. Leave blank for auto-generated (recommended). Example: "Jacksonville Bounce House Rentals | Free Delivery". 50-60 chars ideal.'
  ),
  (
    'seo_default_description',
    '',
    'Meta description shown under your title in Google results. Leave blank for auto-generated. 140-160 chars ideal. Include city + main service for local ranking.'
  ),
  (
    'seo_og_image_url',
    '',
    'Image shown when someone shares your homepage on Facebook, WhatsApp, Twitter, iMessage. 1200x630 px PNG/JPG. If blank, falls back to your logo.'
  ),
  (
    'seo_google_verification',
    '',
    'Google Search Console verification code. Get it at search.google.com/search-console → Add property → HTML tag. Paste only the content="..." value (the long alphanumeric string).'
  ),
  (
    'seo_bing_verification',
    '',
    'Bing Webmaster Tools verification code. Get it at bing.com/webmasters → Add site → HTML meta tag. Paste only the content="..." value.'
  ),
  (
    'google_business_profile_url',
    '',
    'Your Google Business Profile URL — find it at business.google.com under "Share profile". Used to link your website to your GBP listing for better local rankings. Example: https://g.page/your-business or maps.google.com/...'
  )
) as k(key, value, description)
on conflict (tenant_id, key) do nothing;
