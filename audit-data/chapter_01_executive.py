"""Chapter 1 — Executive Summary."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 1, 'Executive Summary',
        'The 5-minute version: what RentalFlow is, where it is strong, and where it has work to do.',
        audience_tags=['Owner', 'Acquirer', 'Investor', 'Engineer'])

    api['add_h2'](doc, '1.1  What is RentalFlow')
    api['add_p'](doc,
        'RentalFlow is a multi-tenant SaaS platform that runs rental businesses end-to-end: '
        'customer-facing booking site, customer portal with loyalty + referrals, a 56-surface admin '
        'console, a driver mobile PWA, a superadmin platform-owner backoffice, a programmatic v1 '
        'API, and 13 scheduled background jobs. The flagship customer is It\'s Always Fun, LLC '
        '(IAF) in Jacksonville, FL — an inflatable rentals business with its own custom domain '
        '(itsalwaysfun.com). The same codebase serves every other tenant on *.getrentalflow.com '
        'or a custom domain at $99/month flat.')

    api['add_callout'](doc, 'fact',
        'One Next.js 14 codebase, one Vercel deployment, one Supabase Postgres — '
        'serves the marketing site, every tenant\'s public site, every tenant\'s admin, the '
        'customer portal, the driver app, and the superadmin backoffice. Tenant identity is '
        'resolved on every request by hostname → tenants table → x-tenant-id header.')

    api['add_h2'](doc, '1.2  Headline assessment')

    api['add_callout'](doc, 'good',
        'Production-grade SaaS. The multi-tenant model is sound (auto-scoping proxy + RLS as '
        'defense-in-depth). Integration depth is unusual at this stage — Stripe Connect, GHL CRM, '
        'Twilio SMS, Resend, IMAP-backed superadmin inbox, Claude AI assistant, Google Places '
        'review sync. 115 SQL migrations and 197 RLS policies show this is actively, '
        'thoughtfully maintained.')

    api['add_callout'](doc, 'warn',
        'Test coverage is light — 19 test cases across 8 test files versus ~225 source files. '
        'Core pricing + multi-tenant isolation + booking-email idempotency ARE covered, but '
        'end-to-end and broad integration tests are absent. For a payment-processing SaaS this '
        'is the single biggest gap before scaling past ~20 tenants.')

    api['add_callout'](doc, 'info',
        'Two products share one repository — the marketing site (getrentalflow.com apex) and the '
        'tenant app (subdomains + custom domains). A failed deploy affects both. Middleware-based '
        'routing keeps them logically isolated, but they are architecturally coupled. Splitting '
        'marketing is a clear recommendation for the next 180 days.')

    api['add_h2'](doc, '1.3  Top 5 strategic findings')

    api['add_kv_table'](doc,
        ['Type', 'Finding', 'Detail'],
        [
            ('STRENGTH', 'Multi-tenant model is robust',
             'Auto-scoping via lib/tenant/scope.ts proxy + 197 RLS policies. 2026-06-10 audit '
             'closed 3 critical + 2 high + 6 medium gaps. OBS-2 (drop default tenant_id) is '
             'load-bearing — silent leaks are now NOT NULL violations.'),
            ('STRENGTH', 'Integration depth is unusual at this maturity',
             '11 integrations live: Stripe + Stripe Connect, GoHighLevel, Twilio, Resend, Sentry '
             '(with cron monitors on all 13 jobs), AWS S3 + Cloudflare R2, Upstash, IMAP/SMTP, '
             'Claude API, Google Places. Most $99/mo SaaS at this stage have 3 integrations max.'),
            ('STRENGTH', 'Defense-in-depth on the booking flow',
             'Webhook idempotency, 15-min payment hold expiration, paid-only inventory blocking, '
             'rate-limited public endpoints, server-side re-validation, audit log on every admin '
             'action. The hot path has been hardened repeatedly.'),
            ('GAP', 'Test coverage is minimal',
             '19 tests / ~225 source files. No e2e (Playwright/Cypress). The integration suite '
             'covers multi-tenant isolation + email idempotency only. Recommend 10+ booking-flow '
             'tests + 3 e2e happy paths before next 10 tenants.'),
            ('RISK', 'Single repo serves marketing AND tenant app',
             'A bad deploy on getrentalflow.com affects every tenant\'s public site simultaneously. '
             'Mitigated by middleware routing + Vercel preview deploys, but architecturally '
             'coupled. Splitting marketing into its own Next.js project is a 1-week task with '
             'significant blast-radius benefit.'),
        ],
        col_widths=[1.0, 1.9, 4.2])

    api['add_h2'](doc, '1.4  System volumetrics')

    api['add_stats_strip'](doc, [
        ('273',  'admin/lib TS files',   P['NAVY']),
        ('115',  'SQL migrations',        P['BLUE']),
        ('88',   'tables',                P['TEAL']),
        ('197',  'RLS policies',          P['GREEN']),
        ('51',   'API routes',            P['PURPLE']),
        ('13',   'cron jobs',             P['AMBER']),
    ])

    api['add_stats_strip'](doc, [
        ('56',  'admin pages',          P['NAVY']),
        ('17',  'superadmin pages',     P['BLUE']),
        ('11',  'integrations',         P['TEAL']),
        ('41',  'SQL functions',        P['GREEN']),
        ('210', 'DB indexes',           P['PURPLE']),
        ('43+', 'env variables',        P['AMBER']),
    ])

    api['add_p'](doc, '(Methodology: counts from filesystem inventory + AST/SQL parsing. See Chapter 18 '
                       'for the full debt audit.)', italic=True, color=P['GRAY'], size=9)

    api['add_h2'](doc, '1.5  How this audit is structured')

    api['add_kv_table'](doc,
        ['Block', 'Chapters', 'Reader benefit'],
        [
            ('Overview', '1 – 5',
             'Architecture mental model in 25 pages. Read first regardless of audience.'),
            ('Surfaces', '6 – 11',
             'Per-page data sheets. The "what does it actually do" reference.'),
            ('Technical reference', '12 – 15',
             'API contracts, cron logic, full data dictionary, integration playbooks.'),
            ('Audit findings', '16 – 19',
             'Security posture, operational maturity, technical debt, prioritized roadmap.'),
        ],
        col_widths=[1.6, 1.2, 4.3])
