-- Contact form inbox — persists every /contact submission so messages don't
-- vanish if GHL webhook or Resend email fails. Admin manages from /admin/inbox.

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  message text not null,
  source text not null default 'website-contact',
  -- Delivery audit
  emailed_to_admin_at timestamptz,
  ghl_webhook_fired_at timestamptz,
  ghl_webhook_error text,
  -- Admin workflow
  is_resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by text,
  admin_notes text,
  created_at timestamptz not null default now()
);

create index if not exists contact_messages_unresolved_idx
  on public.contact_messages(is_resolved, created_at desc)
  where is_resolved = false;
create index if not exists contact_messages_email_idx
  on public.contact_messages(email);

alter table public.contact_messages enable row level security;

drop policy if exists "staff_or_admin read contact messages" on public.contact_messages;
create policy "staff_or_admin read contact messages"
  on public.contact_messages for select
  using (public.is_staff_or_admin(auth.uid()));

drop policy if exists "admin manage contact messages" on public.contact_messages;
create policy "admin manage contact messages"
  on public.contact_messages for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
