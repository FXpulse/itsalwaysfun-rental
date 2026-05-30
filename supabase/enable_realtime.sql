-- supabase/enable_realtime.sql
--
-- Enable Supabase Realtime replication on the tables the operator panel
-- subscribes to. Run once in Supabase SQL Editor.
--
-- IDEMPOTENT: safe to re-run. Each ADD TABLE is guarded against the
-- "already member of publication" error (42710) so partial prior runs
-- don't break.

do $$
declare
  t text;
  pub_tables text[] := array[
    'tenants',
    'support_tickets',
    'lead_magnet_signups',
    'email_threads',
    'contact_messages'
  ];
begin
  foreach t in array pub_tables loop
    -- Skip if already member
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
      raise notice 'Added % to supabase_realtime', t;
    else
      raise notice 'Skipping % (already in publication)', t;
    end if;
  end loop;
end $$;
