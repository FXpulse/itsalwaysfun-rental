# RentalFlow Multi-tenant Setup Guide

Complete setup checklist to activate the SaaS infrastructure built in
Phases 1-5. ~30-45 min total.

## ✅ Already done in code

- Database schema (tenants table + tenant_id everywhere + RLS)
- Middleware (hostname → tenant resolution + apex → /marketing rewrite)
- All admin queries auto-scoped via proxy wrap
- Stripe Connect for tenant payment routing
- Tenant signup flow at /signup
- Marketing landing at apex (getrentalflow.com)
- Per-tenant branding (logo + colors)
- Stripe Subscriptions billing for tenants
- Superadmin dashboard at /superadmin/tenants

## 🔧 Setup steps (one-time, in order)

### 1. Run SQL migrations in Supabase

In SQL Editor, run each of these in order. They're idempotent.

```
supabase/multi_tenant_foundation.sql      ← Chunk 1A
supabase/multi_tenant_resolver.sql        ← Chunk 1B
supabase/multi_tenant_rls.sql             ← Chunk 1D
supabase/multi_tenant_billing.sql         ← Phase 4
```

After all four: tenants table has IAF as first tenant, you (Ludmila) are
flagged is_superadmin, all multi-tenant tables have tenant_id columns
and RLS policies.

### 2. DNS + Vercel domains (already done if RentalFlow domain works)

Confirm in 20i (DNS) you have for `getrentalflow.com`:
- A `@` → 76.76.21.21
- CNAME `www` → cname.vercel-dns.com
- CNAME `*` → cname.vercel-dns.com (wildcard for tenants)

Confirm in Vercel Settings → Domains all 3 are green:
- getrentalflow.com
- www.getrentalflow.com
- *.getrentalflow.com

### 3. Create Stripe Products + Prices (for tenant billing)

Stripe Dashboard → Products → **+ Add product** — repeat 3 times:

| Product name | Price | Billing | Description |
|--------------|-------|---------|-------------|
| RentalFlow Starter | $99.00 | Monthly recurring | Up to 50 bookings/mo |
| RentalFlow Pro | $199.00 | Monthly recurring | Unlimited + custom domain |
| RentalFlow Enterprise | $499.00 | Monthly recurring | Multi-location + API |

For each: open the product → click the Price row → **Copy the price ID**
(format: `price_xxxxxxxxxxxx`).

### 4. Add Stripe Price IDs as Vercel env vars

Vercel → Settings → Environment Variables → Add:

- `STRIPE_PRICE_STARTER` = `price_xxx` (Starter price ID)
- `STRIPE_PRICE_PRO` = `price_xxx` (Pro price ID)
- `STRIPE_PRICE_ENTERPRISE` = `price_xxx` (Enterprise price ID)

Environments: Production + Preview + Development. **Redeploy.**

### 5. Subscribe Stripe webhook to subscription events

Stripe Dashboard → Developers → Webhooks → your endpoint
(`https://itsalwaysfun.net/api/webhooks/stripe`) → **+ Listen to more
events**. Add these 4:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

(Plus the existing payment events stay subscribed.)

### 6. Optional — Stripe Connect for tenant payment routing

Stripe Dashboard → Connect → Get Started (if not already enabled).

This activates Stripe Connect Express for your platform. Tenants will
connect their OWN Stripe via `/admin/settings/payments` after signup.

## 🧪 Testing as a second tenant

1. **Sign up**: open `https://getrentalflow.com/signup` (incognito)
   - Business name: "Test Bouncers"
   - Subdomain: `testbouncers`
   - Owner email: a Gmail you control (or `test+tenant@yourgmail.com`)
   - Password: anything 8+ chars
   - Submit → redirects to `https://testbouncers.getrentalflow.com/admin/login`

2. **Log in** at that URL with the email/password you just set
   - You should see the admin dashboard
   - You should NOT see ANY of IAF's data (bookings, products, etc.)

3. **Branding**: `/admin/settings/branding` → change colors, hit Save → refresh public site

4. **Billing**: `/admin/settings/billing` → pick a tier → goes to Stripe
   Checkout (use test card 4242 4242 4242 4242) → 14-day trial activates

5. **Stripe Connect**: `/admin/settings/payments` → "Connect Stripe" → onboarding flow → returns Active

6. **As superadmin** (your IAF login): visit `/superadmin/tenants` →
   see the new tenant in the list

## 🚨 Things to watch for

- **RLS leaks**: when testing as second tenant, if you EVER see IAF data
  (products, bookings, etc.) → that's a bug, report immediately
- **Stripe webhook**: check Stripe Dashboard → Webhooks → your endpoint →
  recent deliveries. Should be 200 OKs.
- **Email confirmations**: signups skip Supabase email verification
  (email_confirm=true) but production traffic should consider re-enabling

## Files reference

- **SQL migrations**: `supabase/multi_tenant_*.sql`
- **Tenant resolution**: `middleware.ts` + `lib/tenant/resolve.ts`
- **Auto-scoping**: `lib/tenant/scope.ts` + `lib/supabase/admin.ts`
- **Stripe Connect**: `lib/stripe/connect.ts`
- **Tenant billing**: `lib/stripe/billing.ts`
- **Pages**: `/marketing`, `/signup`, `/admin/settings/payments`,
  `/admin/settings/branding`, `/admin/settings/billing`, `/superadmin/tenants`
- **Migration pattern docs**: `docs/multi-tenant-migration.md`
