"""Investor 3 — The Product. What actually exists today."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 3, 'The Product',
        'Six surfaces, one codebase. 11 integrations live. This chapter walks the actual product.',
        audience_tags=['Angel', 'Pre-Seed'])

    api['add_h2'](doc, '3.1  Six surfaces, one platform')

    api['add_p'](doc,
        'RentalFlow is six logically distinct products served from one codebase + one Vercel '
        'deployment + one Supabase database. The customer never sees the seams. The operator '
        'sees everything.')

    api['add_kv_table'](doc,
        ['Surface', 'Who uses it', 'What it does'],
        [
            ('Marketing site',
             'Prospects researching RentalFlow',
             'Lead capture, free-tools, signup. Lives at getrentalflow.com.'),
            ('Public tenant site',
             'End customers booking a rental',
             'itsalwaysfun.com — full catalog, 5-step booking wizard, payment, confirmation.'),
            ('Customer portal',
             'Returning customers',
             'Loyalty points, referral codes, booking history, profile, weather-cancel.'),
            ('Driver mobile app',
             'Drivers in the field',
             'Installable PWA. Daily route, navigation, proof photos, status updates.'),
            ('Admin panel',
             'Tenant operator + staff',
             '81 surfaces. Bookings, dispatch, products, inventory, reports, settings.'),
            ('Superadmin',
             'Ludmila (SaaS owner)',
             'Cross-tenant view, billing, support tickets, unified IMAP inbox, KB.'),
        ],
        col_widths=[1.7, 2.0, 3.4])

    api['add_h2'](doc, '3.2  Everything a $99 customer gets')

    api['add_callout'](doc, 'value',
        'The pitch fits on a napkin: one $99 subscription replaces 6-8 different SaaS tools '
        'AND adds capabilities the Frankenstein stack literally cannot deliver.')

    api['add_kv_table'](doc,
        ['Capability', 'What it replaces', 'What\'s unique'],
        [
            ('Branded website + booking wizard',
             'Squarespace + Calendly + booking bolts',
             'Booking knows your inventory + day-1/day-2+ pricing + add-ons + tax + waivers.'),
            ('Payments + Stripe Connect',
             'Standalone Stripe / Square',
             'Money lands in YOUR bank — RentalFlow never touches it. Connect handles the split.'),
            ('Customer portal',
             'Calling customers + Excel CRM',
             'Customer sees own bookings, points, referrals — without ever calling.'),
            ('Driver mobile app (PWA)',
             'Printed route sheets',
             'Native-feel app. Works offline. Photo proof. Tap-to-navigate.'),
            ('Admin dispatch + calendar',
             'Google Sheets + paper',
             'Drag-and-drop route assignment. Per-route stop ordering. Status sync.'),
            ('Email + SMS lifecycle',
             'Mailchimp + Twilio direct',
             'Confirmation, 3d reminder, review request, 90d re-engagement, anniversary — '
             'all automated with per-tenant template editor.'),
            ('Loyalty + referrals',
             'Custom-built spreadsheets',
             'Points per $1 + redemption + W-9 collection + 1099 generation for referrer payouts.'),
            ('Reports + P&L',
             'QuickBooks + bookkeeper',
             'Live revenue by week/month. Cost margins. Custom reports. 1099-NEC exports.'),
            ('CRM sync + automation',
             'GoHighLevel + manual exports',
             'Every booking + abandoned cart auto-syncs to GHL with custom field mapping.'),
            ('Inbox + reply tooling',
             'FrontApp + Gmail forwarding',
             'IMAP-backed unified inbox in /superadmin. Per-tenant inbox in /admin/inbox.'),
            ('Inspections + waivers + COI',
             'Paper checklists + waiver PDFs',
             'Per-product checklist templates. E-signature waivers. COI request workflow.'),
            ('AI admin assistant',
             'Asking your accountant',
             'Claude API answers "what made money last month" against your own data.'),
            ('AI route optimizer',
             'Friday-night puzzle on paper',
             'GPT-4o reads bookings + drivers + skill/ZIP profiles + vehicles, proposes Saturday '
             'routes with reasoning + warnings. Operator approves or adjusts. Saves ~30 min/week '
             'per tenant. Added 2026-06-18.'),
            ('QuickBooks Online export',
             'Manual data entry into QBO',
             'Sales Receipts + Customers CSV exports match QBO import format directly. '
             'Bookkeeper imports in 3 clicks. Added 2026-06-18.'),
            ('High-ticket approval workflow',
             'Hoping staff doesn\'t mistake a $5k order',
             'Tenant config sets threshold; bookings over it pause for admin sign-off before '
             'the confirmation email goes out. Built-in approve / reject (with reason) on the '
             'booking detail page. Added 2026-06-18.'),
            ('Honest competitor comparison',
             'Hoping prospects don\'t find one',
             '/marketing/vs/[competitor] for 4 competitors (InflatableOffice, Goodshuffle Pro, '
             'Booqable, TapGoods) with side-by-side feature tables + where-they-win + '
             'where-we-win + honest TL;DR. Added 2026-06-18.'),
        ],
        col_widths=[2.0, 2.0, 3.1])

    api['add_h2'](doc, '3.3  By the numbers')

    api['add_stats_strip'](doc, [
        ('273', 'TS files',         P['NAVY']),
        ('81',  'admin pages',      P['BLUE']),
        ('51',  'API endpoints',    P['TEAL']),
        ('13',  'cron jobs',        P['GREEN']),
        ('88',  'DB tables',        P['PURPLE']),
        ('197', 'RLS policies',     P['AMBER']),
    ])

    api['add_p'](doc,
        '(Methodology: counts from filesystem inventory + AST/SQL parsing on the current main '
        'branch. Not estimates.)', italic=True, color=P['GRAY'], size=9)

    api['add_h2'](doc, '3.4  The integration surface — 11 live')

    api['add_kv_table'](doc,
        ['Integration', 'What it does for the customer'],
        [
            ('Stripe + Stripe Connect',
             'Per-tenant payouts. Customer money flows directly to operator\'s bank in 2 days.'),
            ('GoHighLevel',
             'Bidirectional CRM sync. Every booking + abandoned cart pushed automatically.'),
            ('Twilio (A2P 10DLC)',
             'Compliant SMS lifecycle (confirmation, reminder, review request).'),
            ('Resend',
             'Transactional + marketing email with per-tenant sender domain support.'),
            ('Supabase',
             'Database + Auth + Storage + Realtime — the platform spine.'),
            ('Sentry',
             'Error tracking + cron monitors. SLA alerts on background jobs.'),
            ('Google Places',
             'Auto-aggregates Google reviews into the public /reviews page.'),
            ('IMAP/SMTP (imapflow, nodemailer)',
             'Unified inbox for the platform owner — replaces Front / Help Scout.'),
            ('AWS S3 + Cloudflare R2',
             'Dual-target weekly backups for disaster recovery.'),
            ('Upstash Redis',
             'Sliding-window rate limiting on the hot path.'),
            ('Anthropic Claude + OpenAI',
             'Admin assistant + public chat + AI-suggested email replies.'),
        ],
        col_widths=[2.4, 4.7])

    api['add_callout'](doc, 'fact',
        'Each integration represents 1-3 weeks of figuring-out-the-edge-cases work. The IMAP '
        'inbox alone solved Node 22 ESM compatibility, mailparser quirks, isomorphic-dompurify '
        'lazy loading, and imapflow SEARCH+FETCH patterns. Operators who buy RentalFlow are '
        'buying a year of integration work pre-done.')

    api['add_h2'](doc, '3.5  The depth that surprises people')

    api['add_p'](doc, 'Three details that consistently surprise investors who only see the pitch:')

    api['add_data_sheet'](doc,
        title='Multi-tenant safety is real, not theoretical',
        subtitle='Most multi-tenant SaaS at this stage cuts corners. We did not.',
        fields=[
            ('Auto-scoping proxy', 'lib/tenant/scope.ts wraps every Supabase query. Tenant ID '
                                    'injected automatically.'),
            ('RLS as defense in depth', '197 PostgreSQL Row-Level Security policies. Even if app '
                                         'code is wrong, the database refuses cross-tenant reads.'),
            ('Audit closed in June 2026', '3 critical + 2 high + 6 medium gaps shipped. OBS-2 '
                                            '(drop default tenant_id) converts silent leaks to NOT NULL violations.'),
        ])

    api['add_data_sheet'](doc,
        title='Booking flow handles the hard cases',
        subtitle='Most platforms fail at the race conditions.',
        fields=[
            ('15-minute payment hold', 'Customer reserves the slot for 15 min while paying — slot '
                                        'auto-reopens if they abandon.'),
            ('Idempotent Stripe webhook', '3-day retry-safe. Late retries do nothing because handler '
                                            'checks status before updating.'),
            ('Rate limit on hot path', '10 booking attempts per IP per minute. Upstash sliding window.'),
            ('Abandoned cart recovery', '30-min idle → GHL workflow + Resend email with resume link.'),
            ('Dual-day-1/day-2+ pricing', 'Day 1 full rate. Days 2+ 30% surcharge. Weekend override. '
                                            'Multi-day rentals handled correctly.'),
        ])

    api['add_data_sheet'](doc,
        title='Operator-friendly admin',
        subtitle='Built by someone who uses it daily.',
        fields=[
            ('81 admin pages', 'Not bloat — depth. Bookings, calendar, dispatch, products, '
                                 'inventory, reports, marketing, settings, support, AI assistant.'),
            ('Per-tenant defaults', '"It just works" out of the box — email templates, FAQs, '
                                      'home page sections, color scheme — all pre-seeded.'),
            ('Onboarding wizard + nudges', 'Tenant-side: /admin/onboarding checklist. Cron-side: '
                                             '/api/cron/onboarding-nudge emails reminders after day 7.'),
        ])

    api['add_h2'](doc, '3.6  The roadmap is not "vibes"')

    api['add_p'](doc,
        'A 30/90/180 day list is included in Chapter 9 (Ask). The roadmap is grounded in the '
        'audit findings — see the comprehensive RentalFlow Technical Audit doc for the full '
        'engineering view. Highlights:')

    api['add_bullet'](doc, '30 days: CI on PR, integration tests, CSP headers, MFA enforcement, uptime monitor.')
    api['add_bullet'](doc, '90 days: customer-driven referral signup, approval workflow for high-ticket '
                            'bookings, e2e test suite, public OpenAPI spec for partners.')
    api['add_bullet'](doc, '180 days: split marketing site, migrate to formal SQL migration tool, '
                            'codegen DB types, e2e suite expansion, multi-region read replicas if scale demands.')
