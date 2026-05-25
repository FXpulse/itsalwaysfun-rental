-- 2 new emails (refund + cancellation) + customer_confirmed_at column on bookings.

alter table public.bookings
  add column if not exists customer_confirmed_at timestamptz;

-- Allow new email types in the existing booking_emails_sent constraint
alter table public.booking_emails_sent
  drop constraint if exists booking_emails_sent_email_type_check;

alter table public.booking_emails_sent
  add constraint booking_emails_sent_email_type_check
  check (email_type in (
    'booking_confirmation',
    'booking_reminder_3d',
    'booking_review_request',
    'booking_anniversary_1y',
    'booking_refunded',
    'booking_cancelled'
  ));

-- Seed 2 new templates
insert into public.email_templates (key, label, description, subject, email_title, body_html, body_text, available_vars) values

('booking_refunded',
 'Refund issued',
 'Fires when admin clicks "Refund payment" on a paid booking',
 'Refund processed: ${{refundAmount}} for {{productName}}',
 'Refund Processed',
 '<p>Hi {{firstName}},</p>
<p>Your refund has been processed for the {{productName}} rental originally scheduled for {{eventDate}}.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f0fdf4;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #10b981;">
  <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Refund amount</td><td style="padding:4px 0;text-align:right;color:#059669;font-size:20px;font-weight:bold;">${{refundAmount}}</td></tr>
  <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Method</td><td style="padding:4px 0;text-align:right;">{{refundMethod}}</td></tr>
  <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Rental</td><td style="padding:4px 0;text-align:right;">{{productName}}</td></tr>
</table>
<p><strong>Timeline:</strong></p>
<ul>
  <li><strong>Credit card refunds:</strong> typically appear within 5-10 business days, depending on your bank</li>
  <li><strong>Manual refunds (cash / Venmo / Zelle):</strong> handled separately — check your account</li>
</ul>
<p>If you don''t see it within 10 business days, reply to this email or call (904) 584-3047 and we''ll look into it together.</p>
<p>Hope to see you at another event soon!</p>
<p>— The It''s Always Fun team</p>',
 'Hi {{firstName}},

Your refund has been processed for the {{productName}} rental ({{eventDate}}).

Refund amount: ${{refundAmount}}
Method: {{refundMethod}}

Credit card refunds appear within 5-10 business days.
Manual refunds (cash/Venmo/Zelle) handled separately.

Questions? Reply or call (904) 584-3047.

— The It''s Always Fun team',
 ARRAY['firstName','productName','eventDate','refundAmount','refundMethod']),

('booking_cancelled',
 'Booking cancelled',
 'Fires when a booking is cancelled (admin OR customer)',
 'Your booking for {{eventDate}} has been cancelled',
 'Booking Cancelled',
 '<p>Hi {{firstName}},</p>
<p>This is a confirmation that your booking for <strong>{{productName}}</strong> on <strong>{{eventDate}}</strong> has been cancelled.</p>
{{#if cancellationReason}}
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#fef2f2;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #ef4444;">
  <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Reason</td><td style="padding:4px 0;text-align:right;">{{cancellationReason}}</td></tr>
</table>
{{/if}}
{{#if hadPayment}}
<p><strong>About your payment:</strong></p>
<p>We''re processing your refund now. You''ll receive a separate confirmation email when it''s issued. Credit card refunds typically appear within 5-10 business days.</p>
{{/if}}
<p>Plans changed? We''d love to have you back when you''re ready — browse our rentals anytime.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;"><tr><td style="background:#1a1a6e;border-radius:6px;"><a href="{{bookAgainUrl}}" style="display:inline-block;color:#ffffff;font-weight:bold;font-size:14px;padding:10px 24px;text-decoration:none;">Browse rentals →</a></td></tr></table>
<p>Questions? Reply or call (904) 584-3047.</p>
<p>— The It''s Always Fun team</p>',
 'Hi {{firstName}},

Your booking for {{productName}} on {{eventDate}} has been cancelled.
{{#if cancellationReason}}
Reason: {{cancellationReason}}
{{/if}}
{{#if hadPayment}}
A refund is being processed — you''ll receive a separate email when it''s issued.
{{/if}}
Browse rentals anytime: {{bookAgainUrl}}

Questions? Reply or call (904) 584-3047.

— The It''s Always Fun team',
 ARRAY['firstName','productName','eventDate','cancellationReason','hadPayment','bookAgainUrl'])

on conflict (key) do nothing;
