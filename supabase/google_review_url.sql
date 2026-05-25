-- Google review URL — surfaced in the booking_review_request email.
-- Find yours at https://www.google.com/business → Reviews → Get more reviews → Share form
insert into public.site_settings (key, value, description, category) values
  ('google_review_url', '', 'Google review link sent in the post-event email (e.g. https://g.page/r/XXXXX/review)', 'business')
on conflict (key) do nothing;
