-- Weather-related cancellation policy.
-- Customer can self-cancel from /portal up to N hours before event if weather
-- is unsafe (rain, wind, lightning). System auto-issues a gift card credit
-- for the amount paid (less prior discounts), preserving revenue + letting the
-- customer rebook.

-- ── Add audit columns to bookings ──────────────────────────────
alter table public.bookings
  add column if not exists cancelled_due_to_weather boolean not null default false,
  add column if not exists weather_credit_gift_card_id uuid references public.gift_cards(id) on delete set null,
  add column if not exists weather_credit_cents int not null default 0 check (weather_credit_cents >= 0);

create index if not exists bookings_weather_cancel_idx
  on public.bookings(cancelled_due_to_weather) where cancelled_due_to_weather = true;

-- ── Settings ───────────────────────────────────────────────────
insert into public.site_settings (key, value, description, category) values
  (
    'weather_cancellation_enabled',
    'true',
    'Let customers self-cancel via /portal due to unsafe weather. Auto-issues a gift card credit for the paid amount.',
    'cancellation'
  ),
  (
    'weather_cancellation_cutoff_hours',
    '6',
    'Minimum hours before event start that weather cancellation is allowed. Default 6 (so customer can decide morning-of). Setting to 24 means it closes the day before.',
    'cancellation'
  ),
  (
    'weather_cancellation_policy_text',
    E'If weather conditions on your event day are unsafe (sustained winds 15+ mph, lightning within 6 miles, or heavy rain), you can self-cancel from your booking page up to 6 hours before your event start time. We''ll issue you a gift card credit for the full amount you paid, valid for 1 year, that you can apply to any future rental.\n\nWhy a credit instead of a refund? Weather days are still scheduled days for our crew. Issuing a credit lets us keep the lights on AND lets you reschedule with no hassle — same equipment, your choice of date.\n\nAfter the cutoff (less than 6h before event), call us at (904) 584-3047 — we''ll work something out case-by-case based on conditions.',
    'Policy text shown to customers in their portal + on the public Terms page.',
    'cancellation'
  )
on conflict (key) do nothing;
