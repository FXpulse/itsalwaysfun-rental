-- ─────────────────────────────────────────────────────────────────────────
-- TENANT BRANDING STORAGE BUCKET
-- ─────────────────────────────────────────────────────────────────────────
-- Public bucket for tenant logos. Each tenant uploads at:
--   tenants/{tenant_id}/logo.{ext}
-- The public URL is then used in tenant.branding.logo_url (jsonb)
-- and rendered on their public site header + login page + emails.
--
-- Public bucket = anyone can read (logos are public anyway). Only
-- authenticated admins of the tenant can upload/replace/delete.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('tenant-branding', 'tenant-branding', true)
on conflict (id) do nothing;

-- Public read (logos appear on customer-facing pages, including anon)
drop policy if exists "public reads tenant branding" on storage.objects;
create policy "public reads tenant branding"
  on storage.objects for select
  using (bucket_id = 'tenant-branding');

-- Authenticated user can write only to their own tenant's folder.
-- Folder path is "tenants/{tenant_id}/...", so the second segment must
-- match a tenant_id where the user has an active admin user_roles row.
drop policy if exists "tenant admin uploads branding" on storage.objects;
create policy "tenant admin uploads branding"
  on storage.objects for insert
  with check (
    bucket_id = 'tenant-branding'
    and (storage.foldername(name))[1] = 'tenants'
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.is_active = true
        and ur.role = 'admin'
        and ur.tenant_id::text = (storage.foldername(name))[2]
    )
  );

drop policy if exists "tenant admin updates branding" on storage.objects;
create policy "tenant admin updates branding"
  on storage.objects for update
  using (
    bucket_id = 'tenant-branding'
    and (storage.foldername(name))[1] = 'tenants'
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.is_active = true
        and ur.role = 'admin'
        and ur.tenant_id::text = (storage.foldername(name))[2]
    )
  );

drop policy if exists "tenant admin deletes branding" on storage.objects;
create policy "tenant admin deletes branding"
  on storage.objects for delete
  using (
    bucket_id = 'tenant-branding'
    and (storage.foldername(name))[1] = 'tenants'
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.is_active = true
        and ur.role = 'admin'
        and ur.tenant_id::text = (storage.foldername(name))[2]
    )
  );

-- Service role bypasses RLS, so server-side actions (createAdminClient)
-- can upload on behalf of any tenant when needed.

notify pgrst, 'reload schema';
