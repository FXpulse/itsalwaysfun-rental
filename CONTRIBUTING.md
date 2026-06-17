# Contributing to RentalFlow

A guide for engineers joining the codebase. Read this first, then come
back to it whenever you're stuck.

For the comprehensive ~200-page technical reference (architecture, schema,
API surface, integrations, security), generate the docx:

```bash
python scripts/build_technical_doc.py
# → RentalFlow_Technical_Reference.docx
```

This document is the short version of that.

---

## 1. What you are about to work on

RentalFlow is a multi-tenant SaaS platform that runs rental businesses
end-to-end. One codebase, one Vercel deployment, one Supabase database —
serving every tenant's public site, customer portal, driver app, admin
panel, and the platform owner's superadmin backoffice. The flagship
customer is **It's Always Fun** (IAF) at itsalwaysfun.com. Other tenants
are onboarding.

> ⚠️ If you came in expecting "a small marketing site," recalibrate. This
> is a real product with 11 live integrations, 13+ cron jobs, ~90 database
> tables, ~200 RLS policies, ~280 .ts files. Treat changes carefully.

## 2. Three mental models

### Model 1 — Six surfaces, one codebase

Routing is everything.

| Surface | Lives at | What it is |
|---|---|---|
| Marketing | `getrentalflow.com` (apex) | Lead capture, free-tools, signup |
| Public tenant site | `*.getrentalflow.com` or custom domain | Customer-facing rental site |
| Customer portal | `<tenant>/portal` | Loyalty, referrals, history |
| Driver mobile app | `<tenant>/driver` | Installable PWA for the team |
| Admin panel | `<tenant>/admin` | Operator + staff console (~80 surfaces) |
| Superadmin | `getrentalflow.com/superadmin` | Ludmila's platform-wide backoffice |

The right surface is chosen by `middleware.ts` based on Host + path.

### Model 2 — Every multi-tenant query is auto-scoped

`lib/tenant/scope.ts` is sacred ground.

- The proxy wraps the Supabase client. On every query against a table
  in `MULTI_TENANT_TABLES`, the proxy adds `.eq("tenant_id", current_tenant_id)`
  automatically.
- You almost never write `tenant_id` by hand. If you DO need to write to
  a specific tenant, use `createAdminClient({ unscoped: true })` — and
  have a good reason.
- Postgres RLS is the second wall. ~200 policies live. The proxy + RLS
  together make cross-tenant leaks loud failures, not silent ones.
- When adding a new table: if it has `tenant_id`, ADD IT to
  `MULTI_TENANT_TABLES` in `lib/tenant/scope.ts`. If it inherits via
  parent FK, add to `INTENTIONALLY_NOT_SCOPED`. Run `npm run check:scope`
  to verify — and CI will block your PR if you forget.

### Model 3 — Server actions are the default; API routes are for external callers

Next.js App Router pattern.

- **Server actions** (`actions.ts` files colocated with pages) — form
  submissions, mutations, state changes. Cookie-authed, tenant-scoped
  automatically. Use these for admin/portal/driver.
- **API routes** (`app/api/*/route.ts`) — for external callers: Stripe
  webhooks, GHL inbound, cron jobs, programmatic v1 API. Different auth
  patterns (signature, Bearer, etc.).
- **Rule:** if a button on `/admin` needs to do something, write a server
  action. If an external system needs to call us, write an API route.

---

## 3. Local setup

### Prerequisites

| Tool | Version | How to verify |
|---|---|---|
| Node.js | 22.x (LTS) | `node --version` → v22.x.x |
| npm | comes with Node | `npm --version` |
| Git | any recent | `git --version` |
| Supabase CLI | 1.x or later | `supabase --version` |
| Stripe CLI | optional, recommended | `stripe --version` |
| VS Code or Cursor | recommended | open the repo |

> Node 22 is **required**. The `/superadmin` email inbox uses imapflow +
> mailparser + isomorphic-dompurify in patterns that depend on Node 22 ESM
> behavior. Older Node = mysterious failures on `/superadmin` only.

### Clone + install

```bash
git clone https://github.com/FXpulse/itsalwaysfun-rental.git
cd itsalwaysfun-rental
npm install
```

### Environment variables

There is no `.env.example` checked in (on the doc-debt list). Get the
`.env.local` from Ludmila or Henry. It contains 40+ secrets across
Supabase, Stripe, GHL, Twilio, Resend, AWS, Cloudflare, Upstash, Sentry,
Anthropic, OpenAI, IMAP encryption, `CRON_SECRET`, `OTP_SECRET`.

> **Treat `.env.local` as a credential vault.** Never commit. Never paste
> into Slack. If you leak even one Stripe key, rotate immediately at the
> provider dashboard AND in Vercel env. Notify Henry the same day.

### Supabase: link to dev project

```bash
supabase login                                    # one-time
supabase link --project-ref <DEV_PROJECT_REF>    # ask for the ref
supabase status                                  # verify
```

### Run the dev server

```bash
npm run dev
# ▸ ready on http://localhost:3000
```

### Test as a tenant locally

Tenant resolution is by Host header. Locally, use `*.localhost` which
resolves to `127.0.0.1` in modern browsers:

| URL | What you see |
|---|---|
| http://localhost:3000/marketing | The marketing apex |
| http://iaf.localhost:3000/ | IAF tenant home |
| http://iaf.localhost:3000/admin/login | Log in to admin |
| http://iaf.localhost:3000/portal/login | Customer portal |
| http://iaf.localhost:3000/driver | Driver app |

### Stripe webhook locally

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# copy the printed whsec_ into .env.local as STRIPE_WEBHOOK_SECRET (temp)

# In another terminal:
stripe trigger payment_intent.succeeded
```

> When you switch back to the deployed dev environment, **restore** the
> real `STRIPE_WEBHOOK_SECRET`. The CLI secret only works while the CLI
> is running.

### Type-check + test loop

| Command | When to run |
|---|---|
| `npm run dev` | Hot-reload dev server |
| `npm run typecheck` | After every meaningful change |
| `npm run test` | Unit + integration tests |
| `npm run test:watch` | TDD loop |
| `npm run test:integration` | Against the dedicated test Supabase |
| `npm run lint` | ESLint pass |
| `npm run check:scope` | Verifies `MULTI_TENANT_TABLES` matches live schema |
| `npm run build` | Production build (runs in Vercel automatically) |

---

## 4. Daily workflow

### Branches

| Branch | Purpose |
|---|---|
| `main` | Always deployable. Every push triggers a Vercel production deploy. **Protect it.** |
| `feature/<short-name>` | A new feature. Becomes a PR. |
| `fix/<short-name>` | A bug fix. Becomes a PR. |
| `hotfix/<short-name>` | Production-down or near-emergency fix. Same as fix/ but flagged for fast review. |
| `sandbox/<yourname>-*` | Playground for trying things. PRs closed without merge. Free to delete. |

### Commit messages

Convention from the git log:

```
feat(driver): bottom nav + dedicated Inbox/Chat/Me pages
fix(driver): 4 bugs found in audit — photo uploads, status sync
feat(api-v1): OpenAPI 3.0 spec + Swagger UI docs at /api/v1/docs
feat(security): per-IP rate limit on public reads + Dependabot

Types: feat / fix / refactor / docs / chore / test / perf
Format: <type>(<scope>): <summary in present tense, lowercase>
```

Multi-line commit messages are encouraged for non-trivial PRs. Explain
WHY in the body. The diff explains WHAT.

### Pull request lifecycle

1. Branch off main. Make your change. Type-check + test locally.
2. Push. Open PR against main.
3. Vercel auto-deploys a preview URL. Check that URL on a tenant host.
4. **CI runs automatically** (`.github/workflows/ci.yml`): typecheck +
   lint + tests + scope-check + integration tests. Wait for green.
5. Request review. Henry or Ludmila merges (depending on scope).
6. Merge → production deploys in ~3-4 minutes.

### Sensitive areas — extra care

| Area | What to verify before merging |
|---|---|
| `middleware.ts` | Test on: apex (getrentalflow.com), tenant subdomain (iaf), tenant custom domain. One change here can break every surface. |
| `lib/tenant/scope.ts` | Run `npm run check:scope` AND add a unit test if non-trivial. Sacred ground. |
| `app/api/webhooks/stripe/route.ts` | Use Stripe CLI locally to trigger every event you touch. Verify idempotency. |
| `app/api/bookings/check-and-hold/route.ts` | The hot path. Add or update pricing unit tests. |
| Any `actions.ts` under `/admin` | Always Zod-validate input. Always call `revalidatePath` for affected surfaces. Always `logAuditEvent` for non-trivial mutations. |
| SQL migrations | Idempotent? Reversible? Tested on dev Supabase first? Updated `ALL_MIGRATIONS.sql`? Updated `MULTI_TENANT_TABLES` if applicable? |

### Hotfix workflow

1. Branch `hotfix/<short-name>` off main.
2. Make the **smallest possible change** that fixes the issue. Resist
   refactoring while you're there.
3. Add a test if feasible.
4. Push. Watch the preview deploy. Verify the fix.
5. Merge. Watch production deploy. Verify on production immediately.
6. Email summary to Ludmila + Henry: what broke, what fixed it, follow-up.

> **Never** force-push to main. **Never** use `--no-verify` on commit
> hooks. **Never** skip the preview deploy verification on a hotfix.

### Deploys + rollbacks

| Action | How |
|---|---|
| Deploy production | `git push main` (Vercel auto-deploys) |
| See deploy status | Vercel UI → itsalwaysfun-rental → Deployments |
| Roll back | Vercel UI → previous deployment → "Promote to production". <30s. |
| Manual hotfix env var | Vercel UI → Settings → Environment Variables → Redeploy. |
| Run a cron manually | `curl https://<host>/api/cron/<name> -H "Authorization: Bearer $CRON_SECRET"` |

Vercel's instant rollback is your safety net. If a prod deploy breaks
something within 5 minutes of merging, **roll back first, investigate
after.** Rollback is faster than debugging under pressure.

### Reading logs + errors

| Where | For what |
|---|---|
| Sentry (errors) | Uncaught exceptions, server + client. PII scrubbed. |
| Sentry (cron monitors) | SLA violations on cron jobs. |
| Vercel logs | Real-time function logs. ~7 day retention. |
| Supabase dashboard | Slow queries, RLS denied counts, storage. |
| Resend dashboard | Email delivery status. |
| Twilio dashboard | SMS delivery + 10DLC compliance. |
| Stripe dashboard | Payments, webhooks, disputes, Connect status. |
| GHL dashboard | Contact upserts, automation runs. |
| Upstash dashboard | Rate limit hits per key. |

### Testing discipline

Current state: ~40 test cases (mostly pricing + multi-tenant isolation +
booking-email idempotency + PII scrubbing). Recommended discipline when
adding code:

- New pricing logic → add a case in `tests/unit/pricing.test.ts`.
- New tenant-scoped table → add to
  `tests/integration/multi-tenant-isolation.test.ts`.
- New scheduled email → add to
  `tests/integration/booking-email-idempotency.test.ts` to verify the
  ledger prevents duplicate sends.
- Any Zod schema change → extend `tests/unit/validation.test.ts`.
- Any Sentry PII scrubbing change → extend `lib/sentry/scrub-pii.test.ts`.

**The bar:** every payment-affecting change has at least one new test.

---

## 5. Common recipes

The 10 things you'll do most often.

### 5.1 Add a new admin page

```
mkdir -p app/admin/sales-reports
```

Then:
- `page.tsx`: server component. Use `requireStaffOrAdmin()` from
  `lib/auth/roles`. Read data via `createAdminClient()` (auto-tenant-scoped).
- `actions.ts` (optional): `"use server"` at top. Each action: auth check
  → Zod validate → Supabase mutation → `revalidatePath` → return ok/error.
- **Nav entry**: edit `app/admin/AdminNavClient.tsx` (or wherever the
  sidebar lives) to add the link.
- **Help page**: update `app/admin/help/HelpClient.tsx` with a short
  description (every new tenant-facing feature gets a Help entry).
- **Regenerate KB**: `node scripts/generate-kb-from-help.js` after touching
  HelpClient.tsx, then apply the SQL via Supabase CLI.

### 5.2 Add a new email template

1. Seed it in `supabase/<feature>_email_templates.sql` (idempotent INSERT
   into `email_templates`). Also update `seed_default_email_templates()`
   function.
2. Apply: `supabase db query --linked --yes -f supabase/<feature>_email_templates.sql`
3. Wire the trigger using `sendTemplated(key, vars)` from
   `lib/email/send-template.ts`. Read `getTenantEmailConfig(tenantId)` for
   the From/Reply-To.
4. Idempotency: if it could fire twice (cron, webhook retry, etc.), call
   `recordSend(booking_id, email_type)` and check before send. Pattern
   matches `lib/email/scheduled-emails.ts`.
5. Test: trigger the path + check Resend dashboard.

### 5.3 Add a new cron job

1. Create `app/api/cron/<name>/route.ts`.
2. First line: check `Authorization === \`Bearer ${process.env.CRON_SECRET}\``.
3. Wrap the handler body with `Sentry.withMonitor("<name>", ...)` from
   `lib/sentry-cron.ts`.
4. Use `createAdminClient({ unscoped: true })` for cross-tenant queries.
5. Add `{ "path": "/api/cron/<name>", "schedule": "<CRON>" }` to
   `vercel.json`. Use UTC. Verify with crontab.guru.
6. Deploy + manually trigger:
   `curl https://<host>/api/cron/<name> -H "Authorization: Bearer $CRON_SECRET"`.

### 5.4 Add a database column

```sql
-- supabase/add_dietary_notes.sql
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_dietary_notes text;
```

Then:
1. Append to `ALL_MIGRATIONS.sql` in dependency order.
2. Apply: `supabase db query --linked --yes -f supabase/add_dietary_notes.sql`
3. Regenerate types: `npm run supabase:types` updates `types/database.ts`.
4. Update SCHEMA_BASELINE: `pg_dump --schema-only > supabase/SCHEMA_BASELINE.sql`
   (after applied).

### 5.5 Add a new tenant-scoped table

1. Migration: `CREATE TABLE tenant_certifications (id uuid PK, tenant_id
   uuid NOT NULL REFERENCES tenants(id), ...)`. Idempotent. Add `CREATE
   INDEX` on tenant_id. Add RLS policy + `ENABLE ROW LEVEL SECURITY`.
2. **Add to `MULTI_TENANT_TABLES` in `lib/tenant/scope.ts`.**
3. Run `npm run check:scope` — must pass.
4. Add an integration test for cross-tenant isolation. Pattern matches
   `tests/integration/multi-tenant-isolation.test.ts`.

> If the new table has CHILD-only data (no `tenant_id`, only parent FK),
> add it to `INTENTIONALLY_NOT_SCOPED` instead and verify the parent has
> `tenant_id`.

### 5.6 Extend the Stripe webhook handler

You usually don't add a separate one — extend the switch in
`app/api/webhooks/stripe/route.ts`:

```ts
switch (event.type) {
  case 'payment_intent.succeeded': {
    const pi = event.data.object as Stripe.PaymentIntent
    const type = pi.metadata?.type || 'booking'
    if (type === 'booking')        await handleBookingPaid(pi)
    else if (type === 'extension') await handleExtensionPaid(pi)
    else if (type === 'gift_card') await handleGiftCardPaid(pi)
    break
  }
  // add your new case here
}
```

> **Every handler must be idempotent.** Check state BEFORE updating.
> Stripe retries for up to 3 days. Read the existing handlers as
> reference.

### 5.7 Add a programmatic v1 API endpoint

1. `app/api/v1/<name>/route.ts`
2. Use `authenticateApiKey({ scope: '<resource>:<read|write>' })` from
   `lib/api/auth`. Returns tenant_id or 401/403.
3. Use `rateLimit(\`v1:${tenant_id}\`, { max: 60, windowSeconds: 60 })`.
4. Match existing v1 response shapes: `{ items: [...], count, next_cursor }`.
5. Document in `/api/v1/openapi.json` + `/api/v1/docs` (Swagger UI).

### 5.8 Add an outbound webhook event

1. Find the code path that completes the action (e.g. booking_status →
   "completed").
2. Call `dispatchWebhook(tenant_id, "<event>", payload)` from
   `lib/webhooks/dispatch.ts`.
3. Tenant opt-in: tenant_webhooks.events[] must include the event name.
   Managed in `/admin/webhooks`.
4. Retry behavior: built in. Cron `webhook-retry` handles failures with
   exponential backoff.

### 5.9 Add a Sentry breadcrumb / capture

```ts
import * as Sentry from '@sentry/nextjs'

try {
  await riskyOperation()
} catch (e) {
  Sentry.captureException(e, {
    tags: { area: 'ghl-sync' },
    extra: { tenant_id, booking_id },
  })
  // Continue — this is best-effort
}
```

PII (customer names, emails, phone numbers, addresses, API keys) is
scrubbed by `lib/sentry/scrub-pii.ts` before leaving the server. Safe to
pass full booking objects in `extra`.

### 5.10 Onboard a new tenant

Operational, not code, but you should understand it:

1. Tenant signs up via `/signup` → tenants row created.
2. On signup: `seed_default_email_templates(tenant_id)` +
   `seed_default_site_settings(tenant_id)` populate baseline config.
3. Tenant chooses subdomain OR maps custom domain in `/admin/site`.
4. Stripe Connect onboarding via `/admin/settings/payments`.
5. Tenant adds products via `/admin/products`. Bulk import via
   `/admin/bulk-upload`.
6. Onboarding checklist in `/admin/onboarding` nudges remaining setup.
7. After 7 days: cron `onboarding-nudge` fires reminders for incomplete steps.

For the comprehensive onboarding playbook + GHL workflows, see
`C:\Users\chemm\getrentalflow-ghl-playbook.md` (operator documentation
outside repo).

---

## Things NOT to do without asking

- Edit `middleware.ts` — affects every request on every surface. Always
  preview-deploy before merging.
- Add a new table without updating `MULTI_TENANT_TABLES` in
  `lib/tenant/scope.ts`. CI will block you anyway, but save the round trip.
- Use the service-role Supabase key in client code — that key bypasses
  RLS and is server-only.
- Run `git push --force` to main.
- Add `console.log` to production code — there are ~30 in the repo and
  ~20 are in scripts. Keep that ratio.
- Skip writing the Zod schema on a new server action. Every action
  validates its input at the boundary.

## How to ask for help

**Henry** is the technical lead. **Ludmila** is the operator and product
owner. Convention: before opening a PR that touches sensitive areas
(Stripe webhook, scope.ts, middleware), sketch the approach in
conversation. After that, branch + preview deploy + verify against a real
tenant host (the IAF preview URL is the canonical test).

---

For the long-form versions of everything above, generate the Technical
Reference docx:

```bash
python scripts/build_technical_doc.py
```

Welcome aboard.
