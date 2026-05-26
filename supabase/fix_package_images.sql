-- Clear the placeholder Unsplash images on starter packages.
-- Some of the photo IDs in seed_starter_packages.sql may not resolve (the
-- IDs were guessed). Cleaner to start with no image and upload custom ones
-- via /admin/packages/[id] → Upload button → using prompts from
-- docs/package-image-prompts.md.

update public.packages
  set image_url = null
where slug in (
  'birthday-classic',
  'birthday-premium',
  'toddler-safe',
  'splash-summer',
  'backyard-bash',
  'family-reunion',
  'corporate-event',
  'princess-tea-party'
);
