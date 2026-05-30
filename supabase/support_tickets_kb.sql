-- supabase/support_tickets_kb.sql
--
-- Two new surfaces for the "RentalFlow self-runs" autopilot vision:
--
--   1. support_tickets — tenants (bouncer co owners) report issues to the
--      RentalFlow operator (Ludmila). NOT customer-facing — this is the
--      tenant→operator channel, distinct from contact_messages which is
--      the customer→tenant channel.
--
--   2. kb_articles — operator-curated knowledge base. AI searches this
--      first when a ticket is submitted and drafts a suggested response.

-- ── SUPPORT TICKETS ──
do $$ begin
  create type ticket_status as enum ('open', 'in_progress', 'waiting_on_tenant', 'resolved', 'closed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type ticket_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null;
end $$;

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete set null,
  -- Snapshot tenant info so closed tickets keep context even if tenant deleted
  tenant_business_name text,
  tenant_owner_email text,
  -- Submission
  subject text not null,
  body text not null,
  category text,                    -- "billing" | "how-to" | "bug" | "cancel" | "other"
  priority ticket_priority not null default 'normal',
  status ticket_status not null default 'open',
  -- AI suggestions populated by the categorizer (lib/support/ai-triage.ts)
  ai_category text,                 -- AI's category guess
  ai_priority text,                 -- AI's priority guess
  ai_suggested_article_id uuid,     -- if AI found a matching KB article
  ai_suggested_response text,       -- AI-drafted response (operator reviews + sends)
  ai_confidence numeric(3,2),       -- 0.00–1.00
  ai_processed_at timestamptz,
  -- Resolution
  resolved_at timestamptz,
  resolved_by_email text,
  resolution_note text,
  -- Audit
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index support_tickets_status_idx on support_tickets (status, created_at desc);
create index support_tickets_tenant_idx on support_tickets (tenant_id, created_at desc);
create index support_tickets_category_idx on support_tickets (category);

-- Replies on a ticket (operator ↔ tenant thread)
create table public.support_ticket_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  author_email text not null,
  author_kind text not null,         -- "operator" | "tenant" | "ai"
  body text not null,
  is_internal boolean default false, -- internal note vs sent to tenant
  created_at timestamptz default now()
);
create index support_ticket_replies_ticket_idx on support_ticket_replies (ticket_id, created_at);

-- ── KNOWLEDGE BASE ──
create table public.kb_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body_md text not null,             -- markdown
  category text,                     -- groups articles (Billing, Setup, Bookings, etc.)
  tags text[] default '{}',
  is_published boolean default true,
  view_count integer default 0,
  helpful_count integer default 0,   -- "👍 helped me" votes
  unhelpful_count integer default 0, -- "👎 didn't help"
  ai_resolved_count integer default 0, -- times AI used this to auto-resolve a ticket
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index kb_articles_published_idx on kb_articles (is_published, category);
create index kb_articles_slug_idx on kb_articles (slug);

-- ── RLS ──
alter table support_tickets        enable row level security;
alter table support_ticket_replies enable row level security;
alter table kb_articles            enable row level security;

create policy "service_role_full_access" on support_tickets        for all using (auth.role() = 'service_role');
create policy "service_role_full_access" on support_ticket_replies for all using (auth.role() = 'service_role');
create policy "service_role_full_access" on kb_articles            for all using (auth.role() = 'service_role');

-- KB articles are publicly readable (tenants browse them) — allow anon select
create policy "public_read_kb" on kb_articles for select using (is_published = true);

-- ── Seed some starter KB articles so the AI has something to find ──
insert into kb_articles (slug, title, body_md, category, tags) values
(
  'getting-started',
  'Getting started with RentalFlow',
  '# Getting started

After signup you have 30 days free. To accept payments you need to connect Stripe at `/admin/settings/payments`.

## Recommended setup order
1. Business info at `/admin/site`
2. Upload logo + branding
3. Connect Stripe
4. Add your first rental product
5. Test a booking on your public site

Most tenants are taking real bookings within 60 minutes.',
  'Setup',
  '{"onboarding","setup"}'
),
(
  'connect-stripe',
  'Connect Stripe to accept payments',
  '# Connect Stripe

Go to `/admin/settings/payments` and click **Connect Stripe**. You will be sent to Stripe Express onboarding which takes about 10 minutes.

If you do not have a Stripe account yet, Stripe will create one during the flow. Payments land directly in your bank — RentalFlow does not handle the money.',
  'Billing',
  '{"stripe","payments"}'
),
(
  'change-pricing',
  'Change my subscription (monthly ↔ annual)',
  '# Switch plan or pause

At `/admin/settings/billing`:

- **Switch to annual**: save 17% vs monthly ($990/yr vs $99×12)
- **Pause subscription**: useful in your off-season. Pick 1, 3, or 6 months. Stripe auto-resumes on the date.

Both apply on your next billing cycle.',
  'Billing',
  '{"pricing","annual","pause"}'
),
(
  'cancel',
  'Cancel my account',
  '# Cancellation

Go to `/admin/settings/billing` and click **Manage**. You will be sent to the Stripe portal where you can cancel.

Cancellation takes effect at the end of your current billing period. Your data stays in our system for 90 days in case you reactivate.

If you need help exporting your data, reply to this article — we''ll help.',
  'Billing',
  '{"cancel","churn"}'
),
(
  'sync-ghl',
  'GoHighLevel integration',
  '# GHL sync

RentalFlow has a built-in webhook for GHL. Add the webhook URL from your GHL location settings, then bookings will sync as contacts + opportunities automatically.

The chat widget on getrentalflow.com is also GHL-powered — you can embed your own widget by editing the snippet in `/admin/site`.',
  'Integrations',
  '{"ghl","webhook","integration"}'
),
(
  '1099-end-of-year',
  '1099-NEC at year-end',
  '# 1099-NEC

For drivers paid more than $600 in a calendar year you need to issue a 1099-NEC. RentalFlow has an automated report at `/admin/reports/1099-nec` that:

1. Adds up all `driver_email` payments
2. Flags drivers over the IRS threshold
3. Lets you mark W-9 received and exports a CSV that goes straight into eFile4Biz / Track1099

There''s also a free tool you can share with prospects: https://getrentalflow.com/free-tools/1099-tracker',
  'Reports',
  '{"1099","taxes","drivers"}'
);
