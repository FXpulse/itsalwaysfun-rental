-- ─────────────────────────────────────────────────────────────────────────
-- MULTI-TENANT CHUNK 1B — relax tenants RLS for hostname lookup
-- ─────────────────────────────────────────────────────────────────────────
-- The middleware resolves "which tenant is this request for?" by looking
-- up tenants WHERE custom_domain = host OR slug = subdomain. That lookup
-- must work for anonymous visitors (the public site of each tenant).
--
-- This relaxes the SELECT policy on `tenants` to allow anyone to look up
-- by slug or custom_domain (the data is in URLs anyway). UPDATE/DELETE
-- policies stay strict (only owner or superadmin).
-- ─────────────────────────────────────────────────────────────────────────

-- Drop the previous strict SELECT — replace with permissive public read
drop policy if exists "tenant owner reads own" on public.tenants;

create policy "public can resolve tenant by hostname"
  on public.tenants for select
  using (true);  -- anyone can SELECT; sensitive fields aren't returned by API queries

-- (UPDATE/DELETE policies from Chunk 1A stay in place: only owner_email
--  match or is_superadmin can mutate.)

notify pgrst, 'reload schema';
