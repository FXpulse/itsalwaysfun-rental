# Restore drill — findings 2026-06-16

**Performer:** automated  
**Duration:** ~30 min before blocked  
**Status:** Partial — blocked on schema reproducibility, did NOT reach data restore step

## What worked

1. ✅ **Drill project created cleanly** via `supabase projects create` (free tier nano size unavailable; micro forced, but free tier doesn't allow size selection — created with default settings, took ~1 min to provision)
2. ✅ **Backup downloaded successfully** from Supabase Storage (`backup-2026-06-14.json`, 407 KB)
3. ✅ **Importer code validated** — synthetic backup test confirmed parsing + ordering + reporting works (validated locally before drill)
4. ✅ **Project cleanup** worked via `supabase projects delete --yes` — no residual cost

## What blocked

### 🔴 Finding #1 — Schema not reproducible from repo

When I tried to recreate the schema on the fresh drill project, I hit a wall:

- `supabase/schema.sql` creates `bookings`, `products`, `blocked_dates` (the original baseline from before multi-tenant)
- `supabase/ALL_MIGRATIONS.sql` says "Last updated: 2026-05-28" → STALE
- `ALL_MIGRATIONS.sql` extends `bookings` (assumes it exists) ✓ — needs `schema.sql` first
- `ALL_MIGRATIONS.sql` INSERTs into `categories` (line 398) — but doesn't CREATE `categories`
- `categories` is in `categories_and_fixes.sql` (not in ALL_MIGRATIONS)
- After applying `categories_and_fixes.sql`, the next failure was `site_settings` not existing
- `multi_tenant_foundation.sql` references `public.user_roles` which doesn't exist yet
- There are 139 SQL files in `supabase/` with no clearly documented application order
- Multiple files contain DDL + INSERTs that depend on tables in OTHER files
- A clean from-scratch restore requires applying these in a non-obvious order

### 🔴 Finding #2 — `supabase db dump` requires Docker

The standard "dump prod schema to a file for restore" workflow uses `supabase db dump --linked`, which depends on the Supabase Postgres image. Without Docker installed, this is blocked.

Workarounds attempted:
- `pg_dump` directly: requires Postgres connection string with DB password (not available)
- Management API SQL query: would require manually building `information_schema` introspection queries — not done

### 🟡 Finding #3 — Backup format pre-2026-06-16 is incomplete

The drill backup (`backup-2026-06-14.json`, 407 KB) does NOT contain the `tenants` table. This is consistent with the pre-expansion `lib/backup.ts` that missed it.

The first complete backup will be Sunday 2026-06-21 (next weekly cron run after the 2026-06-16 export expansion).

**Implication:** any restore from R2/Storage backup BEFORE 2026-06-21 is missing critical tables. Any disaster recovery before that date relies entirely on Supabase managed PITR.

## Actionable next steps (prioritized)

### 🔴 P0 — Make schema reproducible (~1 day work)

**The single highest-value disaster-recovery fix.** Options:

**Option A: Build a `db/bootstrap.sh` script**
- Walks `supabase/` in the correct order
- Each SQL file's dependencies documented in a metadata header
- Run once with `bash db/bootstrap.sh $DATABASE_URL` to set up a fresh project
- Validation: in CI, run against a fresh local Postgres and assert it succeeds without errors

**Option B: Snapshot pg_dump from prod, commit to repo as `supabase/SCHEMA_BASELINE.sql`**
- Periodically update via Supabase Console → SQL editor or a snapshot cron
- New incremental migrations layer on top
- Same approach as Atlas, Squitch, or Flyway use
- Cleanest pattern long-term

**Option C: Use Supabase migrations CLI properly**
- `supabase migration new <name>` for each schema change going forward
- Builds up a `supabase/migrations/YYYYMMDD_*.sql` directory
- `supabase db reset` applies them in order
- Requires standardizing all 139 existing files into this format (rewrite work)

### 🟡 P1 — Schedule the next drill for 2026-06-22 (after first complete backup)

After Sunday's cron runs the expanded export, schedule a follow-up drill targeting:
- Download backup-2026-06-21.json (first WITH tenants)
- Apply schema via whatever solution from P0 above
- Run `npx tsx scripts/import-backup.ts` against drill project
- Verify row counts match prod
- Document wall-clock duration

### 🟡 P2 — Install Docker Desktop on the operating machine

Drill machine needs Docker for `supabase db dump`. Either:
- Install on Ludmila's Windows machine
- Or use a Linux VPS / GitHub Codespaces for restores (no local install needed)

### 🟢 P3 — Eventually wire `scripts/import-backup.ts` into a Sentry monitored cron

Quarterly automated drill:
- Cron creates a new drill project
- Restores latest backup
- Smoke tests via simple SELECT counts
- Posts result to Slack/email
- Deletes drill project

This makes the drill a passive sanity check, not a manual exercise.

## What was salvaged

- The importer was validated as functional (locally + synthetic backup dry-run)
- The expanded export now covers all 50+ multi-tenant tables (next Sunday's backup will be complete)
- The runbook is more honest now: explicitly references R2 endpoint, lists the schema-reproducibility blocker, points to import-backup.ts

## Estimated risk delta after this drill

| Risk | Before | After | Why |
|---|---|---|---|
| Catastrophic recovery within 4h | Theoretical | **Blocked** | Schema reproducibility gap blocks restore-from-zero. PITR within 7-day window unaffected. |
| Recovery within 7 days (PITR window) | Confident | Confident | Supabase managed PITR is independent of these gaps. |
| Recovery beyond 7 days from R2 | Theoretical | **High risk** | Missing tenants + 20 tables in backups + no clear schema bootstrap = manual SQL surgery in incident mode. |

**Bottom line:** Supabase PITR is the actual safety net. R2 backups are paper-only until P0 work is done.
