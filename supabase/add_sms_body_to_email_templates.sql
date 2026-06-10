-- Add sms_body column to email_templates so SMS bodies become editable
-- from /admin/email-templates, the same way email bodies already are.
--
-- Design choice: extend email_templates instead of creating sms_templates.
-- A "template" represents an event (booking_confirmation, booking_reminder_3d)
-- and an event may have both an email AND an SMS body. Keeping them in one
-- row means the admin edits both channels of an event in one screen.
--
-- The column is nullable — events without an SMS channel just leave it null
-- and scheduled-emails.ts skips SMS for that template.

alter table public.email_templates
  add column if not exists sms_body text;

-- Seed the two SMS bodies currently hardcoded in lib/email/scheduled-emails.ts.
-- We replace the IAF-specific "It's Always Fun" and "(904) 584-3047" with
-- {{businessName}} and {{businessPhone}} so future tenants get their own brand.

update public.email_templates
   set sms_body = '✓ Booking confirmed for {{productName}} on {{eventDate}}. We''ll text you 1-2 days before delivery to coordinate. — {{businessName}} {{businessPhone}}'
 where key = 'booking_confirmation'
   and sms_body is null;

update public.email_templates
   set sms_body = '🎉 Reminder: your {{productName}} rental is in 3 days ({{eventDate}})! We''ll text again 1-2 days before. Reply or call {{businessPhone}} if anything changes.'
 where key = 'booking_reminder_3d'
   and sms_body is null;
