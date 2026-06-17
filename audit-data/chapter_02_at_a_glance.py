"""Chapter 2 — System at a Glance. The dashboard view."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 2, 'System at a Glance',
        'A single-page tour of every moving part — what serves what, what calls what, '
        'and where the load lives.',
        audience_tags=['Owner', 'Acquirer', 'Engineer'])

    api['add_h2'](doc, '2.1  Six surfaces, one codebase')

    api['add_p'](doc,
        'RentalFlow is six logical products that share a single Next.js 14 App Router '
        'codebase and a single Supabase Postgres database. They are physically the same '
        'deployment but logically distinct — gated by middleware on hostname + path.')

    api['add_kv_table'](doc,
        ['Surface', 'Lives at', 'Who uses it', 'How tenant is resolved'],
        [
            ('Marketing site', 'getrentalflow.com (apex only)',
             'Prospects researching RentalFlow', 'N/A — apex is the marketing tenant'),
            ('Tenant public site', '*.getrentalflow.com OR custom domain (itsalwaysfun.com)',
             'End customers booking a rental', 'Hostname lookup → tenants table'),
            ('Customer portal', '<tenant>/portal',
             'Returning customers (loyalty, referrals, history)', 'Hostname + Resend OTP login'),
            ('Driver mobile app', '<tenant>/driver',
             'Drivers in the field with their phone', 'Hostname + admin role + MFA'),
            ('Admin panel', '<tenant>/admin',
             'Tenant operator + staff', 'Hostname + admin/staff role'),
            ('Superadmin', 'getrentalflow.com/superadmin',
             'Ludmila (SaaS owner)', 'Apex + is_superadmin flag'),
        ],
        col_widths=[1.5, 2.0, 2.0, 1.6])

    api['add_h2'](doc, '2.2  Request lifecycle (visual)')

    api['add_mono_block'](doc, """
                         ┌─────────────────────────────────┐
   Incoming HTTP          │   Vercel Edge Function          │
   ───────────────►       │   (regional, ~30ms cold start)  │
                         └────────────────┬────────────────┘
                                          │
                                          ▼
              ┌─────────────────────────────────────────────┐
              │  middleware.ts                              │
              │  1. Read Host header                        │
              │  2. resolveTenantByHostname(host)           │
              │     ▸ apex → marketing tenant               │
              │     ▸ subdomain → slug.getrentalflow.com    │
              │     ▸ custom_domain match                   │
              │  3. Inject x-tenant-id header               │
              │  4. Refresh Supabase auth session           │
              │  5. Gate /admin and /superadmin             │
              │  6. MFA gate if user has TOTP enrolled      │
              └────────────────┬────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        ┌──────────┐    ┌──────────┐    ┌─────────────┐
        │  Server  │    │  Server  │    │   Server    │
        │  Comp.   │    │  Action  │    │   API       │
        │  (page)  │    │ (form)   │    │   Route     │
        └────┬─────┘    └────┬─────┘    └──────┬──────┘
             │               │                 │
             └───────────────┼─────────────────┘
                             ▼
              ┌─────────────────────────────────┐
              │  createAdminClient()            │
              │  ▸ Supabase client wrapped in   │
              │    scopeToTenant() PROXY        │
              │  ▸ Auto .eq('tenant_id', X)     │
              │    on SELECT/UPDATE/DELETE      │
              │  ▸ Auto-inject tenant_id        │
              │    on INSERT/UPSERT             │
              │  ▸ Only for MULTI_TENANT_TABLES │
              └────────────────┬────────────────┘
                               ▼
                    ┌────────────────────┐
                    │  Supabase Postgres │
                    │  RLS = second wall │
                    └────────────────────┘
""", title='How a request becomes a database query')

    api['add_h2'](doc, '2.3  Integration map — what calls out, what calls in')

    api['add_mono_block'](doc, """
                              ┌────────────────────────────┐
                              │      RentalFlow Core       │
                              │    (Next.js + Supabase)    │
                              └─────────┬──────────┬───────┘
                                        │          │
   OUTBOUND                              │          │              INBOUND
   ════════                              │          │              ═══════
                                        │          │
   Stripe Connect ◄──── payments ───────┤          ├──── webhooks ──── Stripe
                                        │          │
   GoHighLevel  ◄──── upsert/note ──────┤          ├──── webhook ───── GHL forms
                                        │          │
   Twilio SMS   ◄──── send SMS ─────────┤          ├──── webhook ───── Email worker
                                        │          │                   (Cloudflare)
   Resend       ◄──── txn email ────────┤          │
                                        │          │
   IMAP/SMTP    ◄──── superadmin ───────┤          │
                                        │          │
   Sentry       ◄──── errors/cron ──────┤          │
                                        │          │
   AWS S3       ◄──── backups ──────────┤          │
                                        │          │
   Cloudflare R2◄──── backups ──────────┤          │
                                        │          │
   Upstash      ◄──── rate limit ───────┤          │
                                        │          │
   Anthropic    ◄──── AI assistant ─────┤          │
                                        │          │
   Google Places◄──── reviews fetch ────┘          │
""", title='Integration topology')

    api['add_h2'](doc, '2.4  Page count by surface')

    api['add_stats_strip'](doc, [
        ('14',  'Public pages',     P['NAVY']),
        ('7',   'Portal pages',     P['BLUE']),
        ('5',   'Driver pages',     P['TEAL']),
        ('56',  'Admin pages',      P['GREEN']),
        ('17',  'Superadmin pages', P['PURPLE']),
        ('3',   'Marketing pages',  P['AMBER']),
    ])

    api['add_callout'](doc, 'fact',
        '273 .ts/.tsx files under app/ — 101 page.tsx, 53 route.ts, 55 actions.ts, '
        '6 layout.tsx. 98 files under lib/. 13 reusable components under components/. '
        'Architecture clearly prefers colocated code over a monolithic shared layer.')

    api['add_h2'](doc, '2.5  Data lifecycle of a single booking')

    api['add_mono_block'](doc, """
   Day -X      CUSTOMER browses /rentals on itsalwaysfun.com
               ─►  Server fetches products (tenant-scoped via scope.ts proxy)

   Day -X      CUSTOMER picks date + product → /order-by-date wizard
               ─►  GET /api/products/[slug]  (unavailable dates for calendar)
               ─►  POST /api/bookings/check-and-hold
                     • Validates lead time + stock + coupon + gift card
                     • Creates Stripe PaymentIntent
                     • Inserts bookings row (status=pending_payment, hold 15 min)
               ─►  Stripe Elements collects card
               ─►  payment_intent.succeeded webhook
                     • status: pending_payment → confirmed
                     • Increment coupon counter
                     • Award loyalty points
                     • Send booking_confirmation email + SMS
                     • Upsert GHL contact + note + tags
                     • Fire booking.paid + booking.confirmed webhooks

   Day -3      CRON booking-emails fires booking_reminder_3d email + SMS

   Day 0       ADMIN assigns booking to dispatch_routes (drag-and-drop)
               DRIVER opens /driver/route/[id], navigates, marks delivered
                     • Updates dispatch_stops.delivered_at
                     • Reval /admin/dispatch + /driver + booking detail
                     • Bookings status → delivered (when all stops delivered)

   Day +1      CRON booking-emails fires booking_review_request email + SMS
                     • Links to Google review URL from site_settings

   Day +90     CRON booking-emails fires booking_reengagement_90d email
   Day +365    CRON booking-emails fires booking_anniversary_1y email
""", title='From browse to follow-up — the full email + SMS + dispatch arc')

    api['add_h2'](doc, '2.6  At a glance: where the load is')

    api['add_kv_table'](doc,
        ['Hottest endpoint', 'Why', 'Safeguard'],
        [
            ('POST /api/bookings/check-and-hold',
             'Hit on every booking attempt — creates Stripe PaymentIntent',
             'Upstash rate limit: 10/min per IP. 15-min hold expiration.'),
            ('GET /api/products/[slug]',
             'Hit on every item page load + every wizard date change',
             'Public route. Cached 60s. No tenant proxy.'),
            ('POST /api/webhooks/stripe',
             'Every payment event. Triggers cascade of effects (email, SMS, GHL).',
             'Idempotent: checks booking_status before update. Webhook signature.'),
            ('POST /api/contact',
             'Public contact form. Triple-redundant (DB + email + GHL webhook).',
             'Rate limit 5/5min per IP.'),
            ('POST /api/email/inbound',
             'Cloudflare worker forwards every inbound tenant email here.',
             'Shared secret header. Tenant resolution by domain or explicit slug.'),
            ('cron /api/cron/email-sync',
             'Every 5 min IMAP fetch for superadmin inbox. Per-account loop.',
             'Sentry monitor. Single connection per account. UID watermark.'),
        ],
        col_widths=[2.0, 2.5, 2.6])
