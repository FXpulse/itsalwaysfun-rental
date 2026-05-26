-- Global on/off toggle for the public Packages section.
-- When disabled: /packages public page shows "coming soon", "Packages" link
-- hidden from header nav. Per-package is_active toggles still control individual
-- visibility within an enabled section.

insert into public.site_settings (key, value, description, category) values
  (
    'packages_section_enabled',
    'true',
    'Show the public Packages section: /packages page + "Packages" link in the header nav. Per-package is_active toggles still control individual visibility within the section.',
    'general'
  )
on conflict (key) do nothing;
