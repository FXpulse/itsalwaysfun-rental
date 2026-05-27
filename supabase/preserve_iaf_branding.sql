-- ─────────────────────────────────────────────────────────────────────────
-- Preserve IAF's existing site copy as explicit site_settings rows
-- ─────────────────────────────────────────────────────────────────────────
-- Code change made DEFAULTS generic ("Bounce houses + party rentals"
-- instead of "Welcome to It's Always Fun") so new tenants don't see
-- hardcoded IAF text. This migration writes IAF's original branded copy
-- as site_settings rows so itsalwaysfun.net keeps its current look.
--
-- Safe to re-run (uses ON CONFLICT DO NOTHING — won't overwrite if she
-- already customized them in /admin/site).
-- ─────────────────────────────────────────────────────────────────────────

do $$
declare
  iaf_id uuid := '11111111-1111-1111-1111-111111111111';
begin
  insert into public.site_settings (tenant_id, key, value, description, category) values
    (iaf_id, 'hero_title', 'Welcome to It''s Always Fun',
     'Homepage hero headline', 'content'),
    (iaf_id, 'hero_subtitle',
     'We don''t just rent bounce houses — we create unforgettable memories filled with energy, laughter, and joy.',
     'Homepage hero subheading', 'content'),
    (iaf_id, 'hero_tagline',
     'Because when it comes to your special day, fun isn''t optional, it''s guaranteed!',
     'Homepage hero italic tagline', 'content'),
    (iaf_id, 'hero_cta_label', 'Check availability →', 'Homepage CTA button', 'content'),
    (iaf_id, 'section_categories_title',
     'Bounce Higher. Laugh Louder. Celebrate Bigger.',
     'Categories section title', 'content'),
    (iaf_id, 'section_featured_title', 'Our Rentals', 'Featured section title', 'content'),
    (iaf_id, 'trust_delivery', 'Free Delivery — Within Jacksonville metro area',
     'Trust bar: delivery', 'content'),
    (iaf_id, 'trust_cleaned', 'Cleaned & Sanitized — Every unit, every rental, every time',
     'Trust bar: cleanliness', 'content'),
    (iaf_id, 'trust_rating', '5-Star Rated — Hundreds of happy families',
     'Trust bar: reviews', 'content'),
    (iaf_id, 'footer_description',
     'We don''t just rent bounce houses — we create unforgettable memories filled with energy, laughter, and joy. Serving Jacksonville and surrounding areas.',
     'Footer paragraph', 'content'),
    (iaf_id, 'logo_url',
     'https://files.sysers.com/cp/upload/itsalwaysfun/editor/med/its_always_fun_logo.png',
     'Header logo URL', 'general'),
    (iaf_id, 'service_area', 'Jacksonville, FL and surrounding areas within 30 miles',
     'Service area description', 'general'),
    (iaf_id, 'instagram_url', 'https://instagram.com/itsalwaysfunparty',
     'Instagram URL', 'social'),
    (iaf_id, 'facebook_url', 'https://facebook.com/itsalwaysfunparty',
     'Facebook URL', 'social')
  on conflict (tenant_id, key) do nothing;
end $$;

notify pgrst, 'reload schema';
