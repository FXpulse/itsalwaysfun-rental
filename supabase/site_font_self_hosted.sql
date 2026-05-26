-- Self-hosted custom font support for Louis George Cafe (or any uploaded .woff2/.ttf).
-- When set, the public layout emits an @font-face rule pointing at this URL instead
-- of loading from Google Fonts. Family name is shared with site_font_family.

insert into public.site_settings (key, value, description, category) values
  (
    'site_font_self_hosted_url',
    '',
    'URL of a self-hosted font file (.woff2/.woff/.ttf). When set, takes precedence over site_font_google_url and the public site loads it via @font-face. Use the admin upload button — do not edit by hand.',
    'appearance'
  )
on conflict (key) do nothing;
