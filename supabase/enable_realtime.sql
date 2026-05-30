-- supabase/enable_realtime.sql
--
-- Enable Supabase Realtime replication on the tables the operator panel
-- subscribes to. Run once in Supabase SQL Editor.
--
-- After this runs, the /superadmin dashboard + activity stream get
-- toasts + auto-refresh when these tables change.

alter publication supabase_realtime add table public.tenants;
alter publication supabase_realtime add table public.support_tickets;
alter publication supabase_realtime add table public.lead_magnet_signups;
alter publication supabase_realtime add table public.email_threads;
alter publication supabase_realtime add table public.contact_messages;
