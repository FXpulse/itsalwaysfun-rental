"""Chapter 19 — Recommendations & Roadmap. 30 / 90 / 180 day plan.

Reflects state AS OF 2026-06-18 — items that shipped before this audit are
listed in the "Recently shipped" block, not in the recommendation list. The
2026-06-18 marathon session closed 8 additional items (UptimeRobot live,
AI route optimizer, Playwright e2e setup, QBO export, lead-magnet decouple
from GHL, referrer coupon self-rename, strip any in lib/email, per-tenant
Twilio numbers).
"""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 19, 'Recommendations & Roadmap',
        'A prioritized 30 / 90 / 180-day plan grounded in the findings of chapters 16-18.',
        audience_tags=['Owner', 'Engineer', 'Investor'])

    api['add_callout'](doc, 'fact',
        'Recommendations are scoped to what is NOT yet shipped. The June 2026 sprint, the '
        '2026-06-17 hardening wave, AND the 2026-06-18 marathon (10 features total including '
        'the approval workflow + 4-competitor comparison landing pages) together closed '
        '24 items previously on the roadmap. They are called out separately so the '
        'recommendation list does not duplicate them.')

    api['add_h2'](doc, '19.1  Recently shipped (June 2026)')

    api['add_p'](doc,
        'These items appeared on earlier roadmap drafts. They are shipped on main and verified '
        'against the current codebase. They should NOT reappear as recommendations.')

    api['add_kv_table'](doc,
        ['Item', 'Where it landed', 'Status'],
        [
            ('GitHub Actions CI on PR',
             '.github/workflows/ci.yml — typecheck + lint + tests + scope-check + '
             'integration-tests jobs',
             'LIVE'),
            ('check:scope wired into CI (OBS-1)',
             'scope-check job in ci.yml runs scripts/check-tenant-scope.ts',
             'LIVE'),
            ('CSP headers in middleware (SEC-1)',
             'next.config.js — Content-Security-Policy with Stripe + GHL + GA allowlist',
             'LIVE'),
            ('Dependabot CVE scanning (SEC-9)',
             '.github/dependabot.yml — weekly npm + Actions, grouped minor/patch',
             'LIVE (shipped 2026-06-17)'),
            ('Rate limits on public reads (SEC-5)',
             '60/min/IP on /api/products, /api/products/[slug], /api/availability via Upstash',
             'LIVE (shipped 2026-06-17)'),
            ('EMAIL_ENCRYPTION_KEY rotation runbook (SEC-6)',
             'docs/runbook-rotate-email-encryption-key.md + scripts/rotate-email-encryption-key.ts',
             'LIVE (shipped 2026-06-17)'),
            ('MFA enforcement policy (SEC-3)',
             'site_settings.require_admin_mfa per-tenant switch + admin layout gate + UI toggle',
             'LIVE (shipped 2026-06-17, default off)'),
            ('PII scrubbing hardened',
             'lib/sentry/scrub-pii.ts: +6 patterns (rfk_, pit-, re_, sk-ant-, sk-proj-, E.164) '
             '+ REDACT_KEYS field-name redaction + 27 unit tests',
             'LIVE (shipped 2026-06-17)'),
            ('OpenAPI 3.0 spec + Swagger UI',
             '/api/v1/openapi.json + /api/v1/docs (Swagger UI via CDN)',
             'LIVE'),
            ('R2 backup retention (OPS-2)',
             'lib/backup-r2.ts pruneOldBackupsFromR2 wired into weekly-backup, 84-day window',
             'LIVE (shipped 2026-06-17)'),
            ('Daily archival cron (cleanup-old-rows)',
             '/api/cron/cleanup-old-rows: webhook_deliveries succeeded>30d / failed>90d, '
             'portal_otp_codes consumed-or-expired>7d',
             'LIVE (shipped 2026-06-17)'),
            ('CONTRIBUTING.md (DOC-1)',
             '~470-line onboarding guide — 3 mental models + local setup + workflow + 10 recipes',
             'LIVE (shipped 2026-06-17)'),
            ('Annual + Pause subscription options',
             'Stripe billing — annual saves 2 months; pause keeps data while suspending access',
             'LIVE'),
            ('Per-booking team chat',
             'booking_internal_messages, @mentions, /admin/bookings/[id] + /driver/booking/[id]/chat',
             'LIVE (shipped 2026-06-16)'),
            ('ERPNext-style booking inspections',
             '/admin/inspections templates + booking_inspections runtime + driver app entry',
             'LIVE'),
            ('Driver mobile-first redesign',
             '/driver bottom-nav + Inbox + per-booking chat + Me page + collapsible stop cards',
             'LIVE (shipped 2026-06-16)'),
            ('Restore drill + runbook',
             'docs/runbook-restore.md + docs/runbook-restore-findings-2026-06-16.md',
             'LIVE'),
            ('Integration test infra + 5 suites',
             'tests/integration/ + TEST_SUPABASE_URL target. inventory-availability, '
             'dispatch-status-rollup, booking-status-machine (un-skipped 2026-06-17, 23 cases)',
             'LIVE (5 files, ~25 cases — TEST-1 partial)'),
            ('Per-tenant SMS body editor',
             '/admin/email-templates SMS tab',
             'LIVE'),
            ('1099 tracker lead magnet + 1099-NEC generation',
             '/marketing/free-tools/1099-tracker (public) + /admin/reports/1099-nec (admin)',
             'LIVE'),
            ('UptimeRobot on /api/health',
             'Monitor 803176669 — free tier, 5-min interval, email alerts. Pages on outage.',
             'LIVE (shipped 2026-06-18)'),
            ('AI route optimizer + driver schedule profiles',
             'GPT-4o reads bookings + drivers + skill/zip profiles + vehicles, returns '
             'proposed routes with reasoning. /admin/drivers/schedule editor + /admin/dispatch '
             'Optimize button. driver_schedule_profiles table.',
             'LIVE (shipped 2026-06-18)'),
            ('Playwright E2E setup + 3 smoke tests',
             'public smoke + admin auth + booking wizard. CI workflow wired with chromium-only. '
             'Helpers create isolated throwaway users via timestamped emails.',
             'LIVE (shipped 2026-06-18)'),
            ('QuickBooks Online sales-receipts + customers export',
             'Two new types on /api/admin/accounting/export. Columns match QBO CSV import '
             'format directly. AccountingExportButtons rebranded "QuickBooks / Xero export".',
             'LIVE (shipped 2026-06-18)'),
            ('Customer-initiated referrer coupon rename',
             '/portal/referrals: referrer can rename their code (MARIA10 → MARIA-FAVS). '
             'Discount value stays fixed. Rejects unique violations with friendly errors.',
             'LIVE (shipped 2026-06-18)'),
            ('lib/email "strip any" pass',
             '~30 unwarranted any casts replaced with proper types across 8 files. '
             'Remaining any are catch clauses + ImapFlow library workarounds.',
             'LIVE (shipped 2026-06-18)'),
            ('Per-tenant Twilio from-number (decoupled from env)',
             'tenants.twilio_from_number + tenants.twilio_messaging_service_sid. sendSms() '
             'accepts optional from/messagingServiceSid override. New /superadmin/tenants/[id]/sms '
             'page. All 7 customer-facing SMS callsites refactored.',
             'LIVE (shipped 2026-06-18)'),
            ('Per-tenant GoHighLevel sub-account config',
             'Agency model — master PIT platform-side, per-tenant location_id + 4 workflow '
             'webhook URLs. /superadmin/tenants/[id]/ghl page.',
             'LIVE (shipped 2026-06-18)'),
            ('Lead-magnet decoupled from GHL',
             'lead_magnet_signups.tags text[] replaces the GHL contact sync. Leads stay '
             'platform-side; tenant CRMs no longer polluted with SaaS prospects.',
             'LIVE (shipped 2026-06-18)'),
            ('Custom-domain-required policy for tenant emails',
             'getTenantEmailConfig returns null if tenant has no custom_domain (was: fall back '
             'to IAF brand). All 19 callers updated with null guards + Sentry breadcrumbs.',
             'LIVE (shipped 2026-06-18)'),
            ('Two Resend account support',
             'RESEND_API_KEY (tenant) + RESEND_API_KEY_PLATFORM (operator). sendEmail accepts '
             'optional apiKey override. Operator emails do not pollute tenant Resend sending reputation.',
             'LIVE (shipped 2026-06-18)'),
            ('Beta program — signup variant + lifecycle + feedback widget',
             '/beta landing, 90-day trial, 4 lifecycle emails (welcome/30/60/80), in-app feedback '
             'bubble, /superadmin/beta-program cohort + inbox views.',
             'LIVE (shipped 2026-06-17)'),
            ('Approval workflow for high-ticket bookings',
             'tenants.approval_threshold_cents + 5 columns on bookings. Stripe webhook gates '
             'sendBookingConfirmation behind the check. /admin/bookings/[id] shows 3-state banner '
             '(pending/approved/rejected) with inline approve + reject (reason required). '
             'Admin-only setting toggle in /admin/settings.',
             'LIVE (shipped 2026-06-18)'),
            ('Comparison landing — RentalFlow vs 4 competitors',
             '/marketing/vs index + /marketing/vs/[slug] dynamic per InflatableOffice, '
             'Goodshuffle Pro, Booqable, TapGoods. Each page has feature matrix with winner per '
             'row, where-they-win + where-we-win, honest TL;DR. Data lives in '
             'lib/marketing/competitors.ts so adding new entries is one array push.',
             'LIVE (shipped 2026-06-18)'),
            ('MFA actually enabled for IAF + onboarding prompt for new tenants',
             'Bug fix 429b4b1 (cancelEnroll was deleting the verified factor) unblocked the '
             'flow. IAF flipped require_admin_mfa=true 2026-06-18 evening with admin TOTP '
             'verified. New tenants see a required "mfa_policy_decided" checklist item that '
             'sends them to /admin/settings/security to consciously decide.',
             'LIVE (shipped 2026-06-18)'),
            ('E2E Playwright suite expanded 3 → 10 spec files (11 test cases)',
             '4 CI jobs now active on every PR: typecheck/scope/integration/e2e. 11 e2e cases '
             'cover public smoke, admin auth, booking wizard, dispatch, driver, paid bookings, '
             'portal OTP, quote pages, staff RBAC (security), superadmin scope. ~103s e2e job '
             'duration. 8 iterations of multi-tenant / middleware redirect fixes to land green.',
             'LIVE (shipped 2026-06-18)'),
            ('Help section + KB updated for all 2026-06-18 features',
             'HelpClient.tsx +3 sections (approval-workflow, ai-route-optimizer, '
             'quickbooks-export) + ci-pipeline updated 3→4 jobs. KB regenerated to 73 sections, '
             'applied to prod. AI admin assistant can answer feature questions directly.',
             'LIVE (shipped 2026-06-18)'),
            ('Operator-controlled MFA reset + recovery codes',
             '/superadmin/users-mfa lists every active user with factor count + "Reset MFA" '
             'button. /superadmin/recovery-codes for Ludmila\'s own emergency codes (SHA-256 + '
             'salt, single-use, shown once). NO tenant-facing self-service — operator controls '
             'all reset paths.',
             'LIVE (shipped 2026-06-18)'),
            ('Beta lifecycle cron health endpoint + UptimeRobot wire',
             'GET /api/cron/beta-lifecycle-status returns 200/503 based on whether the daily '
             'beta lifecycle cron has fired emails within the last 25h when there are active '
             'beta tenants. UptimeRobot monitor wired 2026-06-18 with a 1-hour interval — '
             'Ludmila gets paged on 503.',
             'LIVE (shipped 2026-06-18)'),
            ('Operator recovery codes generated + saved',
             'Ludmila generated her 10 single-use recovery codes via /superadmin/recovery-codes '
             'and saved them outside the app (1Password Family or equivalent). Eliminates the '
             'single-point-of-failure where losing her authenticator would lock her out of '
             '/superadmin with no recovery path.',
             'LIVE (operator action 2026-06-18)'),
            ('DEFAULT_TENANT_ID middleware↔test coupling refactor',
             'lib/tenant/resolve.ts now reads DEFAULT_TENANT_ID from env with the historical '
             'UUID as fallback. tests/e2e/helpers/test-data.ts imports the same constant directly '
             'from @/lib/tenant/resolve instead of hardcoding the UUID independently. Drift '
             'between production fallback and seeded test rows is now impossible — eliminates '
             'the ghost ERR_TOO_MANY_REDIRECTS class of bug that bit the initial e2e bring-up.',
             'LIVE (shipped 2026-06-18, commit 1cbb34a)'),
        ],
        col_widths=[2.4, 3.0, 1.7])

    api['add_callout'](doc, 'good',
        'A meaningful chunk of the "next 30 days" list from prior drafts already shipped. The '
        'roadmap below is therefore both shorter AND more focused on items that genuinely '
        'are not yet built.')

    api['add_h2'](doc, '19.2  Next 30 days — what remains')

    api['add_kv_table'](doc,
        ['#', 'Recommendation', 'Why it matters', 'Effort', 'Impact'],
        [
            ('1', 'Expand integration tests to 10+ scenarios',
             'Current: 5 files / ~25 cases (multi-tenant isolation, email idempotency, inventory '
             'availability, dispatch rollup, booking status machine). Want: refund flow, booking '
             'extension, GHL inbound webhook, abandoned cart, hold expiration.',
             '1-2d', 'HIGH'),
            ('2', 'Add 3 more Playwright e2e tests',
             'Public-smoke + admin-auth + booking-wizard shipped 2026-06-18. Pattern proven. '
             'Want: admin dispatch flow, driver mobile (deliver + proof upload), payment flow '
             '(faking Stripe webhook from a test).',
             '1-2d', 'HIGH'),
        ],
        col_widths=[0.4, 2.3, 2.6, 0.8, 0.8])

    api['add_callout'](doc, 'good',
        'Total 30-day effort: ~2-4 days. UptimeRobot shipped 2026-06-18 — the original 30-day '
        'list is now empty.')

    api['add_h2'](doc, '19.3  Next 90 days — what remains')

    api['add_kv_table'](doc,
        ['#', 'Recommendation', 'Why', 'Effort', 'Impact'],
        [
            ('1', 'Multi-warehouse support',
             'Today: single warehouse per tenant. Flagged as a wins-for-them column in the '
             'TapGoods + Goodshuffle Pro /vs pages. Mid-size operators with 2+ locations need '
             'transfer + per-warehouse inventory. Do not build proactively — wait until a '
             'paying prospect asks for it.',
             '3-5d', 'MEDIUM'),
        ],
        col_widths=[0.4, 2.3, 2.6, 0.8, 0.8])

    api['add_h2'](doc, '19.4  Next 180 days — structural improvements')

    api['add_kv_table'](doc,
        ['#', 'Recommendation', 'Why'],
        [
            ('1', 'Split marketing site into standalone Next.js project',
             'Isolate failure domain. Marketing deploys + tenant deploys independent. '
             'Eliminates "bad marketing deploy breaks all tenants" risk.'),
            ('2', 'Adopt Atlas or sqitch for SQL migrations',
             'Timestamp ordering, dependency graph, idempotency check. 115 SQL files is '
             'where bespoke "ALL_MIGRATIONS.sql" management starts to drift.'),
            ('3', 'Codegen types from schema (Kysely or Zapatos)',
             'Compile-time tenant safety. Today scope.ts is runtime. Codegen would catch '
             'missing tenant_id at build time.'),
            ('4', 'Next.js 15 + React 19 upgrade',
             'Stable upgrades. Mostly mechanical. Lockstep with eslint-config-next.'),
            ('5', 'E2E suite expansion to 10+ flows',
             'Cover: tenant onboarding, dispatch route, gift card lifecycle, refunds, '
             'inspections, portal sign-in, MFA enrollment.'),
            ('6', 'Per-tenant PDF invoice designer',
             'Jinja-style template editor. Currently invoice is one hard-coded template.'),
            ('7', 'Tenant-driven webhook event filtering',
             'Today subscribers receive all events of subscribed types. Add per-webhook filter '
             '(e.g. "only bookings > $500").'),
            ('8', 'Native dispatch route optimizer',
             'Today drag-and-drop. Future: auto-order stops by drive time (Google Maps API).'),
            ('9', 'Multi-region Supabase replica for read queries',
             'When tenant count or DB load warrants. Today single-region is fine.'),
            ('10', 'SOC2 / HIPAA prep',
             'Optional — gated by enterprise customer demand. Most patterns already in place '
             '(audit log, RLS, encryption, secret management). Compliance attestation is paperwork.'),
        ],
        col_widths=[0.4, 2.8, 3.9])

    api['add_h2'](doc, '19.5  Summary scorecard')

    api['add_kv_table'](doc,
        ['Area', 'Current state (post 2026-06-17)', 'After 30-day finish', 'After 90-day finish'],
        [
            ('Multi-tenant safety',     'Strong + CI guard live',  'Strong + CI guard',  'Strong + CI guard'),
            ('Test coverage',           'Strong (10 unit files / 131 cases + 5 integration files / 29 cases + 10 e2e files / 11 cases + PII)',  'Strong',  'Strong'),
            ('Security posture',        'Strong (CSP, dep scan, rate limits, MFA switch, PII hardened)',  'Strong',  'Strong (MFA default-on for new tenants)'),
            ('Operational maturity',    'Strong (R2 retention, archival cron, runbooks, UptimeRobot live)',  'Strong',  'Strong'),
            ('Code quality',            'Better (lib/email any pass 2026-06-18)',  'Better',  'Best (codegen types from schema)'),
            ('Compliance readiness',    'Medium-strong (PII scrubbing tested, key rotation runbook)',  'Medium-strong',  'Strong'),
            ('Tenant onboarding pain',  'Medium (81 admin pages, AI route optimizer reduces friction)',  'Medium',  'Lower'),
        ],
        col_widths=[1.6, 2.0, 1.7, 1.8])

    api['add_h2'](doc, '19.6  What not to do')

    api['add_callout'](doc, 'warn',
        'A few tempting moves to AVOID until they\'re clearly needed:')

    api['add_bullet'](doc, [
        ('Migrating to a different framework (Remix, SvelteKit, etc.) — ', False),
        ('the codebase is at "Next.js fits well" stage. Migration cost would be 3-6 months. '
         'Not justified by any current pain.', True),
    ])

    api['add_bullet'](doc, [
        ('Migrating off Supabase to "real" Postgres + custom auth — ', False),
        ('the platform is one of the simplest paths to scale. RLS posture is correct. '
         'No reason to take on auth + storage + realtime infra ownership.', True),
    ])

    api['add_bullet'](doc, [
        ('Building a custom outbound sequence engine — ', False),
        ('GHL handles marketing outbound + drip + abandoned cart. RentalFlow shouldn\'t '
         'compete with that wheel.', True),
    ])

    api['add_bullet'](doc, [
        ('Microservices split — ', False),
        ('At ~10 tenants + 273 source files, the monolith is the right architecture. '
         'Re-evaluate at 50+ tenants OR if a single bottleneck appears.', True),
    ])

    api['add_callout'](doc, 'good',
        'The system is in a healthy place. With the June 2026 sprint shipped, most "next step" '
        'decisions are about polish (testing, monitoring, MFA enforcement) rather than '
        'foundational gaps. That is the position you want to be in.')

    api['add_h2'](doc, '19.7  Closing observation')

    api['add_p'](doc,
        'RentalFlow is a mature SaaS at a $99/mo price point with depth that most platforms '
        'at this stage do not have — 11 integrations, 81 admin surfaces, a customer portal '
        'with loyalty + referrals, a driver PWA with bottom-nav UX, a superadmin-with-unified-'
        'inbox backoffice, 13 cron jobs, and CI gating + scope drift detection running on '
        'every PR.')

    api['add_p'](doc,
        'The remaining 30-day list closes the highest-leverage operational gaps. The 90-day '
        'list adds depth most enterprise-rental customers will eventually ask for. The 180-day '
        'list takes the system from "well-built SaaS" to "engineered SaaS" — but none of it is '
        'urgent in a "this is breaking" sense.')

    api['add_callout'](doc, 'quote',
        'A platform you would want to inherit. The hard structural decisions are already made '
        'and made correctly. What remains is the work of polish and confidence.')
