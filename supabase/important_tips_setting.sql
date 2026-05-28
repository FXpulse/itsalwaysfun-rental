-- Important tips / reminders shown to customers in 3 places:
--   1. Booking confirmation email (template appends {{importantTips}})
--   2. Quote email (template appends {{importantTips}})
--   3. /info public page (rendered as a tips section)
--
-- Each tenant edits their own text at /admin/site. Saved as plain text
-- with line breaks — templates that consume it should escape HTML.

insert into public.site_settings (tenant_id, key, value, description, category)
select
  t.id,
  'important_tips',
  E'A few tips and reminders:\n\n'
  || E'1) We accept cash, checks, and credit cards. If paying with cash, please note that our drivers don''t carry change. Payment is due at time of setup.\n\n'
  || E'2) Please call our office if you have stairs or a tiered backyard, so we can discuss setup options.\n\n'
  || E'3) We can set up on most surfaces but not rocks or sticker patches of any kind. If this type of topography is all you have, please rent "tarping 3" thick" under concessions and add-ons and/or tarp 3" thick before our delivery/setup. Please call us if you are unsure.\n\n'
  || E'4) All inflatable units MUST be staked in the ground for safety. If this is not possible, you will need to select jumper placement to be around secure items that we can tie off to, i.e. telephone poles, fence posts, etc. The unit must be secured on at least 3 corners.\n\n'
  || E'5) We will email or text you the day before your event with a setup time (we sometimes have to arrive very early to get all of the jumps out on time but we do not charge for the extra time).\n\n'
  || E'6) Please call as early as possible if you need to cancel for weather or any other reason. Once we''ve set up, we do not give refunds for any reason including weather. Please see the FAQ and Policies pages on our web site.\n\n'
  || E'7) If your event will be at a park, please tell us. It affects our scheduling and your pricing. You will need to either provide electricity within 50´ or rent a generator which we can provide at an additional cost.\n\n'
  || E'We want your party to go as smoothly as possible. Please call if you have any questions.',
  'Customer-facing policies + reminders. Shown on the booking confirmation email, quote email, and /info public page. Edit to match your business.',
  'content'
from public.tenants t
on conflict (tenant_id, key) do nothing;
