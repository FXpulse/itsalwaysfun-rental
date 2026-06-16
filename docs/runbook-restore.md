# Disaster Recovery — Restore from S3 backup

**Last successful drill:** _(none yet — pending first run)_
**Last manual restore:** _(none yet)_
**Average completion time goal:** < 4 hours
**Owner:** Ludmila

---

## When to use this runbook

- Production Supabase project unrecoverable (data corruption, accidental DROP, ransomware, regional outage)
- Quarterly **drill** to keep this procedure current and verified
- Whenever you finish a major schema migration that you want to verify against backup history

---

## Pre-requisites (verify BEFORE you need them)

- AWS CLI configured with read access to `s3://rentalflow-backups/`
- `psql` installed locally (Postgres 15+ client)
- Supabase CLI installed and logged in
- Vercel CLI logged in
- Access to:
  - Supabase Console (https://supabase.com/dashboard) — for creating a new project
  - GitHub (for redeploying the app pointed at the restored DB)
  - Resend, Stripe, GHL, Twilio dashboards (if any post-restore credential rotation is needed)

Verify all these work BEFORE an incident, not during it.

---

## Step 0 — Triage (5 min)

1. **Confirm the production DB is actually unrecoverable.** Some "disasters" are:
   - Network blip → wait 5 min, check Supabase status page (https://status.supabase.com)
   - Single corrupt table → can be patched from backup without full restore
   - Performance crisis → scaling vertical, not restore
2. If the answer is "we need to restore from backup", continue.
3. **Notify** affected tenants. A short message via Twilio SMS or campaign email is enough to buy time.

---

## Step 1 — Provision target environment (15 min)

You have two options. Pick based on whether the prod project is gone or you're doing a drill.

### Option A — New Supabase project (for drill OR if prod is dead)

1. Go to https://supabase.com/dashboard → New Project
2. Name: `rentalflow-restore-YYYY-MM-DD`
3. Region: same as production (US East by default)
4. Strong DB password — store in 1Password under "RentalFlow Restore Drill DB"
5. Wait for provisioning (~2 min)
6. Get these credentials:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (Settings → API → service_role)
   - `DATABASE_URL` (Settings → Database → Connection string, use direct connection)

### Option B — In-place (only if prod project still exists but is empty/corrupt)

Drop everything first:
```sql
-- DANGER: only if you've confirmed the data is unrecoverable.
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname='public' loop
    execute 'drop table if exists public.' || quote_ident(r.tablename) || ' cascade';
  end loop;
end $$;
```

---

## Step 2 — Download backup (5 min)

```bash
# List weekly backups (newest first)
aws s3 ls s3://rentalflow-backups/weekly/ --recursive | sort -r | head -5

# Download the latest
LATEST=$(aws s3 ls s3://rentalflow-backups/weekly/ --recursive | sort -r | head -1 | awk '{print $4}')
aws s3 cp "s3://rentalflow-backups/$LATEST" ./latest-backup.sql.gz

# Unzip
gunzip latest-backup.sql.gz
# Result: latest-backup.sql (typically 200-500 MB)
```

---

## Step 3 — Restore schema + data (~15 min for 500 MB)

```bash
# Make sure DATABASE_URL is set to the TARGET (new) project, not production
export DATABASE_URL="postgresql://postgres:<password>@<host>:5432/postgres"

# Apply
psql "$DATABASE_URL" < latest-backup.sql 2>&1 | tee restore.log

# Watch for errors. Common warnings (safe to ignore):
#   - "role X already exists" — supabase manages roles
#   - "extension Y already enabled" — idempotent
# Hard errors to fix manually:
#   - "permission denied" — re-export with --no-owner --no-privileges in next backup
#   - "function/procedure not found" — extension dependency, see step 4
```

---

## Step 4 — Re-apply manual Supabase config

These are NOT in the SQL backup and must be re-configured every time.

### 4.1 Extensions

```sql
-- Postgres extensions Supabase doesn't auto-enable on a fresh project
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";  -- if you use cron
create extension if not exists "vector";   -- if you use AI/embeddings
```

### 4.2 Realtime publication

```sql
-- From supabase/realtime_publication.sql
alter publication supabase_realtime add table public.contact_messages;
alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.payout_requests;
alter publication supabase_realtime add table public.coi_requests;
alter publication supabase_realtime add table public.booking_internal_messages;
```

### 4.3 Storage buckets

In Supabase Console → Storage:
- Re-create buckets: `tenant-branding`, `booking-proofs`, `waiver-signatures`, `inspection-photos`, any custom
- Re-apply public/private policy (most are private with RLS)
- Re-upload critical files if needed (logos for each tenant)

```sql
-- Bucket policies (paste in SQL editor)
-- Example for tenant-branding (public read):
insert into storage.buckets (id, name, public)
values ('tenant-branding', 'tenant-branding', true)
on conflict (id) do nothing;
```

### 4.4 Auth providers

In Supabase Console → Authentication → Providers:
- Enable Email (with magic link)
- Set SMTP settings if using custom SMTP for auth (typically not — we use Resend via our own OTP flow)
- Set redirect URLs: `https://www.itsalwaysfun.com/auth/callback`, `https://www.getrentalflow.com/auth/callback`, etc.

### 4.5 Auth user passwords

**Critical**: Supabase Auth `encrypted_password` is encrypted with a project-specific key. If you restore to a NEW project, all user passwords are invalid. Options:
- **Easy path**: Force password reset for all users. Users receive a reset email on next login.
- **Hard path**: Decrypt and re-encrypt by setting the same `auth.secret` env var on the new project (advanced; involves contacting Supabase support).

For a drill we accept "users would need to reset" — document it and move on.

---

## Step 5 — Verify integrity (10 min)

Run these queries against the restored DB. All should return 0 errors.

```sql
-- Row counts (compare against last known prod counts)
select
  'bookings' as t, count(*) from bookings
  union all select 'customer_profiles', count(*) from customer_profiles
  union all select 'tenants', count(*) from tenants
  union all select 'products', count(*) from products
  order by 1;

-- Multi-tenant integrity: every row in a tenant-scoped table has a valid tenant_id
select 'bookings' as t, count(*) as orphaned from bookings b
  where b.tenant_id is null or not exists (select 1 from tenants t where t.id = b.tenant_id)
  union all select 'products', count(*) from products p
  where p.tenant_id is null or not exists (select 1 from tenants t where t.id = p.tenant_id);
-- Both should return 0.

-- Foreign keys (catch broken refs)
select
  conrelid::regclass as table_name, conname as constraint_name
from pg_constraint
where contype = 'f'
  and not pg_catalog.pg_get_constraintdef(oid) like '%MATCH%';
-- Should list all FKs — none should error.

-- RLS coverage (every multi-tenant table should have RLS)
select tablename
from pg_tables
where schemaname = 'public'
  and rowsecurity = false
  and tablename in (
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'tenant_id'
  );
-- Should return 0 rows.
```

Also run the **scope check** script against the restored DB:

```bash
NEXT_PUBLIC_SUPABASE_URL="<restored-project-url>" \
SUPABASE_SERVICE_ROLE_KEY="<restored-project-service-role>" \
  npm run check:scope
```

Should output `[scope-check] OK — N multi-tenant tables ...` — confirms scope.ts ↔ schema consistency survived the restore.

---

## Step 6 — Point the app at restored DB (15 min)

### For a drill (don't disturb production users):

1. Create a Vercel preview branch: `git checkout -b restore-drill-YYYY-MM-DD`
2. In Vercel project settings → Environment Variables → "Preview" environment:
   - Override `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` to point at the restored DB
3. Push the branch → wait for preview deployment URL
4. Smoke-test from the preview URL (Step 7)

### For real disaster recovery:

1. Update Vercel production env vars to point at the new Supabase project
2. Trigger a redeploy: `vercel --prod`
3. Verify within 5 minutes (Step 7)

---

## Step 7 — Smoke test (10 min)

From the running app (preview URL for drill, production URL for real recovery):

- [ ] `/api/health` returns `{"status":"ok"}`
- [ ] Login as admin (forcing password reset if needed) → see `/admin/dashboard` with data
- [ ] Create a test booking → flows through pricing, holds inventory
- [ ] Trigger `/api/cron/booking-emails` manually with `Authorization: Bearer $CRON_SECRET` → check that no error is thrown (don't actually let it send to real customers — use Resend test mode or fake `EMAIL_FROM`)
- [ ] Open `/admin/dispatch/<today>` → see today's routes
- [ ] Open a customer in `/admin/customers/<email>` → see their LTV + tag history
- [ ] Open `/admin/inventory/units` → fleet state machine renders correctly

---

## Step 8 — Document the drill

Update the top of this file:

- `Last successful drill: YYYY-MM-DD by <name>`
- `Wall-clock duration: Xh Ym`
- `Issues encountered: ...`

Add any new gotchas to the section below.

---

## Accumulated gotchas

_(Update this section after each drill — every restore teaches you something.)_

- **2026-MM-DD example**: `pg_cron` extension required explicit `create extension` after restore. Added to step 4.1.
- _(add more as discovered)_

---

## Don't-do list

- **Don't** restore TO production from an old backup without isolating first. Use Option A (new project) for drills always.
- **Don't** delete the backup file (`latest-backup.sql`) until smoke tests pass and you've confirmed at least one full booking flow.
- **Don't** rotate Stripe/GHL webhook secrets immediately after restore — those don't depend on the DB and rotating them mid-incident causes its own cascade.
- **Don't** forget to update `/superadmin/health` MAU + sign-in metrics — they're computed from `auth.users.last_sign_in_at` which resets on auth re-issuance.

---

## Time budget benchmark

| Step | Time |
|---|---|
| 0 Triage | 5 min |
| 1 Provision | 15 min |
| 2 Download backup | 5 min |
| 3 Restore | 15 min (500 MB) |
| 4 Manual config | 20 min |
| 5 Verify | 10 min |
| 6 Point app | 15 min |
| 7 Smoke test | 10 min |
| 8 Document | 5 min |
| **Total** | **~1h 40min** |

If your wall-clock comes out > 4 hours during a real incident, that's a sign that the backup format or manual-config steps need streamlining. Update this runbook with the bottleneck.
