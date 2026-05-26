-- Admin replies to contact form messages — sent via Resend, logged here for
-- history. Lets the admin reply directly from /admin/inbox without leaving
-- the app and keeps a paper trail of every response sent.

create table if not exists public.contact_message_replies (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.contact_messages(id) on delete cascade,
  body text not null,
  sent_by text not null,                  -- admin email who sent it
  resend_email_id text,                   -- Resend's email id for tracking
  send_error text,                        -- if delivery failed
  sent_at timestamptz not null default now()
);

create index if not exists contact_message_replies_msg_idx
  on public.contact_message_replies(message_id, sent_at);

alter table public.contact_message_replies enable row level security;

drop policy if exists "staff_or_admin read replies" on public.contact_message_replies;
create policy "staff_or_admin read replies"
  on public.contact_message_replies for select
  using (public.is_staff_or_admin(auth.uid()));

drop policy if exists "admin manage replies" on public.contact_message_replies;
create policy "admin manage replies"
  on public.contact_message_replies for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
