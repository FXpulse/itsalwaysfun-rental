-- ─────────────────────────────────────────────────────────────────────────
-- SEED DEFAULT SITE_SETTINGS PER TENANT
-- ─────────────────────────────────────────────────────────────────────────
-- /admin/site (Website Content) only renders the keys that exist in
-- site_settings for the current tenant. IAF accumulated ~50 keys over
-- months; new tenants (testbouncers, fresh signups) only got the ~8 keys
-- their seed inserts. Result: their /admin/site page is missing a ton
-- of customization fields (hero, footer, appearance, trust badges, etc.)
-- that IAF has.
--
-- This file:
--   1. Defines a function seed_default_site_settings(p_tenant_id) that
--      inserts the full set of editable keys with sensible generic defaults
--      (no IAF references — every value is either neutral copy or empty).
--   2. Backfills every existing non-IAF tenant immediately so testbouncers
--      and any others get the full editor.
--   3. Signup will call this function for every brand-new tenant.
--
-- Safe to re-run (uses on conflict (tenant_id, key) do nothing).
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.seed_default_site_settings(p_tenant_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted int;
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required';
  end if;

  insert into public.site_settings (tenant_id, key, value, description, category) values
    -- ─── GENERAL (business identity + contact) ────────────────────────
    (p_tenant_id, 'business_name', '', 'Your business name (also editable on /admin/settings/branding)', 'general'),
    (p_tenant_id, 'business_phone', '', 'Primary phone shown in header, footer, and emails', 'general'),
    (p_tenant_id, 'business_email', '', 'Primary email shown in footer + emails', 'general'),
    (p_tenant_id, 'business_address', '', 'Street address shown in footer + emails', 'general'),
    (p_tenant_id, 'business_hours', '8:00 AM – 6:00 PM, Monday-Saturday', 'Open hours shown in footer / contact page', 'general'),
    (p_tenant_id, 'service_area', 'Your city and surrounding areas', 'Used in FAQs and contact page', 'general'),
    (p_tenant_id, 'instagram_url', '', 'Instagram profile URL (header + footer icon link)', 'general'),
    (p_tenant_id, 'facebook_url', '', 'Facebook page URL (header + footer icon link)', 'general'),
    (p_tenant_id, 'logo_url', '', 'Public URL of your logo (use /admin/settings/branding to upload)', 'general'),

    -- ─── BOOKING POLICIES ─────────────────────────────────────────────
    (p_tenant_id, 'min_booking_lead_hours', '48', 'Minimum hours before event a customer can still book online. Default 48h.', 'general'),
    (p_tenant_id, 'damage_protection_enabled', 'true', 'Show the damage protection opt-in at checkout', 'general'),
    (p_tenant_id, 'damage_protection_price_cents', '2500', 'Fee in cents customer pays for damage protection ($25 = 2500)', 'general'),
    (p_tenant_id, 'damage_protection_coverage_cents', '50000', 'Max damage covered when customer opts in ($500 = 50000)', 'general'),
    (p_tenant_id, 'booking_terms_note', 'Reschedule up to 7 days before with no fee.', 'Note shown above the booking checkout total', 'general'),

    -- ─── HOMEPAGE CONTENT ─────────────────────────────────────────────
    (p_tenant_id, 'hero_title', 'Rentals delivered to your door', 'Big headline on the homepage hero', 'content'),
    (p_tenant_id, 'hero_subtitle', 'Online booking, setup + takedown included.', 'Sub-headline under hero title', 'content'),
    (p_tenant_id, 'hero_tagline', 'Book now, party tomorrow.', 'Small tagline at top of hero', 'content'),
    (p_tenant_id, 'hero_cta_label', 'Check availability →', 'Text on the main call-to-action button', 'content'),
    (p_tenant_id, 'section_categories_title', 'Browse our rentals', 'Heading above the categories section', 'content'),
    (p_tenant_id, 'section_featured_title', 'Featured rentals', 'Heading above the featured items section', 'content'),
    (p_tenant_id, 'trust_delivery', 'Free Delivery — Within local service area', 'Trust badge 1 (left)', 'content'),
    (p_tenant_id, 'trust_cleaned', 'Cleaned & Sanitized — Every unit, every rental', 'Trust badge 2 (middle)', 'content'),
    (p_tenant_id, 'trust_rating', '5-Star Rated — Trusted by local families', 'Trust badge 3 (right)', 'content'),
    (p_tenant_id, 'footer_description', 'Rentals delivered to your door. Setup, takedown, and clean-up included.', 'Short description shown in the footer', 'content'),

    -- ─── APPEARANCE (colors, fonts) ───────────────────────────────────
    (p_tenant_id, 'hero_bg_color', '', 'Hero background CSS color (empty = use default)', 'appearance'),
    (p_tenant_id, 'hero_text_color', '', 'Hero text CSS color', 'appearance'),
    (p_tenant_id, 'hero_font_family', '', 'Hero font family override', 'appearance'),
    (p_tenant_id, 'categories_bg_color', '', 'Categories section background', 'appearance'),
    (p_tenant_id, 'categories_text_color', '', 'Categories section text color', 'appearance'),
    (p_tenant_id, 'categories_font_family', '', 'Categories font family', 'appearance'),
    (p_tenant_id, 'featured_bg_color', '', 'Featured section background', 'appearance'),
    (p_tenant_id, 'featured_text_color', '', 'Featured section text color', 'appearance'),
    (p_tenant_id, 'featured_font_family', '', 'Featured font family', 'appearance'),
    (p_tenant_id, 'trust_bg_color', '', 'Trust badges section background', 'appearance'),
    (p_tenant_id, 'trust_text_color', '', 'Trust badges section text color', 'appearance'),
    (p_tenant_id, 'trust_font_family', '', 'Trust badges font family', 'appearance'),
    (p_tenant_id, 'footer_bg_color', '', 'Footer background', 'appearance'),
    (p_tenant_id, 'footer_text_color', '', 'Footer text color', 'appearance'),
    (p_tenant_id, 'footer_font_family', '', 'Footer font family', 'appearance'),
    (p_tenant_id, 'site_font_family', 'Quicksand', 'Default site-wide font family', 'appearance'),
    (p_tenant_id, 'site_font_google_url', 'https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap', 'Google Fonts URL for the site font', 'appearance'),
    (p_tenant_id, 'site_font_self_hosted_url', '', 'Self-hosted font file URL (overrides Google font when set)', 'appearance')
  on conflict (tenant_id, key) do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

grant execute on function public.seed_default_site_settings(uuid) to service_role;

-- Backfill every existing tenant (only inserts missing keys; existing
-- customized values are left alone thanks to on conflict do nothing).
do $$
declare
  t record;
  n int;
begin
  for t in select id, business_name from public.tenants loop
    n := public.seed_default_site_settings(t.id);
    raise notice 'seeded % missing site_settings for tenant % (%)', n, t.business_name, t.id;
  end loop;
end $$;

notify pgrst, 'reload schema';
