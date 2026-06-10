-- Extend SMS coverage to 4 more events:
--   booking_review_request, booking_cancelled, coi_ready, gift_card_received
--
-- gift_card_received needs a new recipient_phone column (the form previously
-- only captured recipient_email — we now ALSO capture phone optionally so
-- the recipient gets a quick SMS heads-up + a "check spam" reminder).

alter table public.gift_card_purchases
  add column if not exists recipient_phone text;

-- Seed SMS bodies. Vars come from each event's existing email var schema
-- plus auto-injected {{businessName}}, {{businessPhone}}, {{businessEmail}}.

update public.email_templates
   set sms_body = '🌟 How was your {{productName}} rental? Tap to leave a review — it really helps! Reply STOP to opt out. — {{businessName}}'
 where key = 'booking_review_request'
   and sms_body is null;

update public.email_templates
   set sms_body = 'Your {{productName}} booking on {{eventDate}} has been cancelled. Any payment will be refunded shortly. Questions? Call {{businessPhone}} — {{businessName}}'
 where key = 'booking_cancelled'
   and sms_body is null;

update public.email_templates
   set sms_body = '✓ Your Certificate of Insurance for {{venueName}} is ready! Check your email for the PDF (and spam folder if you don''t see it). — {{businessName}}'
 where key = 'coi_ready'
   and sms_body is null;

update public.email_templates
   set sms_body = '🎁 {{purchaserName}} sent you a ${{amount}} gift card from {{businessName}}! Code: {{code}}. Full details emailed — check spam too if you don''t see it.'
 where key = 'gift_card_received'
   and sms_body is null;
