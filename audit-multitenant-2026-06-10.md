# Multi-Tenant Audit — RentalFlow

**Date:** 2026-06-10
**Scope:** Verified bugs in tenant scoping, `MULTI_TENANT_TABLES` consistency, RPC bypass patterns, hardcoded default-tenant fallbacks.
**Method:** 3 parallel investigation agents + manual verification of all load-bearing claims.

---

## Severity tiers

- **🔴 CRITICAL** — broken right now or actively leaks cross-tenant data
- **🟠 HIGH** — latent leak risk; works "by accident" because IAF is default tenant
- **🟡 MEDIUM** — defense-in-depth / list maintenance
- **🟢 LOW** — informational

---

## 🔴 CRITICAL — Broken or leaking right now

### CRIT-1: `tenant_api_keys` insert never sets tenant_id
**File:** `app/admin/api-keys/actions.ts:30-37`
**Verified:** ✓ read myself
```ts
const supabase = createAdminClient();
const { error } = await supabase.from("tenant_api_keys").insert({
  name, key_hash, key_prefix, scopes, expires_at,
  created_by_email: me.email,
  // ← no tenant_id
});
```
`tenant_api_keys` is **NOT** in `MULTI_TENANT_TABLES`, so the proxy does NOT inject. Same exact bug pattern as `customer_tags` had this morning. If the column has `DEFAULT '11111111-…'` (likely, per the migration backfill convention), keys silently land in **IAF tenant** for ALL admins of any tenant — cross-tenant authentication leak. If column is NOT NULL with no default, the create button is broken.

**Fix:** add `"tenant_api_keys"` to `MULTI_TENANT_TABLES`.

---

### CRIT-2: `tenant_webhooks` insert never sets tenant_id
**File:** `app/admin/webhooks/actions.ts:30-34`
**Verified:** ✓ read myself

Same pattern as CRIT-1. Webhooks created on any tenant land on IAF.

**Fix:** add `"tenant_webhooks"` to `MULTI_TENANT_TABLES`.

---

### CRIT-3: Inbound email silently routes to IAF when domain not resolved
**File:** `app/api/email/inbound/route.ts:205-210`
**Verified:** ✓ read myself
```ts
if (!tenantId) {
  tenantId = "11111111-1111-1111-1111-111111111111";
  console.warn("[inbound-email] no tenant resolved, falling back to default IAF", { to: data.to });
}
```
The `tenants.custom_domain` lookup is the only resolver. If a future tenant adds their domain to GHL/Cloudflare BEFORE inserting into `tenants.custom_domain` (race), or if they typo the domain, **all their inbound customer emails land in IAF's `/admin/inbox`**.

For IAF alone this is invisible (it's the default). For RentalFlow's first paying tenant, this is a P0 data leak.

**Fix:** replace fallback with `return new Response("tenant not resolved", { status: 422 })`. Email goes to Cloudflare's retry queue or bounces — better than misroute.

---

## 🟠 HIGH — Latent leak risk

### HIGH-1: `ensure_customer_profile` RPC bypasses proxy
**File:** `supabase/loyalty.sql:87-105`
**Verified:** ✓ read myself

```sql
insert into public.customer_profiles (user_id, referral_code)
  values (uid, new_code)  -- no tenant_id
```

The RPC runs in Postgres → proxy never sees it. `customer_profiles.tenant_id` defaults to `'11111111-…'`. **Every customer profile auto-created from a Stripe webhook for a non-IAF tenant lands in IAF.**

**Call chain:**
```
app/api/webhooks/stripe/route.ts (resolves tenant from metadata, uses { unscoped: true })
  → awardForPaidBooking()
    → ensureCustomerProfile(uid)           ← no tenant context here
      → rpc("ensure_customer_profile", { uid })
        → INSERT customer_profiles (...) ← default tenant_id wins
```

For IAF this is invisible because the default IS IAF. For any other paying tenant, every paid booking's customer profile orphans to IAF.

**Fix:** add a `p_tenant_id uuid` parameter to the RPC and the JS wrapper. Update all call sites.

---

### HIGH-2: Stripe webhook tenancy validation incomplete
**File:** `app/api/webhooks/stripe/route.ts:91-93` (per Agent 3 — needs verification)
**Verified:** ⚠️ not personally verified — confidence: moderate

Agent reports that the webhook only filters by `metadata.tenant_id` when present, accepts bookings without it. If true, an attacker could forge a Stripe event without metadata.tenant_id and land it on the first tenant the resolver finds.

**Action:** Henry should manually verify before fixing. Read the file, look for the tenant resolution logic around the webhook handler.

---

## 🟡 MEDIUM — Missing-from-list (latent, fix when feature is touched)

Tables with `tenant_id NOT NULL` schemas that are NOT in `MULTI_TENANT_TABLES`. Adding them now is safe per Agent 2's per-table analysis:

| Table | Used by | Current state | Verdict |
|-------|---------|---------------|---------|
| `custom_reports` | `app/admin/reports/custom/actions.ts` | Already passes tenant_id explicitly | ✅ SAFE — add for defense-in-depth |
| `google_business_connections` | `lib/google-business/api.ts` | Already explicit | ✅ SAFE |
| `tenant_goals` | `app/admin/goals/actions.ts`, `lib/admin/goals.ts` | Already explicit | ✅ SAFE |
| `tenant_home_sections` | `app/admin/site/sections/actions.ts`, public home | Already explicit | ✅ SAFE |
| `tenant_onboarding_checklist` | `app/superadmin/tenants/[id]/checklist/*` | Already explicit | ✅ SAFE |
| `tenant_operator_notes` | `app/superadmin/tenants/[id]/checklist/*` | Already explicit | ✅ SAFE |
| `google_business_reviews` | none yet | — | ⏸️ KEEP OUT until first use |
| `google_business_posts` | none yet | — | ⏸️ KEEP OUT until first use |

For tables marked SAFE, adding to `MULTI_TENANT_TABLES` is redundant-but-protective: current code already passes tenant_id, so the proxy injection just overwrites with the same value. The benefit is selects auto-filter so a forgotten `.eq("tenant_id", X)` doesn't leak.

---

## 🟢 LOW — Architectural observations

### OBS-1: `MULTI_TENANT_TABLES` is unmaintained
Every "fix this" today (customer_tags, campaigns, the 8 above) is the same root cause: the list is a hand-maintained snapshot. Devs add new tables to schema, forget to add to the list, bug surfaces later when someone hits insert.

**Possible long-term fix:** auto-derive the list at runtime from `information_schema.columns` (one query at boot). Cost: query on cold start; gain: list never goes stale.

For now: a `grep tenant_id` pre-commit hook checking new tables against the list would catch ~90%.

### OBS-2: Default tenant pattern is dangerous
The `'11111111-…'` default exists in 2 layers: column DEFAULT (Postgres) + JS `DEFAULT_TENANT_ID` constant. When a query "works" it might be because of the default, not because the code is correct. The CRIT-1/CRIT-2/HIGH-1 bugs all hide behind this.

**Possible long-term fix:** remove the column DEFAULT after a one-shot migration that confirms zero NULLs remain. Forces explicit tenant_id on every insert. Loud failures > silent leaks.

---

## Recommended fix order

1. **CRIT-1 + CRIT-2** (add 2 lines to scope.ts) — 30 seconds, blocks no-one
2. **CRIT-3** (replace fallback with 422 response) — 1 minute, prevents the next tenant from leaking
3. **HIGH-1** (RPC + 5 call-site refactor) — 30 minutes
4. **HIGH-2** (verify, then fix if confirmed) — 10 minutes investigation
5. **MEDIUM block** (add 6 tables to scope.ts) — 30 seconds, defense in depth
6. **OBS-1 / OBS-2** — deferred, architectural

Items 1-2 and 5 are mechanical and safe. Items 3-4 need real code + reasoning. Items 6 are conversations.
