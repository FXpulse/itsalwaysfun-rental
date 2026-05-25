-- Track which scheduled emails have been sent per booking (avoids duplicates).
create table if not exists public.booking_emails_sent (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  email_type text not null check (email_type in (
    'booking_confirmation',     -- fires immediately after payment
    'booking_reminder_3d',      -- 3 days before event
    'booking_review_request',   -- 1 day after event
    'booking_anniversary_1y'    -- 365 days after created_at
  )),
  sent_at timestamptz not null default now(),
  resend_id text,
  success boolean not null default true,
  error_message text,
  unique (booking_id, email_type)
);

create index if not exists booking_emails_booking_idx on public.booking_emails_sent(booking_id);
create index if not exists booking_emails_type_idx on public.booking_emails_sent(email_type);

-- Seed the 4 new email templates (idempotent — won't duplicate existing keys)
insert into public.email_templates (key, label, description, subject, email_title, body_html, body_text, available_vars) values

-- 1) BOOKING CONFIRMATION (fires immediately on payment success)
('booking_confirmation',
 'Booking confirmation',
 'Fires right after payment success — confirms the rental details',
 '✓ Booking confirmed: {{productName}} on {{eventDate}}',
 'Booking Confirmed!',
 '<p>Hi {{firstName}},</p>
<p>Your rental is locked in! Here''s what to expect:</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;">
  <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Rental</td><td style="padding:4px 0;text-align:right;font-weight:bold;">{{productName}}</td></tr>
  <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Event date</td><td style="padding:4px 0;text-align:right;font-weight:bold;">{{eventDate}}</td></tr>
  {{#if startTime}}<tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Time</td><td style="padding:4px 0;text-align:right;">{{startTime}} – {{endTime}}</td></tr>{{/if}}
  <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Address</td><td style="padding:4px 0;text-align:right;">{{address}}</td></tr>
  <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Total paid</td><td style="padding:4px 0;text-align:right;color:#1a1a6e;font-size:18px;font-weight:bold;">${{totalDollars}}</td></tr>
</table>
<p><strong>What''s next:</strong></p>
<ul>
  <li>We''ll text you 1-2 days before to coordinate delivery time</li>
  <li>Make sure the setup area is clear and accessible</li>
  {{#if needsPowerSupply}}<li>Power Supply is included — we''ll bring the generator</li>{{/if}}
</ul>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;"><tr><td style="background:#1a1a6e;border-radius:6px;"><a href="{{bookingPortalUrl}}" style="display:inline-block;color:#ffffff;font-weight:bold;font-size:15px;padding:12px 28px;text-decoration:none;">View booking details →</a></td></tr></table>
<p>Need to change anything? Reply to this email or call (904) 584-3047.</p>
<p>— The It''s Always Fun team</p>',
 'Hi {{firstName}},

Your rental is locked in!

Rental: {{productName}}
Event date: {{eventDate}}
{{#if startTime}}Time: {{startTime}} – {{endTime}}
{{/if}}Address: {{address}}
Total paid: ${{totalDollars}}

What''s next:
- We''ll text you 1-2 days before to coordinate delivery
- Make sure the setup area is clear
{{#if needsPowerSupply}}- Power Supply included
{{/if}}
View details: {{bookingPortalUrl}}

— The It''s Always Fun team',
 ARRAY['firstName','productName','eventDate','startTime','endTime','address','totalDollars','needsPowerSupply','bookingPortalUrl']),

-- 2) REMINDER 3 DAYS BEFORE
('booking_reminder_3d',
 'Event reminder (3 days before)',
 'Fires 3 days before the event_date — friendly reminder to confirm details',
 '🎉 Your {{productName}} is coming in 3 days!',
 'See You Soon!',
 '<p>Hi {{firstName}},</p>
<p>Just a friendly reminder — your <strong>{{productName}}</strong> rental is in <strong>3 days</strong> on <strong>{{eventDate}}</strong>! 🎈</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#fffbea;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #FFD700;">
  <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Event date</td><td style="padding:4px 0;text-align:right;font-weight:bold;">{{eventDate}}</td></tr>
  {{#if startTime}}<tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Time</td><td style="padding:4px 0;text-align:right;">{{startTime}} – {{endTime}}</td></tr>{{/if}}
  <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Address</td><td style="padding:4px 0;text-align:right;">{{address}}</td></tr>
</table>
<p><strong>Quick pre-event checklist:</strong></p>
<ul>
  <li>Setup area is clear (we need ~3 feet of space around the inflatable)</li>
  <li>Path from truck to setup spot is unobstructed</li>
  <li>Lawn is mowed (if grass setup)</li>
  <li>Pets secured during delivery + pickup</li>
</ul>
<p>Need to reschedule or change anything? Reply or call (904) 584-3047 — we''ll sort it.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;"><tr><td style="background:#1a1a6e;border-radius:6px;"><a href="{{bookingPortalUrl}}" style="display:inline-block;color:#ffffff;font-weight:bold;font-size:15px;padding:12px 28px;text-decoration:none;">View booking →</a></td></tr></table>
<p>Can''t wait! 🎉</p>
<p>— The It''s Always Fun team</p>',
 'Hi {{firstName}},

Your {{productName}} rental is in 3 days on {{eventDate}}!
{{#if startTime}}Time: {{startTime}} – {{endTime}}
{{/if}}Address: {{address}}

Pre-event checklist:
- Setup area clear
- Path from truck unobstructed
- Lawn mowed (if grass)
- Pets secured during delivery + pickup

Need changes? Reply or call (904) 584-3047.

View booking: {{bookingPortalUrl}}

— The It''s Always Fun team',
 ARRAY['firstName','productName','eventDate','startTime','endTime','address','bookingPortalUrl']),

-- 3) REVIEW REQUEST 1 DAY AFTER
('booking_review_request',
 'Review request (1 day after event)',
 'Fires 1 day after event_date — asks for a Google review',
 'How was your {{productName}} party? 🌟',
 'How''d It Go?',
 '<p>Hi {{firstName}},</p>
<p>We hope your <strong>{{productName}}</strong> party was a blast on {{eventDate}}! 🎉</p>
<p>Quick favor — if you had a great experience, would you mind sharing a few words on Google? It takes 30 seconds and helps other Jacksonville families discover us.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;"><tr><td style="background:#FFD700;border-radius:6px;"><a href="{{googleReviewUrl}}" style="display:inline-block;color:#1a1a6e;font-weight:bold;font-size:16px;padding:14px 32px;text-decoration:none;">⭐ Leave a 30-second review →</a></td></tr></table>
<p>Wasn''t a 5-star experience? <a href="mailto:admin@itsalwaysfun.com" style="color:#1a1a6e;">Reply directly</a> and tell us what went wrong — we want to make it right.</p>
<p>And when you''re ready for round 2, we''d love to set up something even bigger 😄</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;"><tr><td style="background:#1a1a6e;border-radius:6px;"><a href="{{bookNextUrl}}" style="display:inline-block;color:#ffffff;font-weight:bold;font-size:14px;padding:10px 24px;text-decoration:none;">Browse rentals →</a></td></tr></table>
<p>Thank you for choosing us! 💛</p>
<p>— The It''s Always Fun team</p>',
 'Hi {{firstName}},

Hope your {{productName}} party was a blast on {{eventDate}}!

If you had a great experience, please leave us a quick Google review — takes 30 seconds and helps other Jacksonville families find us:
{{googleReviewUrl}}

Not 5-star? Reply directly and tell us what went wrong.

Ready for round 2? Browse rentals: {{bookNextUrl}}

— The It''s Always Fun team',
 ARRAY['firstName','productName','eventDate','googleReviewUrl','bookNextUrl']),

-- 4) ANNIVERSARY 1 YEAR LATER
('booking_anniversary_1y',
 'Anniversary reminder (1 year after booking)',
 'Fires 365 days after the booking was created — re-engagement / book again',
 'One year ago you booked with us — time to celebrate again? 🎂',
 'A Year Ago Today!',
 '<p>Hi {{firstName}},</p>
<p>One year ago today you booked a <strong>{{productName}}</strong> with us for your event on {{lastEventDate}}. Wild how time flies! 🎉</p>
<p>Birthdays, summer parties, anniversaries — if you''re planning something special this year, we''d love to be part of it again.</p>
{{#if loyaltyCode}}
<div style="background:linear-gradient(135deg,#1a1a6e 0%,#1a1a6e 100%);border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
  <div style="font-size:11px;color:#FFD700;text-transform:uppercase;letter-spacing:2px;font-weight:bold;">Welcome back gift</div>
  <div style="background:#FFD700;color:#1a1a6e;font-family:monospace;font-weight:bold;font-size:20px;padding:8px 16px;border-radius:6px;margin:8px 0;display:inline-block;">{{loyaltyCode}}</div>
  <div style="color:rgba(255,255,255,0.85);font-size:13px;">Use this code at checkout for a special returning-customer discount.</div>
</div>
{{/if}}
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;"><tr><td style="background:#1a1a6e;border-radius:6px;"><a href="{{bookAgainUrl}}" style="display:inline-block;color:#ffffff;font-weight:bold;font-size:15px;padding:12px 28px;text-decoration:none;">Book your next rental →</a></td></tr></table>
<p>We''d love to see you again!</p>
<p>— The It''s Always Fun team</p>',
 'Hi {{firstName}},

One year ago today you booked a {{productName}} with us for {{lastEventDate}}!

If you''re planning something special this year, we''d love to be part of it again.
{{#if loyaltyCode}}
Welcome back code: {{loyaltyCode}}
{{/if}}
Book again: {{bookAgainUrl}}

— The It''s Always Fun team',
 ARRAY['firstName','productName','lastEventDate','loyaltyCode','bookAgainUrl'])

on conflict (key) do nothing;
