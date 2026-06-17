"""Tech 1 — Welcome. The first thing a new engineer reads."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 1, 'Welcome',
        'A 10-minute orientation. Read this first, then pick the next chapter based on what you need.',
        audience_tags=['New Engineer'])

    api['add_h2'](doc, '1.1  What you are about to work on')

    api['add_p'](doc,
        'RentalFlow is a multi-tenant SaaS platform that runs rental businesses end-to-end. '
        'One codebase, one Vercel deployment, one Supabase database — serving every tenant\'s '
        'public site, customer portal, driver app, admin panel, and the platform owner\'s '
        'superadmin backoffice. The flagship customer is It\'s Always Fun (IAF) in Jacksonville. '
        'Other tenants are onboarding.')

    api['add_callout'](doc, 'info',
        'If you came in expecting "a small marketing site," recalibrate. This is a real product '
        'with 11 live integrations, 13 cron jobs, 88 database tables, 197 RLS policies, and '
        '~273 .ts files. Treat changes carefully.')

    api['add_h2'](doc, '1.2  Three mental models you need right away')

    api['add_data_sheet'](doc,
        title='Model 1 — Six surfaces, one codebase',
        subtitle='Routing is everything.',
        fields=[
            ('Marketing site',  'getrentalflow.com (apex). Lead capture, free-tools, signup.'),
            ('Public tenant site', '*.getrentalflow.com OR a custom domain (itsalwaysfun.com). The customer-facing rental site.'),
            ('Customer portal', '<tenant>/portal — returning customers see bookings, loyalty, referrals.'),
            ('Driver mobile app', '<tenant>/driver — installable PWA for the team in the field.'),
            ('Admin panel', '<tenant>/admin — tenant operator + staff console. 81 surfaces.'),
            ('Superadmin', 'getrentalflow.com/superadmin — Ludmila\'s platform-wide backoffice.'),
            ('How the right surface is chosen', 'middleware.ts inspects Host + path on every request. '
             'See Chapter 7 (Routing).'),
        ])

    api['add_data_sheet'](doc,
        title='Model 2 — Every multi-tenant query is auto-scoped',
        subtitle='lib/tenant/scope.ts is sacred ground.',
        fields=[
            ('The proxy', 'createAdminClient() wraps the Supabase client. On every query against a table '
             'in MULTI_TENANT_TABLES, the proxy adds .eq("tenant_id", current_tenant_id) automatically.'),
            ('Why it matters', 'You almost never write tenant_id by hand. If you DO need to write to a '
             'specific tenant, use createAdminClient({ unscoped: true }) — and have a good reason.'),
            ('Defense in depth', 'Postgres RLS is the second wall. 197 policies live. The proxy + RLS '
             'together make cross-tenant leaks loud failures, not silent ones.'),
            ('When adding a new table', 'If it has tenant_id, ADD IT to MULTI_TENANT_TABLES in '
             'lib/tenant/scope.ts. If it inherits via parent FK, add it to INTENTIONALLY_NOT_SCOPED. '
             'Run `npm run check:scope` to verify.'),
        ])

    api['add_data_sheet'](doc,
        title='Model 3 — Server actions are the default, API routes are for external callers',
        subtitle='Next.js App Router pattern.',
        fields=[
            ('Server actions', 'actions.ts files colocated with pages. Form submissions, mutations, '
             'state changes. Cookie-authed, tenant-scoped automatically. Use these for admin/portal/driver.'),
            ('API routes', 'app/api/*/route.ts. For external callers — Stripe webhooks, GHL inbound, '
             'cron jobs, programmatic v1 API. Different auth patterns (signature, Bearer, etc.).'),
            ('Rule', 'If a button on /admin needs to do something, write a server action. '
             'If an external system needs to call us, write an API route.'),
        ])

    api['add_h2'](doc, '1.3  How to use this document')

    api['add_kv_table'](doc,
        ['You want to…', 'Read'],
        [
            ('Get your local dev environment working',  'Chapter 2 (Local Setup)'),
            ('Commit your first change',                'Chapter 3 (Daily Workflow)'),
            ('Add a new admin page / email / cron',     'Chapter 4 (Recipes)'),
            ('Understand the framework + dep choices',  'Chapter 5 (Tech Stack)'),
            ('Understand multi-tenant safety',          'Chapter 6 (Multi-Tenant)'),
            ('Understand how requests get routed',      'Chapter 7 (Routing)'),
            ('Touch the booking / payment flow',        'Chapter 8 (Booking Wizard)'),
            ('Look up an admin page detail',            'Chapter 9 (Admin Reference)'),
            ('Call or change an API endpoint',          'Chapter 10 (API Reference)'),
            ('Touch a cron job',                        'Chapter 11 (Background Jobs)'),
            ('Touch the database schema',               'Chapter 12 (Data Dictionary)'),
            ('Touch an integration (Stripe, GHL, etc.)','Chapter 13 (Integrations)'),
            ('Understand the security posture',         'Chapter 14 (Security)'),
            ('Understand deploys, monitoring, backups', 'Chapter 15 (Operations)'),
            ('See what\'s on the tech-debt list',       'Chapter 16 (Tech Debt)'),
        ],
        col_widths=[3.4, 3.7])

    api['add_h2'](doc, '1.4  The 5 things that will surprise you')

    api['add_callout'](doc, 'info',
        '1. The same `/admin/foo` URL belongs to a DIFFERENT tenant depending on the hostname. '
        'There is no /admin/iaf/foo — the host determines the tenant_id, full stop.')
    api['add_callout'](doc, 'info',
        '2. The Customer Portal uses a custom OTP flow via Resend, not Supabase magic links. '
        'Look at /portal/login server actions if you touch portal auth.')
    api['add_callout'](doc, 'info',
        '3. Drivers can also log in to /admin/* but the layout redirects them away from most pages. '
        'See app/admin/layout.tsx allowed-paths whitelist.')
    api['add_callout'](doc, 'info',
        '4. The Stripe webhook handler is THE most-edited file. Read it before touching anything '
        'in /api/bookings/*.')
    api['add_callout'](doc, 'info',
        '5. SQL migrations are pure SQL files in supabase/. No timestamp prefix. ALL_MIGRATIONS.sql '
        'is the dependency-ordered concatenation. Apply with `supabase db query --linked --yes -f <file>`.')

    api['add_h2'](doc, '1.5  Things NOT to do without asking')

    api['add_bullet'](doc, [
        ('Edit middleware.ts ', True),
        ('— affects every request on every surface. Always preview-deploy before merging.', False),
    ])
    api['add_bullet'](doc, [
        ('Add a new table without updating ', False),
        ('MULTI_TENANT_TABLES', True),
        (' in lib/tenant/scope.ts.', False),
    ])
    api['add_bullet'](doc, [
        ('Use the service-role Supabase key in client code ', False),
        ('— that key bypasses RLS and is server-only.', True),
    ])
    api['add_bullet'](doc, [
        ('Run `git push --force` to main.', True),
    ])
    api['add_bullet'](doc, [
        ('Add `console.log` to production code ', False),
        ('— there are 30 in the repo and 21 are in scripts. Keep that ratio.', True),
    ])
    api['add_bullet'](doc, [
        ('Skip writing the Zod schema on a new server action. ', True),
        ('Every action validates its input at the boundary.', False),
    ])

    api['add_h2'](doc, '1.6  How to ask for help')

    api['add_p'](doc,
        'Henry is the technical lead. Ludmila is the operator and product owner. Convention: '
        'before opening a PR that touches sensitive areas (Stripe webhook, scope.ts, middleware), '
        'sketch the approach in conversation. After that, branch + preview deploy + verify '
        'against a real tenant host (the IAF preview URL is the canonical test).')
