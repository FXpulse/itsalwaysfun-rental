-- Track when the 24h hold reminder email was sent so the cron doesn't
-- spam the customer multiple times before the hold expires.

alter table quotes
  add column if not exists hold_reminder_sent_at timestamptz;

comment on column quotes.hold_reminder_sent_at is
  'Set when the pre-expiry reminder email fires (cron sends ~6h before the booking hold expires). NULL means never sent. Allows the cron to be idempotent.';
