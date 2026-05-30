-- supabase/tenant_home_sections.sql
--
-- Optional sections tenants can toggle on/off on their public home page.
-- Each section has a type (key) and a JSONB content blob with that type's
-- fields. Rendering happens at app/(public)/page.tsx — sections render in
-- display_order if enabled.
--
-- Supported types (MVP):
--   - stats_banner    — 3 stats (number + label)
--   - why_us          — 3 feature cards (icon + title + body)
--   - cta_banner      — single CTA with title + button text + link
--   - custom_html     — raw HTML block for power users

create table if not exists public.tenant_home_sections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  section_type text not null,        -- 'stats_banner' | 'why_us' | 'cta_banner' | 'custom_html'
  is_enabled boolean default true,
  display_order int default 100,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (tenant_id, section_type)
);

create index tenant_home_sections_tenant_idx on tenant_home_sections (tenant_id, is_enabled, display_order);

alter table tenant_home_sections enable row level security;

create policy "service_role_full_access" on tenant_home_sections
  for all using (auth.role() = 'service_role');

-- Public can READ enabled sections (so they render on public site)
create policy "public_read_enabled" on tenant_home_sections
  for select using (is_enabled = true);

-- Tenant members can manage
create policy "tenant_members_full" on tenant_home_sections
  for all using (
    tenant_id in (
      select tenant_id from user_roles
      where user_id = auth.uid() and is_active = true
    )
  );
