-- Add commission payout threshold setting.
-- When a customer's commission_pending reaches this amount, admin sees a
-- highlight + GHL workflow can be triggered to notify them.
insert into public.site_settings (key, value, description, category) values
  ('commission_payout_threshold_cents', '5000', 'When a customer''s pending commission reaches this (in cents, $50 = 5000), admin gets flagged that they''re ready to pay out', 'loyalty')
on conflict (key) do nothing;
