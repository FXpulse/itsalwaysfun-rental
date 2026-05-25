-- Minimum booking lead time (hours). Customers can't book for dates within
-- this window. Default 48h. Editable in /admin/site under 'general' category.
insert into public.site_settings (key, value, description, category) values
  ('min_booking_lead_hours', '48', 'Minimum hours from now before a date is selectable in the public booking wizard. Default 48 = no bookings within 2 days. Set 0 to allow same-day bookings.', 'general')
on conflict (key) do nothing;
