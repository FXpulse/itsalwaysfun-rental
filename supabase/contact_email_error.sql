-- Capture admin email send errors on contact_messages so they're visible in
-- /admin/inbox (instead of only in Vercel server logs).

alter table public.contact_messages
  add column if not exists email_send_error text;
