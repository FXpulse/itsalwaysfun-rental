# Multi-tenant migration guide

How to migrate existing queries to be tenant-safe.

## TL;DR

For every server-side query that touches a multi-tenant table
(bookings, products, inventory, etc.):

1. Add `.eq("tenant_id", getCurrentTenantId())` to SELECT / UPDATE / DELETE
2. Use `withTenant({...row})` when INSERTing
3. Optionally swap `createAdminClient()` → `createTenantAdminClient()` for
   the informational header (RLS still bypassed under service role)

## The three client types

| Helper | RLS enforces tenant? | When to use |
|--------|---------------------|-------------|
| `createTenantUserClient()` | ✅ Yes (via user_roles) | Admin pages — preferred default |
| `createTenantAdminClient()` | ⚠️ No (must filter manually) | Webhooks, public site, bulk ops needing elevated perms |
| `createAdminClient()` | ❌ No | SaaS-wide superadmin only (billing, onboarding tenants) |

## Migration recipe — by query type

### Reading

```ts
// BEFORE
const { data } = await supabase.from("bookings").select("*");

// AFTER — Option A: user-scoped (RLS auto-filters)
import { createTenantUserClient } from "@/lib/tenant/client";
const supabase = createTenantUserClient();
const { data } = await supabase.from("bookings").select("*");
// No .eq("tenant_id", ...) needed — RLS handles it

// AFTER — Option B: service role (explicit filter required)
import { createTenantAdminClient } from "@/lib/tenant/client";
import { getCurrentTenantId } from "@/lib/tenant/db";
const supabase = createTenantAdminClient();
const { data } = await supabase
  .from("bookings")
  .select("*")
  .eq("tenant_id", getCurrentTenantId());
```

### Inserting

```ts
// BEFORE
await supabase.from("bookings").insert({ customer_email: "..." });

// AFTER
import { withTenant } from "@/lib/tenant/db";
await supabase.from("bookings").insert(withTenant({ customer_email: "..." }));
```

### Updating / Deleting

```ts
// BEFORE
await supabase.from("bookings").update({ status: "paid" }).eq("id", bookingId);

// AFTER (defense-in-depth — even with RLS)
await supabase
  .from("bookings")
  .update({ status: "paid" })
  .eq("id", bookingId)
  .eq("tenant_id", getCurrentTenantId());
```

### Single-row fetch with defensive assertion

```ts
import { assertTenantBoundary } from "@/lib/tenant/db";

const { data } = await supabase
  .from("bookings")
  .select("*, tenant_id")  // make sure to select tenant_id for the check
  .eq("id", bookingId)
  .maybeSingle();

assertTenantBoundary(data); // throws if cross-tenant
```

## What's already done

- ✅ All multi-tenant tables have `tenant_id` column (defaults to IAF tenant)
- ✅ Middleware resolves tenant by hostname
- ✅ RLS policies enforce tenant isolation for non-service-role queries
- ✅ Helpers ready: `getCurrentTenantId()`, `withTenant()`, `createTenantUserClient()`, `createTenantAdminClient()`

## What still needs migration

~100+ server actions and API routes still use `createAdminClient()` without
tenant filtering. They work today because only the IAF tenant has data,
but they MUST be migrated before onboarding a second tenant.

Migration order (priority):
1. Booking CRUD (check-and-hold, refund, cancel, modify)
2. Admin pages (bookings list, dashboard, reports)
3. Customer portal (bookings, profile)
4. Public catalog (products, packages, gift cards)
5. Operational (inventory, dispatch, expenses)
6. Settings + email templates

Use grep to find candidates:
```bash
grep -rln "createAdminClient" app/ lib/ | xargs grep -l "from("
```

## Testing

Add per-endpoint tests that verify cross-tenant access is blocked. Pattern:

```ts
// Create tenant A booking
// Switch context to tenant B
// Assert tenant B cannot read tenant A's booking
```

Vitest with Supabase test DB makes this clean.

## Glossary

- **tenant_id** — uuid of the tenant a row belongs to. Default value on every
  multi-tenant table = IAF tenant UUID `11111111-1111-1111-1111-111111111111`.
- **superadmin** — `user_roles.is_superadmin = true`. Can read/write across
  all tenants. Currently: Ludmila.
- **RLS** — Row-Level Security. Postgres-enforced filtering at query time.
  Bypassed by service role; enforced for anon + user JWT.
