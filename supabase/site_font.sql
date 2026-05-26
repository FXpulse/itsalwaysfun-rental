-- Global site font configuration.
-- Defaults to Quicksand (Google Fonts) — the closest free twin of Louis George Cafe.
-- Admin can swap to any Google Font by changing both keys to match.
-- Per-zone font overrides (hero_font_family etc.) still take precedence when set.

insert into public.site_settings (key, value, description, category) values
  (
    'site_font_family',
    'Quicksand',
    'Global font family applied to the entire public site. Common picks: Quicksand (Louis George Cafe twin), Inter, Poppins, Montserrat, Nunito, Playfair Display, Lora. Empty = system default.',
    'appearance'
  ),
  (
    'site_font_google_url',
    'https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap',
    'Google Fonts stylesheet URL for the site font. Leave empty if using a self-hosted font (then add @font-face manually). Must match site_font_family.',
    'appearance'
  )
on conflict (key) do nothing;
