-- Add subject column for inbound emails (form submissions don't have a subject).
alter table public.contact_messages
  add column if not exists subject text;
