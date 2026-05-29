# /superadmin Email Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-account email manager at `/superadmin/email/*` with IMAP/SMTP backends, folders, labels, bulk actions, and a rules engine. Read+Reply MVP. RentalFlow operator only — IAF tenant inbox untouched.

**Architecture:** Server-side IMAP sync every 5 min via cron, AES-256-GCM encrypted credentials in DB, SMTP send with APPEND-to-Sent, all UI under `/superadmin/email/*` gated by superadmin role. Threading by Message-ID + In-Reply-To headers with fallback to normalized subject + participant set.

**Tech Stack:** Next.js 14 App Router, Supabase Postgres, `imapflow`, `nodemailer`, `mailparser`, `isomorphic-dompurify`, vitest, node:crypto for AES.

**Spec:** `docs/superpowers/specs/2026-05-29-superadmin-email-design.md`

---

## File Map

**Create (24 files):**

| Path | Responsibility |
|---|---|
| `supabase/superadmin_email.sql` | 8 tables + indexes + RLS |
| `lib/email/encryption.ts` | AES-256-GCM encrypt/decrypt helpers |
| `lib/email/encryption.test.ts` | Round-trip + tamper-detection tests |
| `lib/email/imap-client.ts` | imapflow wrapper: connect, list, search, fetch, append |
| `lib/email/smtp-client.ts` | nodemailer wrapper: send + APPEND-to-Sent helper |
| `lib/email/parser.ts` | mailparser wrapper: MIME → {text, html, headers, attachments} |
| `lib/email/sanitize.ts` | DOMPurify wrapper for HTML email bodies |
| `lib/email/rules-engine.ts` | Condition evaluator + action executor |
| `lib/email/rules-engine.test.ts` | Unit tests for condition logic + action JSON shapes |
| `lib/email/types.ts` | Shared TS types (Account, Folder, Thread, Message, Label, Rule) |
| `app/api/cron/email-sync/route.ts` | 5-min cron: sync all active accounts |
| `app/api/superadmin/email/send/route.ts` | POST reply endpoint |
| `app/superadmin/email/page.tsx` | Inbox list (server component) |
| `app/superadmin/email/InboxClient.tsx` | Client wrapper with filters + bulk actions |
| `app/superadmin/email/[threadId]/page.tsx` | Thread view (server component) |
| `app/superadmin/email/[threadId]/ReplyForm.tsx` | Client reply composer |
| `app/superadmin/email/accounts/page.tsx` | Account list |
| `app/superadmin/email/accounts/new/page.tsx` | Add account wizard wrapper |
| `app/superadmin/email/accounts/new/AccountWizard.tsx` | 5-step client wizard |
| `app/superadmin/email/accounts/[id]/edit/page.tsx` | Edit account |
| `app/superadmin/email/labels/page.tsx` | Labels CRUD |
| `app/superadmin/email/rules/page.tsx` | Rules CRUD |
| `app/superadmin/email/rules/RuleBuilder.tsx` | Visual rule builder |
| `app/superadmin/email/actions.ts` | Server actions for thread/label/rule mutations |

**Modify (3 files):**
- `package.json` (Task 4 ONLY — installs 4 deps)
- `vercel.json` (add 1 cron entry)
- `app/superadmin/layout.tsx` (add Email nav item to sidebar)

**Manual user steps (Tasks 1, 3, 21):**
- Run SQL migration via `supabase db push`
- Generate + set `EMAIL_ENCRYPTION_KEY` env var in Vercel
- Live smoke test of the full flow with the `info@getrentalflow.com` credentials

---

## Task 1: Database migration

**Files:**
- Create: `supabase/superadmin_email.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Run the migration**

Two options. **Preferred** (uses the Supabase CLI Ludmila just linked):

```bash
supabase db push
```

Expected: prints `Applying migration` + final `Finished supabase db push`.

**Fallback** (manual via Supabase SQL editor):
1. Open Supabase Dashboard → SQL Editor → New query
2. Paste the contents of `supabase/superadmin_email.sql`
3. Click Run
4. Expected: `Success. No rows returned`

Verify with a count check:
```sql
select count(*) from public.email_accounts;
```
Expected: `0`.

- [ ] **Step 3: Commit**

```bash
git add supabase/superadmin_email.sql
git commit -m "DB: superadmin email management — 8 tables (accounts, folders, threads, messages, labels, rules, audit)"
```

---

## Task 2: Encryption helper + vitest tests

**Files:**
- Create: `lib/email/encryption.ts`
- Create: `lib/email/encryption.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/email/encryption.test.ts
import { describe, it, expect } from "vitest";

const KEY = "C2GhZ2lEnPlrXSPfWklJfLF3JJOZc9c0vJpvHkGjGqM="; // base64 32 bytes
process.env.EMAIL_ENCRYPTION_KEY = KEY;

// Import AFTER env var is set
import { encryptPassword, decryptPassword } from "./encryption";

describe("encryption", () => {
  it("round-trips a password", () => {
    const plain = "Il8bbf164";
    const ct = encryptPassword(plain);
    expect(ct).not.toBe(plain);
    expect(decryptPassword(ct)).toBe(plain);
  });

  it("produces different ciphertext each call (random IV)", () => {
    const a = encryptPassword("same-password");
    const b = encryptPassword("same-password");
    expect(a).not.toBe(b);
    expect(decryptPassword(a)).toBe("same-password");
    expect(decryptPassword(b)).toBe("same-password");
  });

  it("rejects tampered ciphertext", () => {
    const ct = encryptPassword("secret");
    // flip a byte in the middle (after the 12-byte IV)
    const buf = Buffer.from(ct, "base64");
    buf[20] = buf[20] ^ 0xff;
    const tampered = buf.toString("base64");
    expect(() => decryptPassword(tampered)).toThrow();
  });

  it("handles unicode + long passwords", () => {
    const plain = "Ñoño-密码-🎉-very-long-password-with-many-chars";
    expect(decryptPassword(encryptPassword(plain))).toBe(plain);
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

```bash
npx vitest run lib/email/encryption.test.ts
```
Expected: FAIL with `Cannot find module './encryption'`.

- [ ] **Step 3: Implement**

```ts
// lib/email/encryption.ts
//
// AES-256-GCM password encryption for stored IMAP/SMTP credentials.
//
// Stored format: base64(iv(12 bytes) + ciphertext + tag(16 bytes))
// Key source: EMAIL_ENCRYPTION_KEY env var = 32 bytes base64.
//
// If the key is rotated or lost, all stored credentials become unrecoverable
// — operators must re-enter passwords. Back up the key in a password manager.

import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const b64 = process.env.EMAIL_ENCRYPTION_KEY;
  if (!b64) {
    throw new Error("EMAIL_ENCRYPTION_KEY env var is not set");
  }
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error(
      `EMAIL_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length})`,
    );
  }
  return key;
}

export function encryptPassword(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ct, tag]).toString("base64");
}

export function decryptPassword(encrypted: string): string {
  const key = getKey();
  const buf = Buffer.from(encrypted, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("encrypted blob too short");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const ct = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}
```

- [ ] **Step 4: Run tests, confirm they pass**

```bash
npx vitest run lib/email/encryption.test.ts
```
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/email/encryption.ts lib/email/encryption.test.ts
git commit -m "email: AES-256-GCM encryption helper for stored credentials"
```

---

## Task 3: Generate + set EMAIL_ENCRYPTION_KEY env var (manual)

**No code files. Operator-driven.**

- [ ] **Step 1: Generate a fresh key**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
Copy the 44-char base64 output.

- [ ] **Step 2: Save to password manager**

Add a new entry in 1Password / Bitwarden / your password manager:
- Name: `EMAIL_ENCRYPTION_KEY (RentalFlow)`
- Value: the base64 string from step 1
- Note: "Loss = all stored IMAP/SMTP credentials are unrecoverable"

- [ ] **Step 3: Set in Vercel**

1. Vercel Dashboard → itsalwaysfun-rental project → Settings → Environment Variables
2. Add new:
   - Key: `EMAIL_ENCRYPTION_KEY`
   - Value: paste from password manager
   - Environments: ✅ Production, ✅ Preview
3. Save

- [ ] **Step 4: Redeploy**

Vercel will need a redeploy for the env var to take effect. Either trigger via the dashboard (Deployments → Redeploy) or wait until the next push after Task 4.

---

## Task 4: Install npm dependencies (the ONE task allowed to touch package.json)

**Files:**
- Modify: `package.json`, `package-lock.json` (automatically by npm install)

- [ ] **Step 1: Install with exact versions**

```bash
npm install imapflow@^1.0.171 nodemailer@^6.9.16 mailparser@^3.7.2 isomorphic-dompurify@^2.19.0
npm install --save-dev @types/nodemailer@^6.4.17 @types/mailparser@^3.4.5
```

Expected: `added N packages in Xs`. No warnings about peer dependency conflicts.

- [ ] **Step 2: Verify the new entries are in package.json**

```bash
grep -E "imapflow|nodemailer|mailparser|isomorphic-dompurify" package.json
```
Expected: 4 lines in `dependencies` + 2 lines in `devDependencies`.

- [ ] **Step 3: Verify nothing else changed**

```bash
git diff --stat package.json
git diff package.json | grep -E "^[+-]" | grep -v "^+++\|^---" | head -30
```
Expected: only ADD lines for the 6 new packages. Nothing removed, no version bumps of existing deps.

If any existing dep was bumped, `git checkout package.json package-lock.json` and re-run step 1 with `--save-exact` instead of `^`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: imapflow + nodemailer + mailparser + isomorphic-dompurify for email management"
```

---

## Task 5: Email types module

**Files:**
- Create: `lib/email/types.ts`

- [ ] **Step 1: Implement**

```ts
// lib/email/types.ts
// Shared TS types for the /superadmin email feature. No runtime code.

export interface EmailAccount {
  id: string;
  brand: string;
  label: string;
  email_address: string;
  imap_host: string;
  imap_port: number;
  imap_tls: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_tls: boolean;
  username: string;
  encrypted_password: string;
  last_sync_at: string | null;
  last_synced_uid_per_folder: Record<string, number>;
  last_sync_error: string | null;
  last_sync_error_at: string | null;
  consecutive_failures: number;
  is_active: boolean;
  created_at: string;
}

export interface EmailFolder {
  id: string;
  account_id: string;
  path: string;
  name: string;
  special_use: string | null;
  is_active: boolean;
  unread_count: number;
  message_count: number;
}

export interface EmailThread {
  id: string;
  account_id: string;
  folder_id: string | null;
  subject: string | null;
  participants: string[];
  message_count: number;
  unread_count: number;
  last_message_at: string | null;
  archived_at: string | null;
}

export interface EmailMessage {
  id: string;
  thread_id: string;
  account_id: string;
  folder_id: string | null;
  direction: "incoming" | "outgoing";
  imap_uid: number | null;
  message_id_header: string | null;
  in_reply_to: string | null;
  from_address: string;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: string | null;
  sent_at: string | null;
  is_read: boolean;
  has_attachments: boolean;
  raw_size_bytes: number | null;
}

export interface EmailLabel {
  id: string;
  account_id: string;
  name: string;
  color: string;
}

// Rules — JSON shapes used by rules-engine
export type RuleConditionField = "from" | "to" | "subject" | "body" | "has_attachment";
export type RuleConditionOp =
  | "contains" | "equals" | "starts_with" | "matches_regex"
  | "is_true" | "is_false";

export interface RuleConditionLeaf {
  field: RuleConditionField;
  op: RuleConditionOp;
  value?: string;
}

export interface RuleConditionGroup {
  operator: "AND" | "OR";
  conditions: RuleConditionLeaf[];
}

export type RuleActionType =
  | "apply_label" | "move_to_folder" | "mark_read" | "mark_unread"
  | "archive" | "forward_to" | "auto_reply";

export interface RuleAction {
  type: RuleActionType;
  label_id?: string;
  folder_path?: string;
  forward_to_address?: string;
  auto_reply_subject?: string;
  auto_reply_body?: string;
}

export interface RuleActionBlock {
  actions: RuleAction[];
  stop_processing: boolean;
}

export interface EmailRule {
  id: string;
  account_id: string;
  name: string;
  priority: number;
  condition_jsonb: RuleConditionGroup;
  action_jsonb: RuleActionBlock;
  is_active: boolean;
  last_run_at: string | null;
  match_count: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/email/types.ts
git commit -m "email: shared TS types module"
```

---

## Task 6: Rules engine + tests

**Files:**
- Create: `lib/email/rules-engine.ts`
- Create: `lib/email/rules-engine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/email/rules-engine.test.ts
import { describe, it, expect } from "vitest";
import { evaluateConditions } from "./rules-engine";
import type { EmailMessage, RuleConditionGroup } from "./types";

const baseMsg: EmailMessage = {
  id: "m1", thread_id: "t1", account_id: "a1", folder_id: null,
  direction: "incoming", imap_uid: 1, message_id_header: null, in_reply_to: null,
  from_address: "mike@bouncyhouse.com",
  to_addresses: ["info@getrentalflow.com"],
  cc_addresses: [],
  subject: "Re: Quick question about Mike's Bouncers",
  body_text: "Yes still using EventRentalSystems. Tell me more.",
  body_html: null,
  received_at: "2026-05-29T12:00:00Z", sent_at: null,
  is_read: false, has_attachments: false, raw_size_bytes: 1024,
};

describe("evaluateConditions", () => {
  it("returns true when single AND condition matches", () => {
    const cond: RuleConditionGroup = {
      operator: "AND",
      conditions: [{ field: "from", op: "contains", value: "@bouncyhouse.com" }],
    };
    expect(evaluateConditions(cond, baseMsg)).toBe(true);
  });

  it("returns false when single AND condition does not match", () => {
    const cond: RuleConditionGroup = {
      operator: "AND",
      conditions: [{ field: "from", op: "contains", value: "@otherco.com" }],
    };
    expect(evaluateConditions(cond, baseMsg)).toBe(false);
  });

  it("AND requires all conditions true", () => {
    const cond: RuleConditionGroup = {
      operator: "AND",
      conditions: [
        { field: "from", op: "contains", value: "@bouncyhouse.com" },
        { field: "subject", op: "contains", value: "Tell me more" },
      ],
    };
    expect(evaluateConditions(cond, baseMsg)).toBe(false); // case-sensitive subject
  });

  it("OR requires any condition true", () => {
    const cond: RuleConditionGroup = {
      operator: "OR",
      conditions: [
        { field: "from", op: "contains", value: "@nope.com" },
        { field: "subject", op: "contains", value: "Quick question" },
      ],
    };
    expect(evaluateConditions(cond, baseMsg)).toBe(true);
  });

  it("equals is exact match", () => {
    const cond: RuleConditionGroup = {
      operator: "AND",
      conditions: [{ field: "from", op: "equals", value: "mike@bouncyhouse.com" }],
    };
    expect(evaluateConditions(cond, baseMsg)).toBe(true);
  });

  it("starts_with matches subject prefix", () => {
    const cond: RuleConditionGroup = {
      operator: "AND",
      conditions: [{ field: "subject", op: "starts_with", value: "Re:" }],
    };
    expect(evaluateConditions(cond, baseMsg)).toBe(true);
  });

  it("matches_regex evaluates regex on the field", () => {
    const cond: RuleConditionGroup = {
      operator: "AND",
      conditions: [{ field: "from", op: "matches_regex", value: "^mike@.+\\.com$" }],
    };
    expect(evaluateConditions(cond, baseMsg)).toBe(true);
  });

  it("is_true on has_attachment", () => {
    const msgWithAttach = { ...baseMsg, has_attachments: true };
    const cond: RuleConditionGroup = {
      operator: "AND",
      conditions: [{ field: "has_attachment", op: "is_true" }],
    };
    expect(evaluateConditions(cond, msgWithAttach)).toBe(true);
    expect(evaluateConditions(cond, baseMsg)).toBe(false);
  });

  it("body condition searches text body", () => {
    const cond: RuleConditionGroup = {
      operator: "AND",
      conditions: [{ field: "body", op: "contains", value: "EventRentalSystems" }],
    };
    expect(evaluateConditions(cond, baseMsg)).toBe(true);
  });

  it("malformed regex returns false (does not throw)", () => {
    const cond: RuleConditionGroup = {
      operator: "AND",
      conditions: [{ field: "from", op: "matches_regex", value: "[invalid(" }],
    };
    expect(evaluateConditions(cond, baseMsg)).toBe(false);
  });

  it("empty conditions array returns false (no rule fires on nothing)", () => {
    const cond: RuleConditionGroup = { operator: "AND", conditions: [] };
    expect(evaluateConditions(cond, baseMsg)).toBe(false);
  });
});
```

- [ ] **Step 2: Run, confirm fails**

```bash
npx vitest run lib/email/rules-engine.test.ts
```
Expected: FAIL — `Cannot find module './rules-engine'`.

- [ ] **Step 3: Implement**

```ts
// lib/email/rules-engine.ts
//
// Pure condition evaluator. Action execution is in the cron route — this
// module only decides whether a rule's conditions match a given message.
//
// Malformed regex is treated as no-match (logged once via console.warn).
// Empty conditions array returns false (a rule with zero conditions is a
// configuration error, not a fire-on-everything rule).

import type { EmailMessage, RuleConditionGroup, RuleConditionLeaf } from "./types";

function leafMatches(leaf: RuleConditionLeaf, msg: EmailMessage): boolean {
  const haystack = ((): string | boolean => {
    switch (leaf.field) {
      case "from": return msg.from_address || "";
      case "to":   return (msg.to_addresses || []).join(", ");
      case "subject": return msg.subject || "";
      case "body": return msg.body_text || "";
      case "has_attachment": return msg.has_attachments;
    }
  })();

  switch (leaf.op) {
    case "is_true":  return haystack === true;
    case "is_false": return haystack === false;
    case "contains":
      return typeof haystack === "string" && typeof leaf.value === "string"
        && haystack.includes(leaf.value);
    case "equals":
      return typeof haystack === "string" && haystack === leaf.value;
    case "starts_with":
      return typeof haystack === "string" && typeof leaf.value === "string"
        && haystack.startsWith(leaf.value);
    case "matches_regex":
      if (typeof haystack !== "string" || typeof leaf.value !== "string") return false;
      try {
        return new RegExp(leaf.value).test(haystack);
      } catch {
        console.warn(`[rules-engine] malformed regex: ${leaf.value}`);
        return false;
      }
  }
}

export function evaluateConditions(group: RuleConditionGroup, msg: EmailMessage): boolean {
  if (!group.conditions || group.conditions.length === 0) return false;
  if (group.operator === "AND") {
    return group.conditions.every((c) => leafMatches(c, msg));
  }
  return group.conditions.some((c) => leafMatches(c, msg));
}
```

- [ ] **Step 4: Run, confirm passes**

```bash
npx vitest run lib/email/rules-engine.test.ts
```
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/email/rules-engine.ts lib/email/rules-engine.test.ts
git commit -m "email: rules engine condition evaluator (AND/OR/contains/equals/starts_with/regex/is_true)"
```

---

## Task 7: HTML sanitizer

**Files:**
- Create: `lib/email/sanitize.ts`

- [ ] **Step 1: Implement**

```ts
// lib/email/sanitize.ts
//
// Sanitize incoming email HTML bodies before storage + render.
// Wraps isomorphic-dompurify with a tight policy that strips scripts,
// inline event handlers, dangerous attrs, and target=_top.
//
// The thread view ALSO renders inside an iframe sandbox — this is defense
// in depth, not the only barrier.

import DOMPurify from "isomorphic-dompurify";

export function sanitizeEmailHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "style"],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    ADD_ATTR: ["target", "rel"],
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/email/sanitize.ts
git commit -m "email: HTML sanitizer wrapping isomorphic-dompurify"
```

---

## Task 8: Email parser

**Files:**
- Create: `lib/email/parser.ts`

- [ ] **Step 1: Implement**

```ts
// lib/email/parser.ts
//
// Parse a raw RFC822 message buffer into the fields we store.
// Wraps `mailparser` with a tight interface.

import { simpleParser, type ParsedMail, type AddressObject } from "mailparser";
import { sanitizeEmailHtml } from "./sanitize";

export interface ParsedEmailMessage {
  message_id_header: string | null;
  in_reply_to: string | null;
  from_address: string;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string | null;
  body_text: string | null;
  body_html: string | null;          // sanitized
  received_at: string | null;        // ISO
  has_attachments: boolean;
  raw_size_bytes: number;
}

export async function parseRawMessage(raw: Buffer): Promise<ParsedEmailMessage> {
  const parsed: ParsedMail = await simpleParser(raw);

  const toAddrs = addrList(parsed.to);
  const ccAddrs = addrList(parsed.cc);

  return {
    message_id_header: parsed.messageId || null,
    in_reply_to: parsed.inReplyTo || null,
    from_address: addrList(parsed.from)[0] || "(unknown)",
    to_addresses: toAddrs,
    cc_addresses: ccAddrs,
    subject: parsed.subject || null,
    body_text: parsed.text || null,
    body_html: parsed.html ? sanitizeEmailHtml(parsed.html) : null,
    received_at: parsed.date ? parsed.date.toISOString() : null,
    has_attachments: (parsed.attachments?.length ?? 0) > 0,
    raw_size_bytes: raw.length,
  };
}

function addrList(field: AddressObject | AddressObject[] | undefined): string[] {
  if (!field) return [];
  const list = Array.isArray(field) ? field : [field];
  const out: string[] = [];
  for (const obj of list) {
    for (const v of obj.value || []) {
      if (v.address) out.push(v.address.toLowerCase());
    }
  }
  return out;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/email/parser.ts
git commit -m "email: mailparser wrapper returning our storage shape (sanitized HTML)"
```

---

## Task 9: IMAP client wrapper

**Files:**
- Create: `lib/email/imap-client.ts`

- [ ] **Step 1: Implement**

```ts
// lib/email/imap-client.ts
//
// Thin wrapper over imapflow. Single-connection pattern: connect → do work → close.
// Caller is responsible for awaiting close() in a finally block.

import { ImapFlow, type ListResponse, type FetchMessageObject } from "imapflow";
import type { EmailAccount } from "./types";
import { decryptPassword } from "./encryption";

export interface ImapFolderInfo {
  path: string;
  name: string;
  specialUse: string | null;
}

export class ImapClient {
  private flow: ImapFlow;

  constructor(account: EmailAccount) {
    this.flow = new ImapFlow({
      host: account.imap_host,
      port: account.imap_port,
      secure: account.imap_tls,
      auth: {
        user: account.username,
        pass: decryptPassword(account.encrypted_password),
      },
      logger: false,
    });
  }

  async connect(): Promise<void> {
    await this.flow.connect();
  }

  async close(): Promise<void> {
    try {
      await this.flow.logout();
    } catch {
      // ignore
    }
  }

  /** List all folders in this account. */
  async listFolders(): Promise<ImapFolderInfo[]> {
    const list: ListResponse[] = await this.flow.list();
    return list.map((b) => ({
      path: b.path,
      name: b.name,
      specialUse: typeof b.specialUse === "string" ? b.specialUse : null,
    }));
  }

  /** Fetch new UIDs in a folder strictly greater than `sinceUid`. */
  async fetchSinceUid(
    folderPath: string,
    sinceUid: number,
  ): Promise<{ uid: number; raw: Buffer }[]> {
    const lock = await this.flow.getMailboxLock(folderPath);
    try {
      const out: { uid: number; raw: Buffer }[] = [];
      const range = `${sinceUid + 1}:*`;
      for await (const msg of this.flow.fetch(range, { uid: true, source: true })) {
        const m = msg as FetchMessageObject;
        if (typeof m.uid === "number" && m.uid > sinceUid && m.source) {
          out.push({ uid: m.uid, raw: m.source });
        }
      }
      return out;
    } finally {
      lock.release();
    }
  }

  /** APPEND a sent message to a folder (typically the Sent folder). */
  async appendToFolder(folderPath: string, rfc822: Buffer | string): Promise<void> {
    await this.flow.append(folderPath, rfc822, ["\\Seen"]);
  }
}
```

- [ ] **Step 2: Smoke verify (typecheck only — no live IMAP yet)**

```bash
npx tsc --noEmit 2>&1 | grep "imap-client" | head -5
```
Expected: no output. Live IMAP testing happens in Task 21.

- [ ] **Step 3: Commit**

```bash
git add lib/email/imap-client.ts
git commit -m "email: ImapClient wrapper over imapflow (connect/list/fetch/append)"
```

---

## Task 10: SMTP client wrapper

**Files:**
- Create: `lib/email/smtp-client.ts`

- [ ] **Step 1: Implement**

```ts
// lib/email/smtp-client.ts
//
// Wrapper over nodemailer for SMTP send. After successful send, builds the
// RFC822 message string that the caller can APPEND to the Sent folder via
// ImapClient.

import nodemailer, { type SendMailOptions } from "nodemailer";
import type { EmailAccount } from "./types";
import { decryptPassword } from "./encryption";

export interface SendInput {
  from: string;          // "Name <email@host>"
  to: string[];
  cc?: string[];
  subject: string;
  text: string;
  html?: string;
  inReplyTo?: string | null;
  references?: string[];
}

export interface SendResult {
  messageId: string;
  rfc822: string;        // serialized message, suitable for IMAP APPEND
}

export async function smtpSend(
  account: EmailAccount,
  input: SendInput,
): Promise<SendResult> {
  const transport = nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port,
    secure: account.smtp_tls,
    auth: {
      user: account.username,
      pass: decryptPassword(account.encrypted_password),
    },
  });

  const headers: Record<string, string> = {};
  if (input.inReplyTo) headers["In-Reply-To"] = input.inReplyTo;
  if (input.references && input.references.length > 0) {
    headers["References"] = input.references.join(" ");
  }

  const mailOpts: SendMailOptions = {
    from: input.from,
    to: input.to,
    cc: input.cc,
    subject: input.subject,
    text: input.text,
    html: input.html,
    headers,
  };

  const info = await transport.sendMail(mailOpts);
  // nodemailer returns `info.response` and `info.messageId`. For APPEND we
  // need the actual RFC822. We rebuild via nodemailer's stream API.
  const stream = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const generated = transport.transporter as any;
    // Easiest: re-render via createTransport().createEnvelope() isn't public.
    // Compose RFC822 from the parts we already know — minimum viable for APPEND.
    const lines = [
      `From: ${input.from}`,
      `To: ${input.to.join(", ")}`,
      ...(input.cc && input.cc.length ? [`Cc: ${input.cc.join(", ")}`] : []),
      `Subject: ${input.subject}`,
      `Message-ID: ${info.messageId}`,
      ...(input.inReplyTo ? [`In-Reply-To: ${input.inReplyTo}`] : []),
      ...(input.references && input.references.length
        ? [`References: ${input.references.join(" ")}`] : []),
      `Date: ${new Date().toUTCString()}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=utf-8`,
      ``,
      input.text,
    ];
    resolve(Buffer.from(lines.join("\r\n"), "utf8"));
  });

  transport.close();

  return {
    messageId: info.messageId || "",
    rfc822: stream.toString("utf8"),
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "smtp-client" | head -5
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add lib/email/smtp-client.ts
git commit -m "email: smtpSend helper that returns messageId + RFC822 for APPEND"
```

---

## Task 11: Cron route — email-sync

**Files:**
- Create: `app/api/cron/email-sync/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Implement the cron**

```ts
// GET /api/cron/email-sync
// Every 5 min. For each active email_account, sync new messages from every
// active folder, run rules, store. Fail-soft per account.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { ImapClient } from "@/lib/email/imap-client";
import { parseRawMessage } from "@/lib/email/parser";
import { evaluateConditions } from "@/lib/email/rules-engine";
import type {
  EmailAccount, EmailFolder, EmailMessage, EmailRule,
  RuleActionBlock, RuleAction,
} from "@/lib/email/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = headers().get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return await Sentry.withMonitor("email-sync", async () => {
    const supabase = createAdminClient({ unscoped: true });

    const { data: accounts, error } = await supabase
      .from("email_accounts").select("*")
      .eq("is_active", true);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const results: any[] = [];
    for (const account of (accounts as EmailAccount[]) || []) {
      try {
        const r = await syncOneAccount(supabase, account);
        results.push({ account: account.email_address, ...r });
        await supabase.from("email_accounts").update({
          last_sync_at: new Date().toISOString(),
          consecutive_failures: 0,
          last_sync_error: null,
        }).eq("id", account.id);
      } catch (e: any) {
        Sentry.captureException(e, {
          tags: { account_id: account.id, stage: "email_sync" },
        });
        const failures = (account.consecutive_failures || 0) + 1;
        await supabase.from("email_accounts").update({
          consecutive_failures: failures,
          last_sync_error: String(e?.message || e),
          last_sync_error_at: new Date().toISOString(),
          is_active: failures >= 3 ? false : account.is_active,
        }).eq("id", account.id);
        results.push({
          account: account.email_address, error: String(e?.message || e),
        });
      }
    }

    return NextResponse.json({ ok: true, results });
  });
}

async function syncOneAccount(supabase: any, account: EmailAccount) {
  const imap = new ImapClient(account);
  let foldersSynced = 0;
  let messagesFetched = 0;
  try {
    await imap.connect();

    // 1. LIST + upsert folders
    const folders = await imap.listFolders();
    for (const f of folders) {
      await supabase.from("email_folders").upsert({
        account_id: account.id,
        path: f.path, name: f.name, special_use: f.specialUse, is_active: true,
      }, { onConflict: "account_id,path" });
    }

    // 2. Read back active folders for this account
    const { data: dbFolders } = await supabase
      .from("email_folders").select("*")
      .eq("account_id", account.id).eq("is_active", true);

    const uidMap: Record<string, number> =
      (account.last_synced_uid_per_folder as any) || {};

    // 3. For each folder, fetch new UIDs
    for (const folder of (dbFolders as EmailFolder[]) || []) {
      const sinceUid = uidMap[folder.path] || 0;
      const newMessages = await imap.fetchSinceUid(folder.path, sinceUid);
      foldersSynced++;
      if (newMessages.length === 0) continue;

      let maxUid = sinceUid;
      for (const { uid, raw } of newMessages) {
        try {
          const parsed = await parseRawMessage(raw);
          // dedupe by Message-ID
          if (parsed.message_id_header) {
            const { data: existing } = await supabase
              .from("email_messages").select("id")
              .eq("account_id", account.id)
              .eq("message_id_header", parsed.message_id_header)
              .maybeSingle();
            if (existing) { maxUid = Math.max(maxUid, uid); continue; }
          }

          // match-or-create thread
          const thread = await matchOrCreateThread(supabase, account.id, folder.id, parsed);

          // insert message
          const { data: msg, error: msgErr } = await supabase
            .from("email_messages").insert({
              thread_id: thread.id, account_id: account.id, folder_id: folder.id,
              direction: "incoming", imap_uid: uid,
              message_id_header: parsed.message_id_header,
              in_reply_to: parsed.in_reply_to,
              from_address: parsed.from_address,
              to_addresses: parsed.to_addresses,
              cc_addresses: parsed.cc_addresses,
              subject: parsed.subject,
              body_text: parsed.body_text,
              body_html: parsed.body_html,
              received_at: parsed.received_at,
              has_attachments: parsed.has_attachments,
              raw_size_bytes: parsed.raw_size_bytes,
            })
            .select("*").single();
          if (msgErr || !msg) {
            Sentry.captureException(msgErr || new Error("insert returned no row"), {
              tags: { stage: "insert_message", uid: String(uid) },
            });
            maxUid = Math.max(maxUid, uid);
            continue;
          }
          messagesFetched++;

          // update thread counters
          await supabase.from("email_threads").update({
            last_message_at: parsed.received_at,
            message_count: thread.message_count + 1,
            unread_count: thread.unread_count + 1,
          }).eq("id", thread.id);

          // run rules
          await applyRulesToMessage(supabase, account.id, msg as EmailMessage);

          maxUid = Math.max(maxUid, uid);
        } catch (perMsg) {
          Sentry.captureException(perMsg, {
            tags: { stage: "per_message", uid: String(uid) },
          });
        }
      }

      uidMap[folder.path] = maxUid;
    }

    await supabase.from("email_accounts").update({
      last_synced_uid_per_folder: uidMap,
    }).eq("id", account.id);

    return { foldersSynced, messagesFetched };
  } finally {
    await imap.close();
  }
}

async function matchOrCreateThread(
  supabase: any, accountId: string, folderId: string,
  parsed: Awaited<ReturnType<typeof parseRawMessage>>,
) {
  // 1. Try matching by In-Reply-To → existing message → its thread
  if (parsed.in_reply_to) {
    const { data: parent } = await supabase
      .from("email_messages").select("thread_id")
      .eq("account_id", accountId)
      .eq("message_id_header", parsed.in_reply_to)
      .maybeSingle();
    if (parent?.thread_id) {
      const { data: th } = await supabase
        .from("email_threads").select("*").eq("id", parent.thread_id).single();
      if (th) return th;
    }
  }
  // 2. Fallback — normalized subject + participant set
  const normSubject = (parsed.subject || "")
    .replace(/^(re|fwd|fw):\s*/gi, "")
    .replace(/^(re|fwd|fw):\s*/gi, "")
    .trim();
  const participants = [
    parsed.from_address,
    ...parsed.to_addresses,
    ...parsed.cc_addresses,
  ].map((s) => s.toLowerCase()).sort();
  const { data: existing } = await supabase
    .from("email_threads").select("*")
    .eq("account_id", accountId)
    .eq("subject", normSubject)
    .eq("participants", participants)
    .maybeSingle();
  if (existing) return existing;

  // 3. Create new thread
  const { data: created } = await supabase.from("email_threads").insert({
    account_id: accountId, folder_id: folderId, subject: normSubject,
    participants, message_count: 0, unread_count: 0,
    last_message_at: parsed.received_at,
  }).select("*").single();
  return created;
}

async function applyRulesToMessage(
  supabase: any, accountId: string, msg: EmailMessage,
) {
  const { data: rules } = await supabase
    .from("email_rules").select("*")
    .eq("account_id", accountId).eq("is_active", true)
    .order("priority", { ascending: true });
  for (const rule of (rules as EmailRule[]) || []) {
    if (!evaluateConditions(rule.condition_jsonb, msg)) continue;
    const block: RuleActionBlock = rule.action_jsonb;
    for (const action of block.actions || []) {
      await executeAction(supabase, action, msg);
    }
    await supabase.from("email_rules").update({
      match_count: rule.match_count + 1,
      last_run_at: new Date().toISOString(),
    }).eq("id", rule.id);
    await supabase.from("email_audit_log").insert({
      account_id: accountId, action: "rule_fired",
      details_jsonb: { rule_id: rule.id, message_id: msg.id },
    });
    if (block.stop_processing) break;
  }
}

async function executeAction(supabase: any, action: RuleAction, msg: EmailMessage) {
  switch (action.type) {
    case "apply_label":
      if (action.label_id) {
        await supabase.from("email_thread_labels").upsert({
          thread_id: msg.thread_id, label_id: action.label_id,
        });
      }
      break;
    case "mark_read":
      await supabase.from("email_messages")
        .update({ is_read: true }).eq("id", msg.id);
      break;
    case "mark_unread":
      await supabase.from("email_messages")
        .update({ is_read: false }).eq("id", msg.id);
      break;
    case "archive":
      await supabase.from("email_threads")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", msg.thread_id);
      break;
    // move_to_folder, forward_to, auto_reply are stubs in MVP — log only
    default:
      break;
  }
}
```

- [ ] **Step 2: Add cron entry to vercel.json**

Append inside the `"crons"` array:

```json
{
  "path": "/api/cron/email-sync",
  "schedule": "*/5 * * * *"
}
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "email-sync" | head -5
```
Expected: only pre-existing `headers().get()` errors that affect all cron routes — none specific to this file.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/email-sync/route.ts vercel.json
git commit -m "email: email-sync cron (every 5 min) — IMAP fetch + rules engine"
```

---

## Task 12: Send API endpoint

**Files:**
- Create: `app/api/superadmin/email/send/route.ts`

- [ ] **Step 1: Implement**

```ts
// POST /api/superadmin/email/send
// Body: { thread_id, to[], cc[], subject, body_text, body_html? }

import { NextResponse } from "next/server";
import { z } from "zod";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { smtpSend } from "@/lib/email/smtp-client";
import { ImapClient } from "@/lib/email/imap-client";
import type { EmailAccount, EmailFolder, EmailThread } from "@/lib/email/types";

const Body = z.object({
  thread_id: z.string().uuid(),
  to: z.array(z.string().email()).min(1).max(20),
  cc: z.array(z.string().email()).max(20).optional(),
  subject: z.string().min(1).max(998),
  body_text: z.string().min(1).max(50_000),
  body_html: z.string().max(200_000).optional(),
});

export const dynamic = "force-dynamic";

async function requireSuperadmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("Unauthorized");
  const admin = createAdminClient({ unscoped: true });
  const { data: tenant } = await admin.from("tenants")
    .select("id").eq("id", user.id).maybeSingle();
  // Real superadmin check
  const { data: rec } = await admin.from("user_roles")
    .select("role").eq("user_id", user.id).maybeSingle();
  if (rec?.role !== "superadmin") throw new Error("Unauthorized");
  return user;
}

export async function POST(req: Request) {
  let user;
  try { user = await requireSuperadmin(); }
  catch { return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }

  const userIp = (headers().get("x-forwarded-for") || "unknown").split(",")[0].trim();
  const rl = await rateLimit(`email_send:${userIp}`, { max: 10, windowSeconds: 60 });
  if (!rl.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", details: parsed.error.errors[0].message }, { status: 400 });
  }

  const supabase = createAdminClient({ unscoped: true });

  // Load thread + account
  const { data: thread } = await supabase
    .from("email_threads").select("*").eq("id", parsed.data.thread_id).single();
  if (!thread) return NextResponse.json({ error: "thread_not_found" }, { status: 404 });
  const th = thread as EmailThread;
  const { data: account } = await supabase
    .from("email_accounts").select("*").eq("id", th.account_id).single();
  if (!account) return NextResponse.json({ error: "account_not_found" }, { status: 404 });
  const acct = account as EmailAccount;

  // Find original message_id_header to thread the reply
  const { data: lastIncoming } = await supabase
    .from("email_messages").select("message_id_header")
    .eq("thread_id", th.id).eq("direction", "incoming")
    .order("received_at", { ascending: false }).limit(1).maybeSingle();

  try {
    const sent = await smtpSend(acct, {
      from: `${acct.label} <${acct.email_address}>`,
      to: parsed.data.to,
      cc: parsed.data.cc,
      subject: parsed.data.subject,
      text: parsed.data.body_text,
      html: parsed.data.body_html,
      inReplyTo: lastIncoming?.message_id_header || null,
      references: lastIncoming?.message_id_header ? [lastIncoming.message_id_header] : [],
    });

    // APPEND to Sent folder (best-effort)
    try {
      const imap = new ImapClient(acct);
      await imap.connect();
      const { data: sentFolder } = await supabase
        .from("email_folders").select("path").eq("account_id", acct.id)
        .eq("special_use", "\\Sent").maybeSingle();
      if (sentFolder?.path) {
        await imap.appendToFolder(sentFolder.path, sent.rfc822);
      }
      await imap.close();
    } catch (appendErr) {
      Sentry.captureException(appendErr, { tags: { stage: "append_sent" } });
    }

    // Insert outgoing row
    await supabase.from("email_messages").insert({
      thread_id: th.id, account_id: acct.id, folder_id: th.folder_id,
      direction: "outgoing", message_id_header: sent.messageId,
      in_reply_to: lastIncoming?.message_id_header || null,
      from_address: acct.email_address,
      to_addresses: parsed.data.to,
      cc_addresses: parsed.data.cc || [],
      subject: parsed.data.subject,
      body_text: parsed.data.body_text,
      body_html: parsed.data.body_html || null,
      sent_at: new Date().toISOString(),
      is_read: true,
    });

    await supabase.from("email_threads")
      .update({ last_message_at: new Date().toISOString(),
                message_count: th.message_count + 1 })
      .eq("id", th.id);

    await supabase.from("email_audit_log").insert({
      account_id: acct.id, action: "reply_sent",
      user_email: user.email,
      details_jsonb: { thread_id: th.id, to: parsed.data.to },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    Sentry.captureException(e, { tags: { stage: "smtp_send" } });
    return NextResponse.json({ error: e?.message || "send_failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/superadmin/email/send/route.ts
git commit -m "email: POST /api/superadmin/email/send (SMTP + APPEND to Sent + audit log)"
```

---

## Task 13: Accounts list page

**Files:**
- Create: `app/superadmin/email/accounts/page.tsx`

- [ ] **Step 1: Implement**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, Plus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EmailAccount } from "@/lib/email/types";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "superadmin") redirect("/superadmin/login");

  const supabase = createAdminClient({ unscoped: true });
  const { data: accounts } = await supabase
    .from("email_accounts").select("*").order("created_at");

  const list = (accounts as EmailAccount[]) || [];

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-brand-navy flex items-center gap-2">
          <Mail className="h-6 w-6" /> Email accounts
        </h1>
        <Link href="/superadmin/email/accounts/new" className="btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add account
        </Link>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-slate-500 card">
          No email accounts yet. Add your first to start syncing.
        </p>
      ) : (
        <div className="space-y-3">
          {list.map((a) => (
            <div key={a.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-brand-navy flex items-center gap-2">
                    {a.is_active && !a.last_sync_error ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    )}
                    {a.email_address}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Brand: <strong>{a.brand}</strong> · Label: {a.label}
                  </div>
                  <div className="text-xs text-slate-500">
                    IMAP {a.imap_host}:{a.imap_port} · SMTP {a.smtp_host}:{a.smtp_port}
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  {a.last_sync_at ? (
                    <>Last sync: {new Date(a.last_sync_at).toLocaleString()}</>
                  ) : (
                    <>Never synced</>
                  )}
                  {a.last_sync_error && (
                    <div className="text-red-600 mt-1">Error: {a.last_sync_error.slice(0, 60)}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/superadmin/email/accounts/page.tsx
git commit -m "email: /superadmin/email/accounts list page"
```

---

## Task 14: Add account wizard

**Files:**
- Create: `app/superadmin/email/accounts/new/page.tsx`
- Create: `app/superadmin/email/accounts/new/AccountWizard.tsx`
- Create: `app/superadmin/email/accounts/new/actions.ts`

- [ ] **Step 1: Server actions file**

```ts
// app/superadmin/email/accounts/new/actions.ts
"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptPassword } from "@/lib/email/encryption";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

export interface WizardInput {
  brand: string;
  label: string;
  email_address: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  username: string;
  password: string;
}

export async function testConnections(input: WizardInput): Promise<
  { ok: true } | { ok: false; stage: "imap" | "smtp"; error: string }
> {
  // Test IMAP
  try {
    const flow = new ImapFlow({
      host: input.imap_host, port: input.imap_port, secure: true,
      auth: { user: input.username, pass: input.password }, logger: false,
    });
    await flow.connect();
    await flow.logout();
  } catch (e: any) {
    return { ok: false, stage: "imap", error: String(e?.message || e) };
  }
  // Test SMTP
  try {
    const transport = nodemailer.createTransport({
      host: input.smtp_host, port: input.smtp_port, secure: true,
      auth: { user: input.username, pass: input.password },
    });
    await transport.verify();
    transport.close();
  } catch (e: any) {
    return { ok: false, stage: "smtp", error: String(e?.message || e) };
  }
  return { ok: true };
}

export async function createAccount(input: WizardInput) {
  const encrypted = encryptPassword(input.password);
  const supabase = createAdminClient({ unscoped: true });
  const { error } = await supabase.from("email_accounts").insert({
    brand: input.brand, label: input.label,
    email_address: input.email_address,
    imap_host: input.imap_host, imap_port: input.imap_port, imap_tls: true,
    smtp_host: input.smtp_host, smtp_port: input.smtp_port, smtp_tls: true,
    username: input.username, encrypted_password: encrypted,
    is_active: true,
  });
  if (error) return { error: error.message };
  redirect("/superadmin/email/accounts");
}
```

- [ ] **Step 2: Wizard client component**

```tsx
// app/superadmin/email/accounts/new/AccountWizard.tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, Check, AlertCircle } from "lucide-react";
import { testConnections, createAccount, type WizardInput } from "./actions";

const STEPS = ["Brand", "Email", "IMAP", "SMTP", "Test & Save"];

export function AccountWizard() {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<WizardInput>({
    brand: "rentalflow", label: "",
    email_address: "",
    imap_host: "", imap_port: 993,
    smtp_host: "", smtp_port: 465,
    username: "", password: "",
  });
  const [testResult, setTestResult] = useState<
    null | { ok: true } | { ok: false; stage: "imap" | "smtp"; error: string }
  >(null);

  const set = (k: keyof WizardInput, v: any) => setData({ ...data, [k]: v });

  function runTest() {
    setTestResult(null);
    startTransition(async () => {
      const r = await testConnections(data);
      setTestResult(r);
      if (r.ok) toast.success("Both connections OK ✓");
      else toast.error(`${r.stage.toUpperCase()} failed: ${r.error}`);
    });
  }

  function save() {
    startTransition(async () => {
      const r = await createAccount(data);
      if (r?.error) toast.error(r.error);
    });
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              i === step ? "bg-brand-navy text-white" :
              i < step ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
            }`}>{i < step ? <Check className="h-4 w-4" /> : i + 1}</div>
            {i < STEPS.length - 1 && (<div className="w-8 h-0.5 bg-slate-200" />)}
          </div>
        ))}
      </div>

      <div className="card space-y-4">
        {step === 0 && (
          <>
            <h2 className="text-lg font-bold">Brand & label</h2>
            <div>
              <label className="block text-sm mb-1">Brand</label>
              <input className="input" value={data.brand} onChange={(e) => set("brand", e.target.value)} placeholder="rentalflow" />
            </div>
            <div>
              <label className="block text-sm mb-1">Label (what you'll see in the UI)</label>
              <input className="input" value={data.label} onChange={(e) => set("label", e.target.value)} placeholder="Main RentalFlow inbox" />
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h2 className="text-lg font-bold">Email address</h2>
            <div>
              <label className="block text-sm mb-1">From/To address</label>
              <input className="input" type="email" value={data.email_address} onChange={(e) => set("email_address", e.target.value)} placeholder="info@getrentalflow.com" />
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h2 className="text-lg font-bold">IMAP server</h2>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-sm mb-1">Host</label>
                <input className="input" value={data.imap_host} onChange={(e) => set("imap_host", e.target.value)} placeholder="imap.getrentalflow.com" />
              </div>
              <div>
                <label className="block text-sm mb-1">Port</label>
                <input className="input" type="number" value={data.imap_port} onChange={(e) => set("imap_port", Number(e.target.value))} />
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1">Username</label>
              <input className="input" value={data.username} onChange={(e) => set("username", e.target.value)} placeholder="info@getrentalflow.com" />
            </div>
            <div>
              <label className="block text-sm mb-1">Password</label>
              <input className="input" type="password" value={data.password} onChange={(e) => set("password", e.target.value)} />
              <p className="text-xs text-slate-400 mt-1">Encrypted with AES-256-GCM before storage. Never displayed again.</p>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <h2 className="text-lg font-bold">SMTP server</h2>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-sm mb-1">Host</label>
                <input className="input" value={data.smtp_host} onChange={(e) => set("smtp_host", e.target.value)} placeholder="smtp.getrentalflow.com" />
              </div>
              <div>
                <label className="block text-sm mb-1">Port</label>
                <input className="input" type="number" value={data.smtp_port} onChange={(e) => set("smtp_port", Number(e.target.value))} />
              </div>
            </div>
            <p className="text-xs text-slate-500">SMTP uses the same username + password as IMAP.</p>
          </>
        )}
        {step === 4 && (
          <>
            <h2 className="text-lg font-bold">Test & save</h2>
            <p className="text-sm text-slate-600">Live test the IMAP + SMTP credentials. Save only enabled if both succeed.</p>
            <button onClick={runTest} disabled={pending} className="btn-primary">
              {pending ? "Testing…" : "Run live test"}
            </button>
            {testResult?.ok && (
              <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-sm text-emerald-900 flex items-center gap-2">
                <Check className="h-4 w-4" /> Both connections OK
              </div>
            )}
            {testResult && !testResult.ok && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-900 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> {testResult.stage.toUpperCase()}: {testResult.error}
              </div>
            )}
          </>
        )}

        <div className="flex justify-between pt-4 border-t border-slate-100">
          <button
            onClick={() => setStep(step - 1)} disabled={step === 0 || pending}
            className="text-sm text-slate-500 inline-flex items-center gap-1 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(step + 1)} className="btn-primary inline-flex items-center gap-1">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={save}
              disabled={!testResult?.ok || pending}
              className="btn-primary disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save account"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Page wrapper**

```tsx
// app/superadmin/email/accounts/new/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { AccountWizard } from "./AccountWizard";

export const dynamic = "force-dynamic";

export default async function NewAccountPage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "superadmin") redirect("/superadmin/login");
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1">Add email account</h1>
      <p className="text-sm text-slate-500 mb-6">5 steps. Live IMAP + SMTP test before save.</p>
      <AccountWizard />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/superadmin/email/accounts/new
git commit -m "email: add-account wizard with live IMAP+SMTP test"
```

---

## Task 15: Inbox list page

**Files:**
- Create: `app/superadmin/email/page.tsx`
- Create: `app/superadmin/email/InboxClient.tsx`

- [ ] **Step 1: Server page**

```tsx
// app/superadmin/email/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { InboxClient } from "./InboxClient";
import type { EmailAccount, EmailFolder, EmailThread, EmailLabel } from "@/lib/email/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function InboxPage({
  searchParams,
}: { searchParams: { account?: string; folder?: string; q?: string; page?: string } }) {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "superadmin") redirect("/superadmin/login");

  const supabase = createAdminClient({ unscoped: true });
  const [{ data: accounts }, { data: folders }, { data: labels }] = await Promise.all([
    supabase.from("email_accounts").select("*").eq("is_active", true).order("created_at"),
    supabase.from("email_folders").select("*").eq("is_active", true).order("name"),
    supabase.from("email_labels").select("*").order("name"),
  ]);

  let query = supabase.from("email_threads").select("*").order("last_message_at", { ascending: false, nullsFirst: false });
  if (searchParams.account) query = query.eq("account_id", searchParams.account);
  if (searchParams.folder) query = query.eq("folder_id", searchParams.folder);
  if (searchParams.q) query = query.ilike("subject", `%${searchParams.q}%`);

  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const from = (page - 1) * PAGE_SIZE;
  query = query.range(from, from + PAGE_SIZE - 1);
  const { data: threads } = await query;

  return (
    <InboxClient
      accounts={(accounts as EmailAccount[]) || []}
      folders={(folders as EmailFolder[]) || []}
      labels={(labels as EmailLabel[]) || []}
      threads={(threads as EmailThread[]) || []}
      page={page}
      pageSize={PAGE_SIZE}
      filters={searchParams}
    />
  );
}
```

- [ ] **Step 2: Client component**

```tsx
// app/superadmin/email/InboxClient.tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Inbox, Send, FileText, Trash2, Archive } from "lucide-react";
import type { EmailAccount, EmailFolder, EmailThread, EmailLabel } from "@/lib/email/types";
import { bulkArchive, bulkMarkRead } from "./actions";

export function InboxClient({
  accounts, folders, labels, threads, page, pageSize, filters,
}: {
  accounts: EmailAccount[]; folders: EmailFolder[]; labels: EmailLabel[];
  threads: EmailThread[]; page: number; pageSize: number;
  filters: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  }

  function applyBulk(action: () => Promise<{ error?: string } | void>) {
    if (selected.size === 0) return;
    startTransition(async () => {
      const r = await action();
      if (r && "error" in r && r.error) toast.error(r.error);
      else {
        toast.success("Done");
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Sidebar */}
      <aside className="col-span-3 space-y-2">
        {accounts.map((a) => (
          <div key={a.id}>
            <div className="text-xs font-bold uppercase text-slate-500 mb-1">{a.label}</div>
            {folders.filter((f) => f.account_id === a.id).map((f) => (
              <Link key={f.id}
                href={`/superadmin/email?account=${a.id}&folder=${f.id}`}
                className={`block px-2 py-1 rounded text-sm ${
                  filters.folder === f.id ? "bg-brand-navy text-white" : "hover:bg-slate-100"
                }`}>
                <span className="inline-flex items-center gap-1">
                  {f.special_use === "\\Sent" ? <Send className="h-3 w-3" /> :
                   f.special_use === "\\Drafts" ? <FileText className="h-3 w-3" /> :
                   f.special_use === "\\Trash" ? <Trash2 className="h-3 w-3" /> :
                   <Inbox className="h-3 w-3" />}
                  {f.name} {f.unread_count > 0 && <strong>({f.unread_count})</strong>}
                </span>
              </Link>
            ))}
          </div>
        ))}
      </aside>

      {/* Main */}
      <main className="col-span-9">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-brand-navy">Inbox</h1>
          <button onClick={() => router.refresh()} className="text-sm inline-flex items-center gap-1 hover:underline">
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>

        {selected.size > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-3 text-sm flex items-center gap-3">
            <strong>{selected.size} selected</strong>
            <button onClick={() => applyBulk(() => bulkArchive(Array.from(selected)))}
                    disabled={pending}
                    className="text-amber-900 hover:underline inline-flex items-center gap-1">
              <Archive className="h-3 w-3" /> Archive
            </button>
            <button onClick={() => applyBulk(() => bulkMarkRead(Array.from(selected), true))}
                    disabled={pending} className="text-amber-900 hover:underline">
              Mark read
            </button>
            <button onClick={() => applyBulk(() => bulkMarkRead(Array.from(selected), false))}
                    disabled={pending} className="text-amber-900 hover:underline">
              Mark unread
            </button>
          </div>
        )}

        <div className="divide-y divide-slate-100 bg-white rounded shadow-sm">
          {threads.length === 0 ? (
            <p className="p-4 text-slate-500 text-sm">No emails in this folder.</p>
          ) : threads.map((t) => (
            <div key={t.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50">
              <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
              <Link href={`/superadmin/email/${t.id}`} className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  {t.unread_count > 0 && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                  <span className={`truncate ${t.unread_count > 0 ? "font-semibold" : ""}`}>
                    {(t.participants || []).slice(0, 2).join(", ") || "(no participants)"}
                  </span>
                </div>
                <div className="text-sm truncate text-slate-600">{t.subject || "(no subject)"}</div>
              </Link>
              <span className="text-xs text-slate-400 whitespace-nowrap">
                {t.last_message_at ? new Date(t.last_message_at).toLocaleDateString() : ""}
              </span>
            </div>
          ))}
        </div>

        {threads.length === pageSize && (
          <div className="flex justify-between mt-3">
            {page > 1 && (
              <Link href={`?page=${page - 1}`} className="text-sm">← Prev</Link>
            )}
            <Link href={`?page=${page + 1}`} className="text-sm ml-auto">Next →</Link>
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/superadmin/email/page.tsx app/superadmin/email/InboxClient.tsx
git commit -m "email: /superadmin/email inbox list with sidebar + bulk actions"
```

---

## Task 16: Thread view + Reply form

**Files:**
- Create: `app/superadmin/email/[threadId]/page.tsx`
- Create: `app/superadmin/email/[threadId]/ReplyForm.tsx`

- [ ] **Step 1: Server page**

```tsx
// app/superadmin/email/[threadId]/page.tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReplyForm } from "./ReplyForm";
import type { EmailMessage, EmailThread, EmailAccount } from "@/lib/email/types";

export const dynamic = "force-dynamic";

export default async function ThreadPage({ params }: { params: { threadId: string } }) {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "superadmin") redirect("/superadmin/login");

  const supabase = createAdminClient({ unscoped: true });
  const { data: thread } = await supabase
    .from("email_threads").select("*").eq("id", params.threadId).maybeSingle();
  if (!thread) notFound();
  const th = thread as EmailThread;

  const [{ data: messages }, { data: account }] = await Promise.all([
    supabase.from("email_messages").select("*")
      .eq("thread_id", params.threadId)
      .order("received_at", { ascending: true, nullsFirst: true }),
    supabase.from("email_accounts").select("*").eq("id", th.account_id).single(),
  ]);

  // Mark all messages in this thread as read
  await supabase.from("email_messages")
    .update({ is_read: true })
    .eq("thread_id", params.threadId).eq("is_read", false);
  await supabase.from("email_threads").update({ unread_count: 0 }).eq("id", th.id);

  const list = (messages as EmailMessage[]) || [];
  const acct = account as EmailAccount;
  const lastIncoming = [...list].reverse().find((m) => m.direction === "incoming");
  const replyTo = lastIncoming?.from_address || "";

  return (
    <div className="max-w-3xl">
      <Link href="/superadmin/email" className="text-sm text-slate-500 inline-flex items-center gap-1 mb-3">
        <ChevronLeft className="h-4 w-4" /> Back to inbox
      </Link>

      <h1 className="text-xl font-bold text-brand-navy mb-1">{th.subject || "(no subject)"}</h1>
      <div className="text-xs text-slate-500 mb-4">
        {acct.label} · {th.message_count} messages
      </div>

      <div className="space-y-3 mb-6">
        {list.map((m) => (
          <article key={m.id} className="card">
            <div className="text-xs text-slate-500 mb-2 flex items-center justify-between">
              <div>
                <strong>{m.from_address}</strong> → {(m.to_addresses || []).join(", ")}
              </div>
              <div>
                {m.received_at ? new Date(m.received_at).toLocaleString() :
                 m.sent_at ? new Date(m.sent_at).toLocaleString() : ""}
              </div>
            </div>
            {m.body_html ? (
              <iframe
                srcDoc={m.body_html}
                sandbox=""
                className="w-full min-h-[300px] border border-slate-100 rounded"
              />
            ) : (
              <pre className="text-sm whitespace-pre-wrap font-sans">{m.body_text}</pre>
            )}
          </article>
        ))}
      </div>

      <ReplyForm
        threadId={th.id}
        defaultTo={replyTo}
        defaultSubject={th.subject?.startsWith("Re:") ? th.subject : `Re: ${th.subject || ""}`}
        accountLabel={acct.label}
        accountEmail={acct.email_address}
      />
    </div>
  );
}
```

- [ ] **Step 2: Reply form**

```tsx
// app/superadmin/email/[threadId]/ReplyForm.tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

export function ReplyForm({
  threadId, defaultTo, defaultSubject, accountLabel, accountEmail,
}: {
  threadId: string;
  defaultTo: string;
  defaultSubject: string;
  accountLabel: string;
  accountEmail: string;
}) {
  const router = useRouter();
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const draftKey = `email_draft_${threadId}`;

  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      try {
        const d = JSON.parse(saved);
        if (d.body) setBody(d.body);
        if (d.subject) setSubject(d.subject);
      } catch {}
    }
  }, [draftKey]);

  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify({ body, subject }));
    }, 1000);
    return () => clearTimeout(t);
  }, [body, subject, draftKey]);

  function submit() {
    if (!to.trim() || !body.trim()) {
      toast.error("Fill 'to' and message body");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/superadmin/email/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread_id: threadId,
          to: to.split(",").map((s) => s.trim()).filter(Boolean),
          subject, body_text: body,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || "Send failed");
        return;
      }
      localStorage.removeItem(draftKey);
      toast.success("Reply sent ✓");
      router.refresh();
    });
  }

  return (
    <div className="card border-2 border-brand-navy">
      <h2 className="font-bold text-brand-navy mb-2">Reply</h2>
      <div className="text-xs text-slate-500 mb-2">From: {accountLabel} &lt;{accountEmail}&gt;</div>
      <div className="space-y-2">
        <input className="input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To (comma-separated)" />
        <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
        <textarea
          className="input min-h-[200px]" value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your reply..."
        />
        <div className="text-right">
          <button onClick={submit} disabled={pending} className="btn-primary inline-flex items-center gap-1">
            <Send className="h-4 w-4" /> {pending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/superadmin/email/\[threadId\]
git commit -m "email: thread view + reply composer with localStorage drafts"
```

---

## Task 17: Server actions — bulk + thread mutations

**Files:**
- Create: `app/superadmin/email/actions.ts`

- [ ] **Step 1: Implement**

```ts
// app/superadmin/email/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireSuperadmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("Unauthorized");
  const admin = createAdminClient({ unscoped: true });
  const { data: rec } = await admin.from("user_roles")
    .select("role").eq("user_id", user.id).maybeSingle();
  if (rec?.role !== "superadmin") throw new Error("Unauthorized");
  return user;
}

export async function bulkArchive(threadIds: string[]) {
  if (threadIds.length === 0) return;
  await requireSuperadmin();
  const supabase = createAdminClient({ unscoped: true });
  const { error } = await supabase.from("email_threads")
    .update({ archived_at: new Date().toISOString() })
    .in("id", threadIds);
  if (error) return { error: error.message };
  revalidatePath("/superadmin/email");
}

export async function bulkMarkRead(threadIds: string[], read: boolean) {
  if (threadIds.length === 0) return;
  await requireSuperadmin();
  const supabase = createAdminClient({ unscoped: true });
  for (const id of threadIds) {
    await supabase.from("email_messages")
      .update({ is_read: read }).eq("thread_id", id);
    await supabase.from("email_threads")
      .update({ unread_count: read ? 0 : 1 }).eq("id", id);
  }
  revalidatePath("/superadmin/email");
}
```

- [ ] **Step 2: Commit**

```bash
git add app/superadmin/email/actions.ts
git commit -m "email: bulkArchive + bulkMarkRead server actions"
```

---

## Task 18: Labels page

**Files:**
- Create: `app/superadmin/email/labels/page.tsx`
- Create: `app/superadmin/email/labels/LabelsClient.tsx`
- Create: `app/superadmin/email/labels/actions.ts`

- [ ] **Step 1: Actions**

```ts
// app/superadmin/email/labels/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createLabel(account_id: string, name: string, color: string) {
  const supabase = createAdminClient({ unscoped: true });
  const { error } = await supabase.from("email_labels").insert({ account_id, name, color });
  if (error) return { error: error.message };
  revalidatePath("/superadmin/email/labels");
}
export async function updateLabel(id: string, name: string, color: string) {
  const supabase = createAdminClient({ unscoped: true });
  await supabase.from("email_labels").update({ name, color }).eq("id", id);
  revalidatePath("/superadmin/email/labels");
}
export async function deleteLabel(id: string) {
  const supabase = createAdminClient({ unscoped: true });
  await supabase.from("email_labels").delete().eq("id", id);
  revalidatePath("/superadmin/email/labels");
}
```

- [ ] **Step 2: Client component**

```tsx
// app/superadmin/email/labels/LabelsClient.tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { createLabel, updateLabel, deleteLabel } from "./actions";
import type { EmailAccount, EmailLabel } from "@/lib/email/types";

export function LabelsClient({ accounts, labels }: { accounts: EmailAccount[]; labels: EmailLabel[] }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [pending, startTransition] = useTransition();

  function add() {
    if (!name.trim() || !accountId) return;
    startTransition(async () => {
      const r = await createLabel(accountId, name.trim(), color);
      if (r?.error) toast.error(r.error);
      else { setName(""); toast.success("Label created"); }
    });
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="font-bold mb-2">Create label</h2>
        <div className="flex gap-2 items-end">
          <select className="input flex-1" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
          <input className="input flex-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Hot lead" />
          <input type="color" className="h-10 w-12 border rounded" value={color} onChange={(e) => setColor(e.target.value)} />
          <button onClick={add} disabled={pending} className="btn-primary inline-flex items-center gap-1">
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      {accounts.map((a) => {
        const acctLabels = labels.filter((l) => l.account_id === a.id);
        return (
          <div key={a.id}>
            <h3 className="text-sm font-bold mb-2">{a.label}</h3>
            <div className="space-y-1">
              {acctLabels.length === 0 ? (
                <p className="text-xs text-slate-400">No labels yet for this account.</p>
              ) : acctLabels.map((l) => (
                <div key={l.id} className="card flex items-center gap-2">
                  <span className="w-4 h-4 rounded" style={{ background: l.color }} />
                  <span className="flex-1 text-sm">{l.name}</span>
                  <button
                    onClick={() => startTransition(async () => {
                      if (confirm(`Delete label "${l.name}"?`)) await deleteLabel(l.id);
                    })}
                    className="text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Page wrapper**

```tsx
// app/superadmin/email/labels/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { LabelsClient } from "./LabelsClient";
import type { EmailAccount, EmailLabel } from "@/lib/email/types";

export const dynamic = "force-dynamic";

export default async function LabelsPage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "superadmin") redirect("/superadmin/login");
  const supabase = createAdminClient({ unscoped: true });
  const [{ data: accounts }, { data: labels }] = await Promise.all([
    supabase.from("email_accounts").select("*").eq("is_active", true),
    supabase.from("email_labels").select("*"),
  ]);
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-4">Labels</h1>
      <LabelsClient accounts={(accounts as EmailAccount[]) || []} labels={(labels as EmailLabel[]) || []} />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/superadmin/email/labels
git commit -m "email: labels CRUD page (create, list, delete with color)"
```

---

## Task 19: Rules page with builder

**Files:**
- Create: `app/superadmin/email/rules/page.tsx`
- Create: `app/superadmin/email/rules/RulesClient.tsx`
- Create: `app/superadmin/email/rules/actions.ts`

- [ ] **Step 1: Actions**

```ts
// app/superadmin/email/rules/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RuleConditionGroup, RuleActionBlock } from "@/lib/email/types";

export async function createRule(
  account_id: string, name: string, priority: number,
  condition_jsonb: RuleConditionGroup, action_jsonb: RuleActionBlock,
) {
  const supabase = createAdminClient({ unscoped: true });
  const { error } = await supabase.from("email_rules").insert({
    account_id, name, priority, condition_jsonb, action_jsonb, is_active: true,
  });
  if (error) return { error: error.message };
  revalidatePath("/superadmin/email/rules");
}
export async function toggleRule(id: string, is_active: boolean) {
  const supabase = createAdminClient({ unscoped: true });
  await supabase.from("email_rules").update({ is_active }).eq("id", id);
  revalidatePath("/superadmin/email/rules");
}
export async function deleteRule(id: string) {
  const supabase = createAdminClient({ unscoped: true });
  await supabase.from("email_rules").delete().eq("id", id);
  revalidatePath("/superadmin/email/rules");
}
```

- [ ] **Step 2: Builder client**

```tsx
// app/superadmin/email/rules/RulesClient.tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import { createRule, toggleRule, deleteRule } from "./actions";
import type {
  EmailAccount, EmailLabel, EmailRule,
  RuleConditionLeaf, RuleAction, RuleConditionField, RuleConditionOp, RuleActionType,
} from "@/lib/email/types";

const FIELDS: RuleConditionField[] = ["from", "to", "subject", "body", "has_attachment"];
const OPS: RuleConditionOp[] = ["contains", "equals", "starts_with", "matches_regex", "is_true", "is_false"];
const ACTION_TYPES: RuleActionType[] = ["apply_label", "mark_read", "mark_unread", "archive"];

export function RulesClient({ accounts, labels, rules }: {
  accounts: EmailAccount[]; labels: EmailLabel[]; rules: EmailRule[];
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [name, setName] = useState("");
  const [priority, setPriority] = useState(100);
  const [conditions, setConditions] = useState<RuleConditionLeaf[]>([
    { field: "from", op: "contains", value: "" },
  ]);
  const [conditionOp, setConditionOp] = useState<"AND" | "OR">("AND");
  const [actions, setActions] = useState<RuleAction[]>([{ type: "apply_label" }]);
  const [pending, startTransition] = useTransition();

  function addCondition() {
    setConditions([...conditions, { field: "from", op: "contains", value: "" }]);
  }
  function removeCondition(i: number) {
    setConditions(conditions.filter((_, idx) => idx !== i));
  }
  function setCondition(i: number, patch: Partial<RuleConditionLeaf>) {
    setConditions(conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  }
  function addAction() { setActions([...actions, { type: "mark_read" }]); }
  function setAction(i: number, patch: Partial<RuleAction>) {
    setActions(actions.map((a, idx) => idx === i ? { ...a, ...patch } : a));
  }
  function removeAction(i: number) { setActions(actions.filter((_, idx) => idx !== i)); }

  function save() {
    if (!name.trim() || !accountId || conditions.length === 0 || actions.length === 0) {
      toast.error("Fill name + at least one condition + one action");
      return;
    }
    startTransition(async () => {
      const r = await createRule(
        accountId, name.trim(), priority,
        { operator: conditionOp, conditions },
        { actions, stop_processing: false },
      );
      if (r?.error) toast.error(r.error);
      else { setName(""); toast.success("Rule created"); }
    });
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="font-bold mb-2">New rule</h2>
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name" />
        </div>

        <div className="mt-3">
          <h3 className="text-xs font-bold uppercase text-slate-500 mb-1">
            WHEN <select className="ml-2" value={conditionOp} onChange={(e) => setConditionOp(e.target.value as "AND" | "OR")}>
              <option>AND</option><option>OR</option>
            </select>
          </h3>
          {conditions.map((c, i) => (
            <div key={i} className="flex gap-1 mb-1">
              <select className="input text-sm" value={c.field} onChange={(e) => setCondition(i, { field: e.target.value as RuleConditionField })}>
                {FIELDS.map((f) => <option key={f}>{f}</option>)}
              </select>
              <select className="input text-sm" value={c.op} onChange={(e) => setCondition(i, { op: e.target.value as RuleConditionOp })}>
                {OPS.map((o) => <option key={o}>{o}</option>)}
              </select>
              {c.op !== "is_true" && c.op !== "is_false" && (
                <input className="input flex-1 text-sm" value={c.value || ""} onChange={(e) => setCondition(i, { value: e.target.value })} placeholder="value" />
              )}
              <button onClick={() => removeCondition(i)} className="text-slate-400 hover:text-red-600"><X className="h-4 w-4" /></button>
            </div>
          ))}
          <button onClick={addCondition} className="text-xs text-brand-navy underline inline-flex items-center gap-1"><Plus className="h-3 w-3" /> Add condition</button>
        </div>

        <div className="mt-3">
          <h3 className="text-xs font-bold uppercase text-slate-500 mb-1">THEN</h3>
          {actions.map((a, i) => (
            <div key={i} className="flex gap-1 mb-1">
              <select className="input text-sm" value={a.type} onChange={(e) => setAction(i, { type: e.target.value as RuleActionType })}>
                {ACTION_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              {a.type === "apply_label" && (
                <select className="input flex-1 text-sm" value={a.label_id || ""} onChange={(e) => setAction(i, { label_id: e.target.value })}>
                  <option value="">— pick label —</option>
                  {labels.filter((l) => l.account_id === accountId).map((l) =>
                    <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              )}
              <button onClick={() => removeAction(i)} className="text-slate-400 hover:text-red-600"><X className="h-4 w-4" /></button>
            </div>
          ))}
          <button onClick={addAction} className="text-xs text-brand-navy underline inline-flex items-center gap-1"><Plus className="h-3 w-3" /> Add action</button>
        </div>

        <div className="mt-3 text-right">
          <button onClick={save} disabled={pending} className="btn-primary">{pending ? "Saving..." : "Save rule"}</button>
        </div>
      </div>

      <div>
        <h2 className="font-bold mb-2">Active rules</h2>
        {rules.map((r) => (
          <div key={r.id} className="card flex items-center gap-2">
            <label className="text-xs">
              <input type="checkbox" checked={r.is_active} onChange={() => startTransition(async () => await toggleRule(r.id, !r.is_active))} /> Active
            </label>
            <span className="flex-1 text-sm">{r.name} (prio {r.priority}, matched {r.match_count}x)</span>
            <button onClick={() => startTransition(async () => { if (confirm("Delete rule?")) await deleteRule(r.id); })} className="text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Page wrapper**

```tsx
// app/superadmin/email/rules/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { RulesClient } from "./RulesClient";
import type { EmailAccount, EmailLabel, EmailRule } from "@/lib/email/types";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "superadmin") redirect("/superadmin/login");
  const supabase = createAdminClient({ unscoped: true });
  const [{ data: accounts }, { data: labels }, { data: rules }] = await Promise.all([
    supabase.from("email_accounts").select("*").eq("is_active", true),
    supabase.from("email_labels").select("*"),
    supabase.from("email_rules").select("*").order("priority"),
  ]);
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-4">Rules</h1>
      <RulesClient
        accounts={(accounts as EmailAccount[]) || []}
        labels={(labels as EmailLabel[]) || []}
        rules={(rules as EmailRule[]) || []}
      />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/superadmin/email/rules
git commit -m "email: rules CRUD with visual condition+action builder"
```

---

## Task 20: Sidebar nav update

**Files:**
- Modify: `app/superadmin/layout.tsx`

- [ ] **Step 1: Find the nav array in `app/superadmin/layout.tsx`**

```bash
grep -n "Tenants\|Setup\|Team" app/superadmin/layout.tsx | head -10
```

- [ ] **Step 2: Add Email nav item between Tenants and Team (whatever order the layout uses, place Email second)**

Edit the nav config. Example diff:

```tsx
{ href: "/superadmin/tenants", label: "Tenants", icon: Users },
{ href: "/superadmin/email", label: "Email", icon: Mail },  // NEW
{ href: "/superadmin/team", label: "Team", icon: UserCog },
```

Make sure to import `Mail` from `lucide-react` if not already imported.

- [ ] **Step 3: Commit**

```bash
git add app/superadmin/layout.tsx
git commit -m "email: sidebar nav item for /superadmin/email"
```

---

## Task 21: End-to-end smoke test + deploy

- [ ] **Step 1: Build verification before deploy**

```bash
npx tsc --noEmit 2>&1 | grep -v "headers().get" | grep -E "email|superadmin/email" | head -10
```
Expected: no output (only pre-existing `headers()` typing errors which exist project-wide).

```bash
npx vitest run lib/email/
```
Expected: all email-related unit tests pass.

- [ ] **Step 2: Push and let Vercel build**

```bash
git push origin main
```
Wait for Vercel deploy to succeed. (Track at https://vercel.com/dashboard)

- [ ] **Step 3: Live smoke — Add account**

Open https://getrentalflow.com/superadmin/email/accounts/new

Walk through the 5 steps with:
- Brand: `rentalflow`
- Label: `Main RentalFlow inbox`
- Email: `info@getrentalflow.com`
- IMAP host: `imap.getrentalflow.com`, port: `993`
- SMTP host: `smtp.getrentalflow.com`, port: `465`
- Username: `info@getrentalflow.com`
- Password: (the one you rotated to)
- Run live test → expect both green
- Save

- [ ] **Step 4: Trigger first sync manually**

Vercel cron runs every 5 min — to trigger immediately:

```bash
curl -s -H "Authorization: Bearer <CRON_SECRET>" https://getrentalflow.com/api/cron/email-sync
```
Expected JSON: `{ ok: true, results: [{ account: "info@getrentalflow.com", foldersSynced: N, messagesFetched: N }] }`.

- [ ] **Step 5: Verify in UI**

Open https://getrentalflow.com/superadmin/email — confirm folders appear in sidebar, existing emails appear in the list.

- [ ] **Step 6: Reply test**

Click any thread → write reply → Send → verify:
- Toast: "Reply sent ✓"
- New outgoing message appears in the thread
- Open `info@getrentalflow.com` in webmail or Outlook → reply visible in Sent folder

- [ ] **Step 7: Label + rule smoke**

- Create one label "Hot lead" (color red)
- Create one rule: "if from contains @bouncyhouse.com then apply label Hot lead"
- Wait for next cron tick OR trigger manually (step 4 again)
- Verify any matching message gets the label

- [ ] **Step 8: Mark Task 15 complete in the plan tracker**

Update todos / TaskList: Task 21 → completed.

---

## Definition of Done

- All 21 tasks committed and pushed
- All 8 tables present in DB with RLS policies
- `EMAIL_ENCRYPTION_KEY` set in Vercel env (production + preview)
- 4 npm packages installed (imapflow, nodemailer, mailparser, isomorphic-dompurify) + types
- Vitest tests pass: encryption (4), rules engine (11)
- `vercel.json` has 7 cron entries (existing 6 + email-sync)
- `info@getrentalflow.com` account configured and syncing every 5 min
- End-to-end flow verified: add account → sync → read → reply → label → rule → bulk archive
- Sentry monitor `email-sync` healthy after 24h
- Sidebar shows Email nav item between Tenants and Team
