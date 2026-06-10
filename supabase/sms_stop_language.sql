-- Twilio 10DLC compliance: every SMS template should include STOP/HELP
-- opt-out language. The previous seeds had it only on booking_review_request.
-- This adds short opt-out cues to the remaining 5 templates without bloating
-- segment counts (each SMS adds ~22 chars).
--
-- For brevity we use "Reply STOP to opt out" — short and recognized by Twilio's
-- auto-opt-out machinery (Twilio auto-blocks further messages to any number
-- that texts STOP/UNSUBSCRIBE/CANCEL/etc).

update public.email_templates
   set sms_body = sms_body || ' Reply STOP to opt out.'
 where key in (
   'booking_confirmation',
   'booking_reminder_3d',
   'booking_cancelled',
   'coi_ready',
   'gift_card_received'
 )
   and sms_body is not null
   and sms_body not like '%Reply STOP%';
