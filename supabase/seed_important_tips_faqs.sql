-- Seed 7 customer-facing FAQs from the standard "Tips and reminders"
-- list (payment, stairs, surface, staking, setup time, cancellation,
-- park electricity). Each tenant gets a copy on first run. Idempotent
-- via unique (tenant_id, question).
--
-- Tenants can edit / delete / reorder via /admin/faqs.

insert into public.faqs (tenant_id, question, answer, display_order, is_active)
select t.id, v.question, v.answer, v.ord, true
from public.tenants t
cross join (values
  (
    'What payment methods do you accept?',
    'We accept cash, checks, and credit cards. If paying with cash, please note that our drivers don''t carry change. Payment is due at time of setup.',
    100
  ),
  (
    'I have stairs or a tiered backyard — what should I do?',
    'Please call our office before booking so we can discuss setup options. We may need extra time or equipment depending on your layout.',
    101
  ),
  (
    'Can you set up on any surface?',
    'We can set up on most surfaces — grass, dirt, concrete, paver, asphalt — but NOT on rocks or sticker patches of any kind. If this type of topography is all you have, please rent "tarping 3" thick" under concessions and add-ons and/or tarp 3" thick before our delivery/setup. Call us if you are unsure.',
    102
  ),
  (
    'How are inflatable units secured?',
    'For safety, ALL inflatable units MUST be staked in the ground. If staking is not possible (concrete, paver, etc.), you''ll need to place the jumper near secure items we can tie off to — telephone poles, fence posts, etc. The unit must be secured on at least 3 corners.',
    103
  ),
  (
    'When will I find out the setup time?',
    'We email or text you the day before your event with a setup time. We sometimes have to arrive very early to get all the jumps out on time, but we do not charge for the extra time.',
    104
  ),
  (
    'What is your cancellation / refund policy?',
    'Please call as early as possible if you need to cancel for weather or any other reason. Once we''ve set up, we do not give refunds for any reason — including weather. See our Policies page for full details.',
    105
  ),
  (
    'My event is at a park — anything I should know?',
    'Yes! Please tell us. It affects our scheduling and your pricing. You''ll need to either provide electricity within 50 feet, or rent a generator (we offer one for an additional cost).',
    106
  )
) as v(question, answer, ord)
on conflict (tenant_id, question) do nothing;
