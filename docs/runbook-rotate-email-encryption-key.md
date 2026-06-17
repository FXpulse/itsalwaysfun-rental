# Runbook — Rotate EMAIL_ENCRYPTION_KEY

Rotates the AES-256-GCM key that encrypts stored IMAP/SMTP passwords in
`email_accounts.encrypted_password` (used by the superadmin unified inbox).

## When to do this

- **Emergency**: the current key is suspected of being leaked (someone with
  Vercel env access left, a screenshot exposed it, an env var dump occurred).
- **Routine**: ~annually, or after every personnel change with prod access.

## What is at risk if you skip rotation

The key decrypts every stored email password. If it leaks, an attacker
can dump the table + decrypt every tenant's email credentials. The
fallout is "every connected mailbox is compromised."

Right now (June 2026) this table only holds Ludmila's own accounts via
`/superadmin/email`, so the blast radius is bounded. As more accounts
get added it widens.

## Prerequisites

- Vercel + Supabase + repo access on the operator's machine
- `node` 22 + `npx` available
- ~15 minutes uninterrupted

## Steps

### 1. Generate a new key

```bash
openssl rand -base64 32
```

That output is the NEW key. Store it somewhere safe (1Password, Bitwarden)
labelled "RentalFlow EMAIL_ENCRYPTION_KEY — pending rotation YYYY-MM-DD".

### 2. Find the OLD key

It's in Vercel under `EMAIL_ENCRYPTION_KEY` (production env). Copy it
verbatim — do not regenerate it.

### 3. Dry-run the re-encryption locally

In the repo root, with both keys exported:

```bash
export EMAIL_ENCRYPTION_KEY_OLD="<old base64 key>"
export EMAIL_ENCRYPTION_KEY_NEW="<new base64 key>"
export NEXT_PUBLIC_SUPABASE_URL="https://<your-project>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service role key>"

npx tsx scripts/rotate-email-encryption-key.ts
```

The script lists every email_accounts row, decrypts with OLD, re-encrypts
with NEW, and verifies the round-trip — but does **not** write. You should
see all rows print `re-encrypted ✓ (dry-run, not written)` and a final
`Result: N OK, 0 failed.`

If any row says `FAILED`, **stop** — investigate before proceeding. Usually
this means the OLD key you provided is wrong.

### 4. Apply the re-encryption

Re-run with `--apply`:

```bash
npx tsx scripts/rotate-email-encryption-key.ts --apply
```

This time the script writes each new ciphertext back to `email_accounts`.
Expect all rows to print `re-encrypted + written ✓`.

At this exact moment, every stored password is now encrypted with NEW —
but the live app is still reading EMAIL_ENCRYPTION_KEY = OLD. Email sync
will start failing. You have **about 5 minutes** of downtime starting now.

### 5. Update Vercel env to NEW

In Vercel: Project Settings → Environment Variables → `EMAIL_ENCRYPTION_KEY`
(Production scope) → paste NEW value → Save → **Redeploy** production.

The deploy takes ~3 minutes. Once it lands, the new app code will read NEW
and successfully decrypt the rows you just re-encrypted.

### 6. Verify

- Visit `/superadmin/email/accounts` — every account should show "active"
- Click `Sync now` on each — confirm it actually fetches new mail
- Watch `/superadmin/email` for incoming threads

### 7. Save the old key for a few days

Keep the OLD key in your password manager labelled "EMAIL_ENCRYPTION_KEY
retired YYYY-MM-DD — safe to delete after YYYY-MM-DD + 7 days". This is
your escape hatch if step 5 was somehow misapplied.

### 8. After 7 days of successful syncs

Permanently delete OLD from your password manager. Rotation complete.

## Rollback (if step 5 broke something)

1. Revert the Vercel env var to OLD and redeploy.
2. Re-run the script with the keys swapped:
   ```bash
   export EMAIL_ENCRYPTION_KEY_OLD="<NEW key>"
   export EMAIL_ENCRYPTION_KEY_NEW="<OLD key>"
   npx tsx scripts/rotate-email-encryption-key.ts --apply
   ```
3. Verify `/superadmin/email/accounts` again.

You are now back to the pre-rotation state.

## Why we don't run this in CI / cron

This is a destructive write to production credentials. It MUST be
operator-supervised so that step 5 (Vercel redeploy) happens within the
~5-minute window between writes and the next sync attempt. Automation
that fails halfway leaves the table re-encrypted with NEW but the app
still reading OLD — sync fails until a human intervenes.

## Related

- Encryption code: `lib/email/encryption.ts`
- Tests: `lib/email/encryption.test.ts`
- Rotation script: `scripts/rotate-email-encryption-key.ts`
- Schema: `supabase/SCHEMA_BASELINE.sql` — `public.email_accounts.encrypted_password`
- Audit reference: chapter 16 (Security), SEC-6 finding
