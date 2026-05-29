# /superadmin Email Management — Design Spec

**Date:** 2026-05-29
**Status:** Approved by Ludmila — ready for implementation plan
**URL:** `https://getrentalflow.com/superadmin/email/*`
**Scope:** MVP + Folders + Bulk archive + Labels + Rules (all in one phase, ~7 days)

## 1. Purpose

A multi-account email management surface inside the RentalFlow operator panel (`/superadmin/email`). Operator can:
- Read incoming mail across all registered RentalFlow accounts (initially `info@getrentalflow.com`)
- Reply via SMTP from the same address that received the original
- Organize via folders (Sent / Drafts / Spam / Trash / custom), labels, and bulk actions
- Automate handling with a rules engine (apply label, move folder, mark read, auto-reply)

**Why it exists:**
- RentalFlow is starting cold outbound (10 leads sent 2026-05-29, ramping to 50/day). Replies will start landing in `info@getrentalflow.com`. Without an in-app inbox the operator either checks a webmail client (slow context switch) or misses replies.
- Brand separation: keeping RentalFlow operator email separate from IAF tenant email (`/admin/inbox`) avoids cross-contamination.

**What this explicitly is NOT:**
- Not a full email client (no compose-new, no forward, no attachments in MVP)
- Not an OAuth/Gmail integration — we use IMAP/SMTP credentials directly
- Not a replacement for the IAF tenant inbox at `/admin/inbox` (that stays on Cloudflare Email Worker + `contact_messages` table, untouched)
- Not real-time — sync runs every 5 min via cron, no IMAP IDLE

## 2. Architecture

### Routes (under `/superadmin/email/`)

| Route | Purpose |
|---|---|
| `/superadmin/email` | Inbox list across all active accounts, default folder = INBOX |
| `/superadmin/email/[threadId]` | Thread view + reply composer |
| `/superadmin/email/accounts` | List of email accounts |
| `/superadmin/email/accounts/new` | 5-step add-account wizard with live IMAP+SMTP test |
| `/superadmin/email/accounts/[id]/edit` | Edit account (cannot view password — "Change password" replaces it) |
| `/superadmin/email/labels` | Manage labels (create / edit color / delete) |
| `/superadmin/email/rules` | Manage rules (visual builder, no JSON) |

### Auth

All `/superadmin/email/*` routes require `role === 'superadmin'`. Validation server-side in each `page.tsx`. Ludmila is the only superadmin today.

### Read state — local-only, two-level

`is_read` lives on `email_messages` (per-message) AND `unread_count` is a denormalized counter on `email_threads`. Any state change (open a message, bulk mark, rule fires `mark_read`) updates BOTH inside a single transaction: flip `email_messages.is_read` + recompute `email_threads.unread_count` via subquery. Folder-level counters (`email_folders.unread_count`) are updated when thread unread_count crosses 0. Never marked on the IMAP server — see Section 5 on `BODY.PEEK`.

### Backend services

| Service | File | Purpose |
|---|---|---|
| IMAP sync cron | `app/api/cron/email-sync/route.ts` | Every 5 min. For each active account, fetch new messages across all folders, apply rules, store. |
| SMTP send endpoint | `app/api/superadmin/email/send/route.ts` | Receives reply, decrypts creds, sends via nodemailer, APPENDs copy to Sent folder, inserts outgoing message row. |
| IMAP wrapper | `lib/email/imap-client.ts` | Connect + LIST folders + SEARCH UID + FETCH + APPEND. Built on `imapflow`. |
| SMTP wrapper | `lib/email/smtp-client.ts` | Connect + send. Built on `nodemailer`. |
| Email parser | `lib/email/parser.ts` | Multipart MIME → text + HTML. Built on `mailparser`. |
| HTML sanitizer | `lib/email/sanitize.ts` | DOMPurify-server. Strip script tags, inline event handlers, dangerous attrs. |
| Encryption | `lib/email/encryption.ts` | AES-256-GCM. `EMAIL_ENCRYPTION_KEY` env var (32 bytes base64). |
| Rules engine | `lib/email/rules-engine.ts` | Evaluate conditions, apply actions. Called from cron after each new message stored. |

### Dependencies (new npm packages)

- `imapflow` — modern IMAP client with promises
- `nodemailer` — SMTP send
- `mailparser` — MIME parsing
- `isomorphic-dompurify` — HTML sanitization (server-side)

(`node:crypto` for AES is already built into Node.)

## 3. Database Schema

8 new tables. All in `supabase/superadmin_email.sql` migration.

```sql
-- ── 1. ACCOUNTS ──────────────────────────────────────────
create table public.email_accounts (
  id uuid primary key default gen_random_uuid(),
  brand text not null,              -- "rentalflow", "iaf", etc. — free text for filter
  label text not null,              -- "Main RentalFlow inbox"
  email_address text not null unique,
  -- IMAP
  imap_host text not null,
  imap_port integer not null default 993,
  imap_tls boolean not null default true,
  -- SMTP
  smtp_host text not null,
  smtp_port integer not null default 465,
  smtp_tls boolean not null default true,
  -- Auth (shared between IMAP + SMTP)
  username text not null,
  encrypted_password text not null,  -- base64(iv + ciphertext + auth_tag) AES-256-GCM
  -- Sync state
  last_sync_at timestamptz,
  last_synced_uid_per_folder jsonb default '{}'::jsonb,  -- {folder_path: max_uid}
  last_sync_error text,
  last_sync_error_at timestamptz,
  consecutive_failures integer default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index email_accounts_active_idx on email_accounts (is_active) where is_active;

-- ── 2. FOLDERS ──────────────────────────────────────────
create table public.email_folders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references email_accounts(id) on delete cascade,
  path text not null,               -- IMAP path, e.g. "INBOX", "INBOX.Sent", "Hot prospects"
  name text not null,               -- display name
  special_use text,                 -- "\\Sent", "\\Drafts", "\\Spam", "\\Trash", "\\Archive" or null for custom
  is_active boolean default true,
  unread_count integer default 0,
  message_count integer default 0,
  created_at timestamptz default now(),
  unique (account_id, path)
);
create index email_folders_account_idx on email_folders (account_id, is_active);

-- ── 3. THREADS ──────────────────────────────────────────
create table public.email_threads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references email_accounts(id) on delete cascade,
  folder_id uuid references email_folders(id) on delete set null,
  subject text,                     -- normalized (strip "Re:", "Fwd:")
  participants jsonb not null default '[]'::jsonb,  -- list of email addresses involved
  message_count integer default 0,
  unread_count integer default 0,
  last_message_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz default now()
);
create index email_threads_account_folder_idx on email_threads (account_id, folder_id, last_message_at desc);
create index email_threads_archived_idx on email_threads (account_id, archived_at);

-- ── 4. MESSAGES ─────────────────────────────────────────
create type email_direction as enum ('incoming', 'outgoing');

create table public.email_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references email_threads(id) on delete cascade,
  account_id uuid not null references email_accounts(id) on delete cascade,
  folder_id uuid references email_folders(id) on delete set null,
  direction email_direction not null,
  imap_uid integer,                 -- null for outgoing prior to APPEND
  message_id_header text,           -- RFC822 Message-ID
  in_reply_to text,                 -- for threading
  from_address text not null,
  to_addresses jsonb not null default '[]'::jsonb,
  cc_addresses jsonb default '[]'::jsonb,
  subject text,
  body_text text,
  body_html text,                   -- sanitized
  received_at timestamptz,
  sent_at timestamptz,
  is_read boolean default false,    -- local read state (NOT IMAP server-side)
  has_attachments boolean default false,
  raw_size_bytes integer,
  created_at timestamptz default now()
);
create index email_messages_thread_idx on email_messages (thread_id, received_at);
create index email_messages_account_uid_idx on email_messages (account_id, imap_uid);
create unique index email_messages_msgid_unique on email_messages (account_id, message_id_header)
  where message_id_header is not null;

-- ── 5. LABELS ───────────────────────────────────────────
create table public.email_labels (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references email_accounts(id) on delete cascade,
  name text not null,
  color text not null default '#6b7280',  -- hex
  created_at timestamptz default now(),
  unique (account_id, name)
);

create table public.email_thread_labels (
  thread_id uuid not null references email_threads(id) on delete cascade,
  label_id uuid not null references email_labels(id) on delete cascade,
  applied_at timestamptz default now(),
  primary key (thread_id, label_id)
);

-- ── 6. RULES ────────────────────────────────────────────
create table public.email_rules (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references email_accounts(id) on delete cascade,
  name text not null,
  priority integer not null default 100,  -- lower runs first
  condition_jsonb jsonb not null,         -- see Section 8 for shape
  action_jsonb jsonb not null,
  is_active boolean default true,
  last_run_at timestamptz,
  match_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index email_rules_active_priority_idx on email_rules (account_id, is_active, priority);

-- ── 7. AUDIT LOG ────────────────────────────────────────
create table public.email_audit_log (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references email_accounts(id) on delete set null,
  action text not null,            -- "read", "reply_sent", "archived", "rule_fired", etc.
  details_jsonb jsonb,
  user_email text,
  created_at timestamptz default now()
);
create index email_audit_account_created_idx on email_audit_log (account_id, created_at desc);

-- ── RLS ─────────────────────────────────────────────────
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
```

## 4. Encryption

Algorithm: **AES-256-GCM** via `node:crypto`.

Key: `EMAIL_ENCRYPTION_KEY` env var = 32 random bytes encoded base64. Generated once with `openssl rand -base64 32`. Stored in Vercel + backed up in Ludmila's password manager.

Helper API:
```ts
// lib/email/encryption.ts
export function encryptPassword(plaintext: string): string;
export function decryptPassword(encrypted: string): string;
```

The stored format is `base64(iv12 + ciphertext + tag16)`. Loss of `EMAIL_ENCRYPTION_KEY` = all stored credentials are unrecoverable (the operator must re-enter passwords).

Decryption only happens in memory at the moment of IMAP/SMTP connection. Cleartext is never persisted, never logged, never returned to the client.

## 5. IMAP Sync Cron

Runs every 5 minutes via `vercel.json` cron entry.

```
GET /api/cron/email-sync
  → for each is_active account:
       1. Connect IMAP (TLS 993)
       2. LIST mailboxes → upsert email_folders rows for this account
       3. For each active folder:
            a. SEARCH UID > last_synced_uid_per_folder[folder_path]
            b. FETCH (UID, FLAGS, BODY.PEEK[]) for each new UID
            c. Parse via mailparser
            d. Match-or-create email_thread (by Message-ID / In-Reply-To, fallback to subject normalization + participant set)
            e. Insert email_messages row (direction=incoming)
            f. Update last_synced_uid_per_folder[folder_path] = new max UID
            g. Apply rules engine to the new message (Section 8)
       4. Disconnect
       5. Update account.last_sync_at = NOW(), reset consecutive_failures
  → log to email_audit_log
```

We do NOT mark messages as Seen on the IMAP server (read state is local-only). This lets the operator continue using Outlook / Gmail forwarding without losing unread indicators there.

We use `BODY.PEEK[]` (the .PEEK variant) specifically to avoid the server setting \Seen flag.

### Error handling (per account)

| Failure | Recovery |
|---|---|
| Auth failed | `consecutive_failures++`. After 3 consecutive fails: disable account + send alert email to Ludmila. |
| Network timeout | Log to Sentry, leave state untouched, retry next cron tick. |
| Parse error on a single message | Skip just that message, continue with the rest, log to Sentry with `account_id + UID`. |
| Decryption failure | Disable account immediately, critical alert. Probably means `EMAIL_ENCRYPTION_KEY` rotated without re-encrypt. |
| DB write failure | Rollback transaction for that message, retry next cron tick. |

### Sentry monitoring

Cron wrapped in `Sentry.withMonitor("email-sync")` for missed-run alerts (matches existing pattern in `low-stock-alert/route.ts`).

## 6. SMTP Send

`POST /api/superadmin/email/send`

**Request:**
```json
{
  "thread_id": "uuid",
  "to": ["mike@bouncyhouse.com"],
  "cc": [],
  "subject": "Re: Quick question about Mike's Bouncers",
  "body_text": "Yes, here's the link...",
  "body_html": null
}
```

**Server flow:**
1. Auth: require superadmin role
2. Rate limit: 10 sends/min/user
3. Resolve account from thread_id → decrypt password
4. SMTP connect (TLS 465) via nodemailer
5. Send with proper headers (`In-Reply-To` from original `message_id_header`, `References` chain)
6. IMAP APPEND the sent message to the Sent folder (special_use=\Sent) so it's visible in Outlook later
7. Insert `email_messages` row (direction=outgoing, sent_at=NOW())
8. Update `email_threads.last_message_at`
9. Audit log entry
10. Return success

If SMTP send fails: return error, do NOT insert outgoing message row (no zombie messages).

If APPEND-to-Sent fails after successful SMTP: insert outgoing message row anyway, log warning. The recipient got it, only the operator's Sent folder is stale.

## 7. UI Pages

### 7.1 Inbox list (`/superadmin/email`)

- Sidebar with folders per account (Inbox, Sent, Drafts, Spam, Trash, custom folders, Archive)
- Top bar: account filter dropdown, label filter, search input (ILIKE on subject + from + to for MVP), Refresh-now button
- Thread list rows: read/unread dot, from/participants, subject, snippet, account + brand badge, date, label chips, checkbox for bulk
- Bulk action toolbar appears when ≥1 thread selected: Archive, Move to folder ▼, Apply label ▼, Mark as read, Mark as unread
- Pagination: 50 per page

### 7.2 Thread view (`/superadmin/email/[threadId]`)

- Header: subject, brand badge, account label, participants list, label chips (editable)
- Message list (chronological): from / to / date / sanitized body
- HTML emails rendered inside an iframe `sandbox="allow-popups"` to isolate styles + scripts (extra defense-in-depth on top of DOMPurify)
- Plain text in `<pre>` with word-wrap
- Reply form at the bottom:
  - From: auto (account that received the original)
  - To: auto (last incoming sender)
  - Subject: auto (Re: prefix)
  - Body: plain-text textarea
  - Auto-save draft to localStorage every 10s (keyed by thread_id)
  - Send button → POST to send endpoint

### 7.3 Accounts page (`/superadmin/email/accounts`)

- List of accounts with status indicators (✓ active, ⚠ sync error, ❌ disabled)
- Per row: email address, brand, label, last sync time, message count, edit/test/delete buttons
- "+ Add account" button → wizard

### 7.4 Add account wizard (`/superadmin/email/accounts/new`)

5 steps in a single client component with progress indicator:
1. **Brand + label** — text inputs
2. **Email address** — single input
3. **IMAP config** — host, port (993 default), username, password
4. **SMTP config** — host, port (465 default), "Same auth as IMAP" checkbox
5. **Test connection** — clicks live IMAP login + SMTP login, shows green ✓ or specific error. Only Save button appears if both pass.

Password never echoed back. On edit, separate "Change password" flow replaces (no plaintext show).

### 7.5 Labels page (`/superadmin/email/labels`)

- Per account: list labels with color swatch + name + thread count
- Inline edit (click row → edit name + color picker)
- Create new: name + color picker
- Delete: confirm dialog (cascade removes label assignments, threads remain)

### 7.6 Rules page (`/superadmin/email/rules`)

- Per account: list rules with priority order
- Drag handle to reorder priority
- Toggle is_active per rule
- "+ New rule" → visual builder modal
- Builder layout:
  ```
  WHEN  [Condition 1: field ▼  operator ▼  value]
  AND/OR
        [Condition 2: ...]   [+ Add condition]
  THEN  [Action 1: action ▼  param]
        [Action 2: ...]      [+ Add action]
  ```

Condition fields: `from`, `to`, `subject`, `body`, `has_attachment`
Condition operators: `contains`, `equals`, `starts_with`, `matches_regex`, `is_true`, `is_false`
Action types: `apply_label`, `move_to_folder`, `mark_read`, `mark_unread`, `archive`, `forward_to`, `auto_reply` (with template selector)

## 8. Rules Engine

`lib/email/rules-engine.ts`

Called by the cron once per new **incoming** message (direction='incoming'), after insert into `email_messages`. Rules do NOT run on outgoing messages — the operator controls those directly.

```
applyRules(message, account):
  rules = SELECT FROM email_rules WHERE account_id = account.id AND is_active ORDER BY priority ASC
  for rule in rules:
    if evaluateConditions(rule.condition_jsonb, message):
      for action in rule.action_jsonb.actions:
        executeAction(action, message)
      INSERT INTO email_audit_log (action="rule_fired", details={rule_id, message_id})
      UPDATE email_rules SET match_count++, last_run_at=NOW() WHERE id=rule.id
      if rule.stop_processing == true: break
```

### Condition JSON shape
```json
{
  "operator": "AND",
  "conditions": [
    { "field": "from", "op": "contains", "value": "@bouncyhouse.com" },
    { "field": "subject", "op": "contains", "value": "tell me more" }
  ]
}
```

### Action JSON shape
```json
{
  "actions": [
    { "type": "apply_label", "label_id": "uuid" },
    { "type": "move_to_folder", "folder_path": "Hot prospects" },
    { "type": "mark_unread" }
  ],
  "stop_processing": false
}
```

Builder UI converts user clicks to/from this JSON. No raw JSON exposed to user.

## 9. Privacy + Security

- All passwords AES-256-GCM encrypted at rest. Plaintext never logged, never persisted.
- IMAP/SMTP always TLS — non-TLS connections rejected.
- HTML sanitization (DOMPurify) + iframe sandbox isolation for email bodies. Defense in depth against XSS via crafted emails.
- Images in HTML emails: `loading="lazy"`. Optional toggle to enable image proxy (server-side fetch then serve) — deferred from MVP.
- Audit log on read, reply, archive, label apply, rule fire, account edit. For compliance + debugging.
- Rate limit on send: 10/min per user.
- All write operations go through server actions (no client-side direct Supabase write).
- Audit log + email_messages NEVER include the password column from email_accounts (separate select).

## 10. Out of Scope (Explicit YAGNI)

Deferred / not built:

- **Compose new email** (start a brand-new conversation) — reply-only in MVP
- **Forward** — operator can copy-paste body manually
- **Attachments** (read or write) — `has_attachments` flag tracked but body not extracted
- **OAuth** (Gmail / Microsoft 365) — IMAP/SMTP only
- **IMAP IDLE** for real-time push — polling-only
- **Full-text search** — simple ILIKE for MVP
- **Image proxy** for email body images — direct load with `loading="lazy"`
- **Realtime UI updates** when new mail arrives during a session — manual refresh
- **Multi-user assignment / collaborative inbox** — single operator
- **Snooze / scheduled-send / send later**
- **Email signatures stored per account** (operator pastes signature into reply body manually)
- **Server-side flag sync** (IMAP \Seen) — local read state only

## 11. Verification (definition of done)

- All migrations applied: `supabase/superadmin_email.sql` runs cleanly.
- `EMAIL_ENCRYPTION_KEY` set in Vercel env vars.
- Adding the `info@getrentalflow.com` account via wizard:
  - Live IMAP test passes (green ✓)
  - Live SMTP test passes (green ✓)
  - Account saved with encrypted password
- Within 5 min of saving: cron sync runs, folders appear (INBOX, Sent, etc.), existing messages start importing.
- Click any imported thread → bodies render correctly (HTML sanitized, plain wraps).
- Reply to a thread → SMTP send succeeds → recipient receives email → outgoing message visible in our Sent folder.
- Create a label → assign to a thread → thread shows the chip → filter by label works.
- Create a rule "if from contains @example.com then apply label X" → send test email from that domain → next cron run applies the label automatically.
- Bulk select 5 threads → Archive → all 5 disappear from Inbox, appear in Archive folder.
- All 8 tables present in DB, RLS policies attached.
- Sentry monitor "email-sync" is healthy after 24h of cron runs.

## 12. Implementation Order

Same pattern as the 1099-tracker plan — bottom-up, smallest commits, each step verifiable:

1. Migration: `supabase/superadmin_email.sql`
2. Generate + set `EMAIL_ENCRYPTION_KEY` env var (manual + documented)
3. `lib/email/encryption.ts` + vitest tests (round-trip, tamper detection)
4. Install npm deps: `imapflow`, `nodemailer`, `mailparser`, `isomorphic-dompurify` (single explicit install with versions pinned)
5. `lib/email/imap-client.ts` — connect, list folders, search, fetch, append
6. `lib/email/smtp-client.ts` — send + APPEND-to-Sent helper
7. `lib/email/parser.ts` — MIME → text/html/headers
8. `lib/email/sanitize.ts` — DOMPurify wrapper
9. `lib/email/rules-engine.ts` — condition evaluator + action executor + vitest tests for both
10. `app/api/cron/email-sync/route.ts` + `vercel.json` cron entry
11. `app/api/superadmin/email/send/route.ts`
12. `/superadmin/email/accounts/new` (add wizard, the dependency for everything else to be usable)
13. `/superadmin/email/accounts` (list page) + `/superadmin/email/accounts/[id]/edit` (edit page with Change-password flow)
14. `/superadmin/email` (inbox list — server component + ThreadListClient)
15. `/superadmin/email/[threadId]` (thread view + reply form)
16. `/superadmin/email/labels` page
17. `/superadmin/email/rules` page (builder modal)
18. Bulk action toolbar wiring
19. Sidebar update in `/superadmin/layout.tsx` (add Email nav item)
20. E2E smoke: add account, sync, read, reply, label, rule, bulk archive — all against live `info@getrentalflow.com`
21. Deploy + production verify
