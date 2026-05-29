# Free 1099-NEC Tracker — Design Spec

**Date:** 2026-05-29
**Status:** Approved by Ludmila — ready for implementation plan
**URL:** `https://getrentalflow.com/free-tools/1099-tracker`
**Owner:** Ludmila (Il Murali / RentalFlow)

## 1. Purpose

A free, browser-based web calculator that helps bouncy house / party rental owners track per-contractor payments against the IRS $600 1099-NEC threshold throughout the year.

**Why it exists:**
- **Lead magnet** — primary CTA in Email 6 of the RentalFlow outbound sequence (`getrentalflow-outbound-playbook.md`). Drives engagement from cold prospects who ignored Emails 1-5.
- **SEO play** — long-tail organic traffic for "free 1099-NEC calculator", "1099 tracker for contractors", "bouncy house 1099".
- **Brand goodwill** — gives real value (not just a pitch) to cold leads, lowering resistance to RentalFlow.

**What it explicitly is NOT:**
- Not a replacement for a real accounting tool.
- Not a service that stores PII on the server (driver names stay in the browser only).
- Not a 1099-NEC PDF generator (deferred — too much maintenance burden for the lead-magnet payoff).

## 2. Architecture

### Routing

- Page lives at `app/marketing/free-tools/1099-tracker/page.tsx`
- Public URL: `https://getrentalflow.com/free-tools/1099-tracker`
- Also create an index `/free-tools/` page (placeholder for future lead magnets like "free quote template", "free rental contract").
- Middleware tweak: if a tenant subdomain (`*.getrentalflow.com` or a custom domain) requests `/free-tools/*`, redirect to the marketing apex. Tenants do not need the tool on their own sites.

### Stack

- **Client-side React state** — all calc operations happen in the browser. Zero server round-trips while the user enters drivers/payments.
- **`localStorage` persistence** under key `rf_1099_tracker_v1`. Auto-saves on every state change with 500ms debounce. Schema version embedded so we can migrate safely later.
- **API route** `app/api/free-tools/1099-tracker/submit/route.ts` — handles the soft-gate POST (email + summary).
- **Supabase table** `public.lead_magnet_signups` — own record of leads, independent of GHL.
- **GHL integration** via existing `lib/ghl/client.ts` — fire-and-forget, fails open if env vars not set.
- **Transactional email** via existing email infra (Resend) — sends the CSV + tax tips series.

## 3. User Flow

1. User arrives via the Email 6 link (`?ref=email6`) or via organic search / direct.
2. Page loads with the tool immediately visible — no gate, no signup.
3. **Step 1:** User adds contractor names to the Driver Table.
4. **Step 2:** User logs payments (driver, date, amount, optional note). Each submit updates the Summary in real time.
5. **Step 3:** Summary shows which contractors crossed $600 with visual ⚠️ alerts. User clicks **Download CSV** to take their data offline.
6. **Optional soft gate:** User clicks **"📧 Email me a copy + tax tips"** → modal opens → enters email → submits → modal closes with toast.
7. Backend processes: save to Supabase → fire to GHL → send transactional email. User sees success regardless of which side-effects succeed.

## 4. Components

All components live under `app/marketing/free-tools/1099-tracker/`:

| File | Responsibility |
|---|---|
| `page.tsx` | Server component shell. Renders metadata, hero, footer, mounts the client app. |
| `Tracker.tsx` | Client root. Owns state. Reads/writes localStorage. Renders the 3 sub-components. |
| `DriverTable.tsx` | Step 1 — list + add drivers. Shows running total + ⚠️ if over threshold. |
| `PaymentForm.tsx` | Step 2 — add a single payment. Driver dropdown + date + amount + note. |
| `PaymentList.tsx` | Step 2 — recent payments (last 10 visible, expandable). |
| `SummaryCard.tsx` | Step 3 — aggregates by tax year, highlights over-threshold, CSV download. |
| `SoftGateModal.tsx` | Modal for the email capture. Calls the submit API. |

### State shape

```ts
type Driver = { id: string; name: string };
type Payment = {
  id: string;
  driverId: string;
  date: string;       // ISO YYYY-MM-DD
  amountCents: number;
  note?: string;
};
type TrackerState = {
  schemaVersion: 1;
  // The year currently being viewed in the Summary. Does NOT filter
  // input — users log payments with explicit dates (which can be any year),
  // and the Summary filters payments by year(payment.date) === taxYear.
  taxYear: number;
  drivers: Driver[];
  payments: Payment[];
};
```

### localStorage handling

- Key: `rf_1099_tracker_v1`
- On load: try parse; if version mismatch → keep raw in `rf_1099_tracker_v1_backup` and start fresh.
- On every state change: debounce 500ms then write.
- If parse fails: ignore, start fresh, log warning to console (not Sentry — user data shouldn't leak).

## 5. SEO + Metadata

Re-uses existing SEO helpers (`lib/seo/json-ld.ts`).

- **Title:** `Free 1099-NEC Tracker for Rental Businesses | RentalFlow`
- **Description:** `Track contractor payments and stay compliant with the IRS $600 1099-NEC threshold. Free, no signup, runs in your browser. Built by bouncy house rental owners.`
- **Open Graph image:** `/og-1099-tracker.png` (1200×630, ship alongside the page). If the asset is missing at runtime, fall through to the RentalFlow marketing default (currently the logo).
- **Canonical:** `https://getrentalflow.com/free-tools/1099-tracker`
- **JSON-LD:** `SoftwareApplication` schema marking it as a free utility.

## 6. Soft Gate API

### Endpoint

`POST /api/free-tools/1099-tracker/submit`

### Request

```json
{
  "email": "owner@bouncyhouse.com",
  "summary": {
    "tax_year": 2026,
    "driver_count": 3,
    "drivers_over_threshold": 2,
    "total_paid_cents": 244000
  },
  "marketing_opt_in": false,
  "source": "free_tools/1099-tracker",
  "ref": "email6"
}
```

### Processing order

1. **Rate limit** — 3 submits per IP per hour via existing `lib/rate-limit.ts`. Key: `lead_magnet:1099:ip:{ip}`. Returns 429 if exceeded.
2. **Validate email** — regex `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i` + length ≤ 254. Return 400 on invalid.
3. **Save to Supabase** — `lead_magnet_signups` insert. This is the source of truth; if this fails return 500 to the user.
4. **Fire to GHL** (fail-open) — `lookupContactByEmail`. If exists, add tag `1099-tracker-user` (+ `email6-engaged` if `ref=email6`, + `rf-marketing-opt-in` if checkbox). If not exists, create contact with email + tags. Update `lead_magnet_signups.ghl_synced_at + ghl_contact_id` on success.
5. **Send transactional email** (fail-open) — "Here's your CSV + tax season tips" via Resend. Includes the summary stats as a small table inline.
6. **Return** `{ success: true }`. Even if steps 4 or 5 fail, the user gets success because their lead is captured in Supabase.

### Failure modes

| Failure | User sees | Server does |
|---|---|---|
| Rate limit hit | Toast "Try again in an hour" | 429, no DB write |
| Email invalid | Toast "That email looks wrong" | 400, no DB write |
| Supabase down | Toast "Couldn't save, try in a sec" | 500, full error to Sentry |
| GHL down | Success | Logs to Sentry. `ghl_synced_at` stays null. A new cron `app/api/cron/lead-magnet-resync/route.ts` (scheduled daily via `vercel.json`) retries any rows where `ghl_synced_at is null and created_at > now() - interval '7 days'`. |
| Email send down | Success | Logs to Sentry. Manual resend possible from admin. |

## 7. Database Schema

New table — migration file `supabase/lead_magnet_signups.sql`:

```sql
create table public.lead_magnet_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  tool_name text not null,
  source text,
  payload_json jsonb not null,
  marketing_opt_in boolean default false,
  ghl_synced_at timestamptz,
  ghl_contact_id text,
  created_at timestamptz default now()
);
create index on public.lead_magnet_signups (email);
create index on public.lead_magnet_signups (tool_name, created_at desc);

alter table public.lead_magnet_signups enable row level security;
-- No tenant scoping — these are marketing leads, owned by RentalFlow itself.
-- Read access is admin-only via service role; no app-level reads.
create policy "service_role_full_access" on public.lead_magnet_signups
  for all using (auth.role() = 'service_role');
```

## 8. Privacy + Legal

- **No driver PII server-side.** Server only ever sees the aggregated summary (counts and totals), never driver names.
- Modal footer: *"We only store your email. Driver data stays in your browser."*
- Page footer links to `/info/privacy-policy` (already exists).
- Marketing checkbox starts **unchecked** — CCPA/GDPR alignment.
- localStorage data has no identifier — it's not PII the server can access.

## 9. Out of Scope (Explicit YAGNI)

The following were considered and deliberately excluded from this MVP:

- Bulk paste / CSV import of historical payments. Defer until users ask for it.
- IRS 1099-NEC PDF generation per contractor. Form layouts change yearly; maintenance burden too high vs. lead-magnet payoff.
- Multi-year tracking in a single workspace. Year selector picks one year at a time.
- Server-side persistence of driver data. localStorage is sufficient and avoids PII storage.
- Account / login. Would defeat the "no signup required" promise from Email 6.
- Categories, projects, or payment types beyond the optional note field.
- Sharing the tracker with someone else (collaboration).

## 10. Verification (definition of done)

- Page renders at `https://getrentalflow.com/free-tools/1099-tracker` with status 200.
- A tenant subdomain visiting `/free-tools/1099-tracker` redirects to the apex.
- Adding a driver, logging payments, and refreshing the page preserves state via localStorage.
- Clearing localStorage resets the tool cleanly.
- Threshold alert (⚠️) appears for any driver whose `sum(payments.amountCents)` for the selected `taxYear` is ≥ $60000 (60000 cents).
- CSV download contains: driver name, total paid, status (over / under threshold), # of payments.
- Soft gate submit returns 200 and inserts a row in `lead_magnet_signups`.
- GHL gets the contact (or tag if existing) — verified by hitting the API mock once.
- Page passes Lighthouse SEO 90+, A11y 90+.
- Page included in `sitemap.xml` automatically via the existing sitemap generator (no manual entry needed).

## 11. Implementation Order (high-level)

1. Supabase migration (`lead_magnet_signups.sql`).
2. `lib/marketing/lead-magnet.ts` — helper to save + fire GHL + send email.
3. `app/api/free-tools/1099-tracker/submit/route.ts` — API route wrapping the helper.
4. `app/marketing/free-tools/1099-tracker/page.tsx` + `Tracker.tsx` + sub-components.
5. Middleware tweak — `/free-tools/*` redirects from tenants to apex.
6. Update `app/sitemap.ts` marketing branch to include `/free-tools/1099-tracker`.
7. Add `lead-magnet-resync` cron entry to `vercel.json`.
8. Manual smoke test: visit page, complete a tracker, soft-gate submit, verify row in Supabase + tag in GHL + email received.
9. Deploy + verify production.
