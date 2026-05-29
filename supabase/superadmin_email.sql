-- supabase/superadmin_email.sql
--
-- /superadmin email management. Multi-account inbox with IMAP+SMTP backends.
-- Independent of tenant scope: this is RentalFlow operator-level email,
-- not customer-facing contact_messages.

-- ── ACCOUNTS ──
create table public.email_accounts (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  label text not null,
  email_address text not null unique,
  imap_host text not null,
  imap_port integer not null default 993,
  imap_tls boolean not null default true,
  smtp_host text not null,
  smtp_port integer not null default 465,
  smtp_tls boolean not null default true,
  username text not null,
  encrypted_password text not null,
  last_sync_at timestamptz,
  last_synced_uid_per_folder jsonb default '{}'::jsonb,
  last_sync_error text,
  last_sync_error_at timestamptz,
  consecutive_failures integer default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index email_accounts_active_idx on email_accounts (is_active) where is_active;

-- ── FOLDERS ──
create table public.email_folders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references email_accounts(id) on delete cascade,
  path text not null,
  name text not null,
  special_use text,
  is_active boolean default true,
  unread_count integer default 0,
  message_count integer default 0,
  created_at timestamptz default now(),
  unique (account_id, path)
);
create index email_folders_account_idx on email_folders (account_id, is_active);

-- ── THREADS ──
create table public.email_threads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references email_accounts(id) on delete cascade,
  folder_id uuid references email_folders(id) on delete set null,
  subject text,
  participants jsonb not null default '[]'::jsonb,
  message_count integer default 0,
  unread_count integer default 0,
  last_message_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz default now()
);
create index email_threads_account_folder_idx on email_threads (account_id, folder_id, last_message_at desc);
create index email_threads_archived_idx on email_threads (account_id, archived_at);

-- ── MESSAGES ──
do $$ begin
  create type email_direction as enum ('incoming', 'outgoing');
exception
  when duplicate_object then null;
end $$;

create table public.email_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references email_threads(id) on delete cascade,
  account_id uuid not null references email_accounts(id) on delete cascade,
  folder_id uuid references email_folders(id) on delete set null,
  direction email_direction not null,
  imap_uid integer,
  message_id_header text,
  in_reply_to text,
  from_address text not null,
  to_addresses jsonb not null default '[]'::jsonb,
  cc_addresses jsonb default '[]'::jsonb,
  subject text,
  body_text text,
  body_html text,
  received_at timestamptz,
  sent_at timestamptz,
  is_read boolean default false,
  has_attachments boolean default false,
  raw_size_bytes integer,
  created_at timestamptz default now()
);
create index email_messages_thread_idx on email_messages (thread_id, received_at);
create index email_messages_account_uid_idx on email_messages (account_id, imap_uid);
create unique index email_messages_msgid_unique on email_messages (account_id, message_id_header)
  where message_id_header is not null;

-- ── LABELS ──
create table public.email_labels (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references email_accounts(id) on delete cascade,
  name text not null,
  color text not null default '#6b7280',
  created_at timestamptz default now(),
  unique (account_id, name)
);

create table public.email_thread_labels (
  thread_id uuid not null references email_threads(id) on delete cascade,
  label_id uuid not null references email_labels(id) on delete cascade,
  applied_at timestamptz default now(),
  primary key (thread_id, label_id)
);

-- ── RULES ──
create table public.email_rules (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references email_accounts(id) on delete cascade,
  name text not null,
  priority integer not null default 100,
  condition_jsonb jsonb not null,
  action_jsonb jsonb not null,
  is_active boolean default true,
  last_run_at timestamptz,
  match_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index email_rules_active_priority_idx on email_rules (account_id, is_active, priority);

-- ── AUDIT LOG ──
create table public.email_audit_log (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references email_accounts(id) on delete set null,
  action text not null,
  details_jsonb jsonb,
  user_email text,
  created_at timestamptz default now()
);
create index email_audit_account_created_idx on email_audit_log (account_id, created_at desc);

-- ── RLS ──
alter table email_accounts        enable row level security;
alter table email_folders         enable row level security;
alter table email_threads         enable row level security;
alter table email_messages        enable row level security;
alter table email_labels          enable row level security;
alter table email_thread_labels   enable row level security;
alter table email_rules           enable row level security;
alter table email_audit_log       enable row level security;

create policy "service_role_full_access" on email_accounts        for all using (auth.role() = 'service_role');
create policy "service_role_full_access" on email_folders         for all using (auth.role() = 'service_role');
create policy "service_role_full_access" on email_threads         for all using (auth.role() = 'service_role');
create policy "service_role_full_access" on email_messages        for all using (auth.role() = 'service_role');
create policy "service_role_full_access" on email_labels          for all using (auth.role() = 'service_role');
create policy "service_role_full_access" on email_thread_labels   for all using (auth.role() = 'service_role');
create policy "service_role_full_access" on email_rules           for all using (auth.role() = 'service_role');
create policy "service_role_full_access" on email_audit_log       for all using (auth.role() = 'service_role');
