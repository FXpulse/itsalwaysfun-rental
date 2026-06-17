"""Chapter 5 — Routing & Middleware. Where every request enters the system."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 5, 'Routing & Middleware',
        'How a single request finds its tenant, its session, and its access level in 30ms.',
        audience_tags=['Engineer'])

    api['add_h2'](doc, '5.1  Why middleware does so much')

    api['add_p'](doc,
        'middleware.ts is the gatekeeper for every incoming request. Because RentalFlow '
        'serves six logical products from one deployment, the routing decision tree has to '
        'cover apex vs subdomain vs custom-domain, auth state, MFA, role-based gating, and '
        'a legacy redirect from the previous .net domain.')

    api['add_callout'](doc, 'risk',
        'A failure in middleware.ts affects ALL six surfaces simultaneously. This is the '
        'single highest-leverage piece of code in the system. Sentry has full instrumentation, '
        'and /api/health gives a separate diagnostic surface. Any change to middleware.ts '
        'warrants a preview deploy verification across at least 3 tenant hosts.')

    api['add_h2'](doc, '5.2  The decision tree')

    api['add_mono_block'](doc, """
   request arrives at middleware.ts
                 │
                 ▼
   ┌────────────────────────────────────────┐
   │ Legacy redirect (308)                  │
   │ host = itsalwaysfun.net                │
   │   ─►  www.itsalwaysfun.com             │
   │ host = www.itsalwaysfun.net            │
   │   ─►  www.itsalwaysfun.com             │
   └────────────────────────────────────────┘
                 │
                 ▼
   tenant = await resolveTenantByHostname(host)
                 │
                 ▼
   ┌──────────────────────────────────────────────────────┐
   │ Free-tools cross-domain enforcement                  │
   │ pathname starts with /free-tools                     │
   │ AND tenant.resolved_via != 'marketing'               │
   │   ─►  redirect to https://getrentalflow.com + path   │
   └──────────────────────────────────────────────────────┘
                 │
                 ▼
   ┌──────────────────────────────────────────────────────┐
   │ Apex (marketing) tenant logic                        │
   │ tenant.resolved_via == 'marketing'                   │
   │  │                                                   │
   │  ├─ unknown subdomain (e.g. random.getrentalflow.com)│
   │  │   ─►  redirect to https://getrentalflow.com/      │
   │  ├─ pathname '/'        ─►  rewrite to /marketing    │
   │  ├─ /free-tools/*       ─►  rewrite to /marketing/*  │
   │  ├─ /admin/*            ─►  redirect /superadmin/log │
   │  └─ /portal or /driver  ─►  redirect '/'             │
   └──────────────────────────────────────────────────────┘
                 │
                 ▼
   ┌──────────────────────────────────────────────────────┐
   │ Inject x-tenant-* headers                            │
   │   x-tenant-id    = tenant.id                         │
   │   x-tenant-slug  = tenant.slug                       │
   │   x-tenant-via   = tenant.resolved_via               │
   │ Refresh Supabase auth session cookie                 │
   └──────────────────────────────────────────────────────┘
                 │
                 ▼
   ┌──────────────────────────────────────────────────────┐
   │ Admin gating                                         │
   │ pathname starts with /admin AND !user                │
   │   ─►  /admin/login?next={pathname}                   │
   │ pathname == /admin/login AND user is signed in       │
   │   ─►  /admin/dashboard                               │
   │ pathname starts with /admin AND user has TOTP        │
   │ enrolled AND user.aal1 (no MFA)                      │
   │   ─►  /admin/mfa-verify?next={pathname}              │
   └──────────────────────────────────────────────────────┘
                 │
                 ▼
   pass through ─► Server Component / Server Action / API
""", title='middleware.ts — the complete decision tree')

    api['add_h2'](doc, '5.3  resolveTenantByHostname — the lookup')

    api['add_p'](doc,
        'The lookup is a single SELECT against tenants — but with a small in-memory LRU '
        'in front of it that caches the result for ~30 seconds. At 30 RPS that\'s 30 '
        'cached lookups vs 30 DB roundtrips per second.')

    api['add_kv_table'](doc,
        ['Hostname pattern', 'Resolution', 'Notes'],
        [
            ('getrentalflow.com', 'apex marketing tenant',
             'special row in tenants.slug = "marketing". Apex serves /marketing.'),
            ('www.getrentalflow.com', 'apex marketing tenant',
             'Same as apex via DNS CNAME.'),
            ('itsalwaysfun.com', 'IAF custom_domain match',
             'Goes through full tenant flow.'),
            ('<anything>.getrentalflow.com', 'slug match on tenants.slug',
             'If no match found, redirect to apex /.'),
            ('Vercel preview domain', 'special whitelist',
             'Allows access to preview deploys without DNS.'),
        ],
        col_widths=[2.6, 1.9, 2.6])

    api['add_h2'](doc, '5.4  Headers injected on every request')

    api['add_kv_table'](doc,
        ['Header', 'Value', 'Read by'],
        [
            ('x-tenant-id', 'UUID from tenants.id',
             'createAdminClient(), every server action, every API route'),
            ('x-tenant-slug', 'tenants.slug',
             'Logging, breadcrumbs, business name display fallback'),
            ('x-tenant-via', '"marketing" | "subdomain" | "custom_domain"',
             'Gates which routes are reachable (drives 5.2 above)'),
        ],
        col_widths=[1.8, 2.4, 2.9])

    api['add_h2'](doc, '5.5  Auth + MFA flow')

    api['add_mono_block'](doc, """
   Admin types itsalwaysfun.com/admin/login
                  │
                  ▼
   Submits email + password → Supabase Auth (signInWithPassword)
                  │
                  ▼
   Supabase returns a session JWT (AAL1 = single factor)
                  │
                  ▼
   middleware on next request:
     user signed in?   ✓
     pathname /admin/*  ?  yes
     user has TOTP enrolled?   yes
     session AAL == 'aal1'?    yes
                  │
                  ▼
   Redirect → /admin/mfa-verify?next=/admin/dashboard
                  │
                  ▼
   User enters 6-digit TOTP → Supabase Auth (mfa.challengeAndVerify)
                  │
                  ▼
   Supabase upgrades session to AAL2
                  │
                  ▼
   Redirect → /admin/dashboard (now passes the MFA gate)
""", title='Admin sign-in with optional MFA')

    api['add_h2'](doc, '5.6  Why apex and tenants share one deployment')

    api['add_2col'](doc,
        'getrentalflow.com is the marketing site. It is the funnel where prospects discover '
        'RentalFlow, see pricing, request a demo, or sign up for a trial. It also hosts the '
        '/free-tools/* lead magnet pages (e.g. 1099-NEC tracker).',
        'Every tenant subdomain or custom domain (itsalwaysfun.com, brand.getrentalflow.com) '
        'is the actual rental management app: public catalog, booking wizard, portal, driver, '
        'admin. Same codebase, different hostname, different tenant_id.',
        left_title='Marketing apex',
        right_title='Tenant app')

    api['add_callout'](doc, 'warn',
        'Splitting the marketing site into a standalone Next.js project is on the 180-day '
        'roadmap. Today, a build error in /marketing breaks every tenant\'s public site too. '
        'Vercel preview deploys mitigate this, but architecturally, marketing should be '
        'isolated.')

    api['add_h2'](doc, '5.7  Routes by audience')

    api['add_kv_table'](doc,
        ['Path family', 'Audience', 'Auth requirement'],
        [
            ('/marketing/*, /free-tools/*, /signup',     'Prospects', 'None'),
            ('/, /rentals, /items/[slug], /category/*',  'Public end customer', 'None — tenant via host'),
            ('/order-by-date, /gift-cards, /contact, /reviews', 'Public customer', 'None'),
            ('/portal/*',                                'Returning customer', 'Resend OTP login'),
            ('/driver/*',                                'Driver', 'Supabase session + admin role + MFA'),
            ('/admin/*',                                 'Admin / staff', 'Supabase session + role + MFA gate'),
            ('/superadmin/*',                            'Ludmila', 'Supabase session + is_superadmin'),
            ('/api/v1/*',                                'Programmatic', 'rfk_* Bearer key + scope check'),
            ('/api/webhooks/*',                          'External services', 'Signature verification'),
            ('/api/cron/*',                              'Vercel cron',  'CRON_SECRET Bearer'),
        ],
        col_widths=[2.5, 2.0, 2.6])
