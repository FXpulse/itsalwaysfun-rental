-- Create a PRIVATE bucket for W9 forms (contains SSN — must NOT be public).
-- Access only via signed URLs generated server-side, admin-only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'w9-forms',
  'w9-forms',
  false,                                          -- PRIVATE
  10 * 1024 * 1024,                               -- 10 MB max
  array['application/pdf','image/jpeg','image/png']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10 * 1024 * 1024,
  allowed_mime_types = array['application/pdf','image/jpeg','image/png'];

-- RLS policies for the bucket
-- Drop existing if any (idempotent re-run)
drop policy if exists "Users upload own W9" on storage.objects;
drop policy if exists "Users read own W9" on storage.objects;
drop policy if exists "Admin read all W9" on storage.objects;
drop policy if exists "Admin delete W9" on storage.objects;

-- Users can upload their own W9 (path prefixed with their user_id)
create policy "Users upload own W9"
  on storage.objects for insert
  with check (
    bucket_id = 'w9-forms'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own W9
create policy "Users read own W9"
  on storage.objects for select
  using (
    bucket_id = 'w9-forms'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can read all W9s
create policy "Admin read all W9"
  on storage.objects for select
  using (
    bucket_id = 'w9-forms'
    and public.is_admin(auth.uid())
  );

-- Admins can delete W9s (e.g. after 1099 filing, retention compliance)
create policy "Admin delete W9"
  on storage.objects for delete
  using (
    bucket_id = 'w9-forms'
    and public.is_admin(auth.uid())
  );
