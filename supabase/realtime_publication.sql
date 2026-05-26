-- Enable Supabase Realtime broadcasts for tables we want the admin dashboard
-- to listen on. Each INSERT pushes a notification to subscribed clients in
-- under 1 second. RLS still applies — admin/staff can subscribe because
-- their policies on each table allow SELECT for their role.

-- Add tables to the realtime publication (idempotent)
alter publication supabase_realtime add table public.contact_messages;
alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.payout_requests;
alter publication supabase_realtime add table public.coi_requests;

-- Note: if any of these tables are already in the publication, the ALTER
-- statement above will error. In that case, re-run only the ones that
-- aren't already there. Check current publication with:
--   select tablename from pg_publication_tables where pubname='supabase_realtime';
