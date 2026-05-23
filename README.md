# It's Always Fun, LLC — Rental Management System

Internal admin dashboard + public API for **It's Always Fun, LLC** (Jacksonville, FL) — bounce house rental company.

This system replaces the existing expensive third-party provider, integrates with **GoHighLevel** (CRM/marketing), and uses **Stripe** for direct payments (100% upfront, no deposit).

---

## 🏗 Stack

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** + custom brand palette (yellow `#FFD700` + navy `#1a1a6e`)
- **Supabase** (Postgres + Auth) — free tier
- **Stripe** — direct integration (Payment Intents)
- **GoHighLevel** — webhooks (in/out)
- **Vercel** — deployment

---

## 📁 Project structure

```
app/
  page.tsx                    # Public landing → redirects to /admin/login
  layout.tsx                  # Root layout
  globals.css                 # Tailwind + custom components
  admin/
    layout.tsx                # Sidebar shell (auth-protected)
    login/page.tsx            # Sign-in form
    logout/route.ts           # POST → sign out
    dashboard/page.tsx        # Overview (KPI cards)
    products/                 # (session 2) CRUD
    bookings/                 # (session 2) table + filters
    availability/             # (session 2) calendar block/unblock
    settings/                 # (session 2) env-ish settings
  api/
    products/route.ts         # GET list active products
    products/[slug]/route.ts  # GET one + unavailable dates
    availability/route.ts     # GET availability check
    bookings/                 # (session 2) check-and-hold, etc.
    webhooks/
      ghl/route.ts            # (session 2) incoming booking forms
      stripe/route.ts         # (session 2) payment success/fail

lib/
  utils.ts                    # cn(), formatCurrency, formatDate
  supabase/
    client.ts                 # Browser client
    server.ts                 # Server-component client
    admin.ts                  # Service-role client (server only)
  stripe/                     # (session 2) Stripe SDK wrappers
  ghl/                        # (session 2) GHL API wrappers

middleware.ts                 # Auth guard for /admin/*
types/database.ts             # TS types for Product/Booking/BlockedDate

supabase/
  schema.sql                  # Tables + indexes + RLS + view
  seed.sql                    # 14 products pre-loaded
```

---

## 🚀 First-time setup

### 1. Clone + install

```bash
git clone https://github.com/FXpulse/itsalwaysfun-rental.git
cd itsalwaysfun-rental
npm install
```

### 2. Create Supabase project

1. Go to https://supabase.com → New Project
2. Name: `itsalwaysfun-rental` · Region: closest to Jacksonville (us-east-1)
3. Copy the **Project URL** and **API keys** (Settings → API)
   - `anon` (public) key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` (secret) key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ never expose

### 3. Run schema + seed

1. Supabase → SQL Editor → New query
2. Paste contents of `supabase/schema.sql` → Run
3. New query → paste `supabase/seed.sql` → Run
4. Verify: `SELECT * FROM products;` → 14 rows

### 4. Create admin user

In Supabase: **Authentication → Users → Add user (email)**
- Email: `admin@itsalwaysfun.com` (or your preferred)
- Password: strong (write it down)
- Email confirmed: ✓

### 5. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in:
- Supabase URL + keys (from step 2)
- Stripe keys (next step)
- GHL PIT + secrets

### 6. Stripe setup

1. Go to https://dashboard.stripe.com → register for **Its Always Fun, LLC** if not already
2. Settings → Developers → API keys → copy:
   - Publishable key → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - Secret key → `STRIPE_SECRET_KEY`
3. Webhook secret comes later (in session 2 when we set up `/api/webhooks/stripe`)

### 7. GHL setup

1. In `panel.sclickmedia.com` → sub-account "It's Always Fun, LLC" (location `0TI1hA6fSt9I7GDtcZbh`)
2. Settings → Private Integrations → Create PIT
3. Scopes needed: `contacts.write`, `contacts.read`, `opportunities.write`, `workflows.write`
4. Paste PIT into `.env.local` as `GHL_API_KEY`
5. `GHL_WEBHOOK_SECRET`: invent a strong random string. You'll use this when configuring the GHL webhook destination in session 2.

### 8. Run dev server

```bash
npm run dev
```

→ Open http://localhost:3000

→ Click "Sign in to dashboard"
→ Login with the admin email/password from step 4
→ You should see the Dashboard with 0/0/$0/0 cards (empty DB)

### 9. Test the API

```bash
# List active products
curl http://localhost:3000/api/products

# Get single product
curl http://localhost:3000/api/products/all-star-sports-arena

# Check availability for tomorrow
curl "http://localhost:3000/api/availability?product_id=<uuid>&date=2026-05-23"
```

---

## 🌐 Deploy to Vercel

1. Push to GitHub: `git push origin main`
2. https://vercel.com → New Project → Import the repo
3. Add **environment variables** (same as `.env.local`)
4. Deploy
5. Custom domain: connect `app.itsalwaysfun.net` (or whatever subdomain you choose) — recommend NOT taking over `itsalwaysfun.net` until full flow tested

---

## 🔐 Security notes

- All `/admin/*` routes auto-protected by `middleware.ts`
- `SUPABASE_SERVICE_ROLE_KEY` is server-side ONLY (never `NEXT_PUBLIC_*`)
- Public API endpoints (`/api/products`, `/api/availability`) intentionally do not require auth — but never expose write operations there
- Webhook validation (Stripe + GHL) implemented in session 2

---

## 📅 Roadmap (this is Phase 1 — scaffold)

**Done (session 1, this commit)**:
- ✅ Project scaffold + dependencies
- ✅ Supabase schema + seed (14 products)
- ✅ Admin auth (Supabase Auth) + login page + middleware
- ✅ Admin layout shell with sidebar nav
- ✅ Dashboard with basic KPI cards
- ✅ Public API: `/api/products`, `/api/products/[slug]`, `/api/availability`

**Session 2**:
- Admin pages: Products CRUD, Bookings table, Availability calendar, Settings
- Stripe Payment Intent integration (100% upfront)
- POST `/api/bookings/check-and-hold` (15-min hold prevents double-booking)
- POST `/api/webhooks/stripe` (payment success/fail handling)
- POST `/api/webhooks/ghl` (incoming booking from GHL form)
- Outbound GHL: update opportunity stage on payment confirmation

**Session 3**:
- Polish, mobile responsiveness pass
- Vercel deploy with real env vars
- DNS strategy decision (itsalwaysfun.net direct OR app.itsalwaysfun.net subdomain)
- End-to-end test with real Stripe webhook + real GHL form submission

---

## 💸 Payment policy (IMPORTANT)

**100% upfront — no deposit, no balance due later.**

NEVER use the words "deposit", "down payment", "balance due" anywhere in UI, emails, or workflows. The customer pays the full rental price at the time of booking. The button is **"Pay & Confirm Rental"**, never "Pay Deposit" or "Submit Request".

---

## 🆘 Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `Missing env variable NEXT_PUBLIC_SUPABASE_URL` | `.env.local` not loaded | Restart `npm run dev` after editing |
| Login form errors silently | Supabase auth user not created | Re-do Step 4 |
| `/api/products` returns empty | Seed not run | Re-run `seed.sql` in SQL Editor |
| Dashboard `count: null` everywhere | RLS blocking | Confirm service role key in `.env.local` |

---

## 👤 Owner

- Business: It's Always Fun, LLC (Jacksonville, FL)
- Built by: Social Click Media (Ludmila Henry)
- Stack chosen for: low operational cost, full ownership of data, future SaaS-ability
