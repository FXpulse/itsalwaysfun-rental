"""Chapter 19 — Recommendations & Roadmap. 30 / 90 / 180 day plan.

Reflects state AS OF 2026-06-16 — items that shipped before this audit are
listed in the "Recently shipped" block, not in the recommendation list.
"""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 19, 'Recommendations & Roadmap',
        'A prioritized 30 / 90 / 180-day plan grounded in the findings of chapters 16-18.',
        audience_tags=['Owner', 'Engineer', 'Investor'])

    api['add_callout'](doc, 'fact',
        'Recommendations are scoped to what is NOT yet shipped. Items that landed in the '
        'June 2026 sprint (CI on PR, scope:check CI, CSP headers, OpenAPI spec, MFA infra, '
        'restore drill) are called out separately so the roadmap does not duplicate them.')

    api['add_h2'](doc, '19.1  Recently shipped (June 2026 sprint)')

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
            ('OpenAPI 3.0 spec + Swagger UI',
             '/api/v1/openapi.json + /api/v1/docs (Swagger UI via CDN)',
             'LIVE'),
            ('MFA infrastructure',
             '/admin/settings/security (MfaPanel) + /admin/mfa-verify gate in middleware',
             'LIVE (opt-in; required by tenant choice)'),
            ('Annual + Pause subscription options',
             'Stripe billing — annual saves 2 months; pause keeps data while suspending access',
             'LIVE'),
            ('Per-booking team chat (booking_internal_messages)',
             'Threaded chat on /admin/bookings/[id] + /driver/booking/[id]/chat with @mentions',
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
            ('Integration test suite + dedicated test Supabase project',
             'tests/integration/ + TEST_SUPABASE_URL test target',
             'LIVE (2 tests; expansion still on 30-day list)'),
            ('Per-tenant SMS body editor',
             '/admin/email-templates SMS tab',
             'LIVE'),
            ('1099 tracker lead magnet + 1099-NEC generation',
             '/marketing/free-tools/1099-tracker (public) + /admin/reports/1099-nec (admin)',
             'LIVE'),
        ],
        col_widths=[2.4, 3.0, 1.7])

    api['add_callout'](doc, 'good',
        'A meaningful chunk of the "next 30 days" list from prior drafts already shipped. The '
        'roadmap below is therefore both shorter AND more focused on items that genuinely '
        'are not yet built.')

    api['add_h2'](doc, '19.2  Next 30 days — not yet shipped')

    api['add_kv_table'](doc,
        ['#', 'Recommendation', 'Why it matters', 'Effort', 'Impact'],
        [
            ('1', 'UptimeRobot (or BetterStack) on /api/health',
             'External uptime monitor. Pages on outage. Today nothing pings /api/health.',
             '15 min', 'HIGH'),
            ('2', 'Dependency vulnerability scanning in CI (SEC-9)',
             'Dependabot or Snyk wired to PR checks. Surfaces known CVEs early.',
             '1h', 'MEDIUM'),
            ('3', 'Rate limit on public read endpoints (SEC-5)',
             '/api/products, /api/availability — protect Supabase from scrape attacks. '
             'Upstash already wired; just add the check.',
             '2h', 'MEDIUM'),
            ('4', 'Expand integration test suite to 10+ scenarios',
             'Current: 2 tests (multi-tenant isolation, email idempotency). Add: hold expiration, '
             'refund flow, booking extension, GHL inbound webhook, abandoned cart, dispatch state '
             'machine.',
             '1-2d', 'HIGH'),
            ('5', 'EMAIL_ENCRYPTION_KEY rotation runbook',
             'Document the re-encryption steps. Prerequisite for emergency rotation.',
             'half day', 'MEDIUM'),
        ],
        col_widths=[0.4, 2.3, 2.6, 0.8, 0.8])

    api['add_callout'](doc, 'good',
        'Total 30-day effort: ~3-4 days of focused work. Closes the highest-leverage gaps that '
        'remain after the June sprint.')

    api['add_h2'](doc, '19.3  Next 90 days — product depth + compliance')

    api['add_kv_table'](doc,
        ['#', 'Recommendation', 'Why', 'Effort', 'Impact'],
        [
            ('1', 'MFA enforced (not just available) for admin role',
             'Infrastructure exists. Decision: should new tenants be required to enroll TOTP at '
             'first login? Toggle + onboarding flow.',
             '1d', 'HIGH'),
            ('2', '3 e2e tests (Playwright)',
             'Happy path: book → admin confirm → driver deliver. Smoke test before merge.',
             '2-3d', 'HIGH'),
            ('3', 'Approval workflow for high-ticket bookings',
             'Tenant config: if total > $X, require admin sign-off before confirmation. '
             'Prevents staff mistakes on large orders.',
             '1-2d', 'MEDIUM'),
            ('4', 'Customer-initiated referrer coupon creation',
             'Today admin generates referrer codes. Let customers pick their own (after first '
             'paid booking). The ReferralBox already supports share — extend with self-create.',
             '1d', 'MEDIUM'),
            ('5', 'Backup retention + lifecycle (OPS-2)',
             'Auto-delete backups > 90 days from S3 + R2. Cost control + storage hygiene.',
             '2h', 'MEDIUM'),
            ('6', 'PII review on Sentry breadcrumbs',
             'Validate scrub-pii.ts regex against real production payloads.',
             '4h', 'MEDIUM'),
            ('7', 'webhook_deliveries archival policy',
             'Move > 30-day-old deliveries to cold storage. Keep query latency snappy.',
             '4h', 'LOW-MED'),
            ('8', '"Strip any" pass on lib/email',
             'Concentrated ~30 any usages. Strong leverage for safer refactors.',
             '1d', 'MEDIUM'),
            ('9', 'CONTRIBUTING.md + ARCHITECTURE.md in repo',
             'Move session-memory playbooks into repo. Helps new engineers + audit posture.',
             '1d', 'MEDIUM'),
            ('10', 'AI assistant tool expansion',
             'Add tools: get_dispatch_today, get_pending_payments, get_damage_summary, '
             'get_low_stock_items, get_quote_pipeline. Keeps the in-product assistant aware of '
             'newer surfaces.',
             '4h', 'MEDIUM'),
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
        ['Area', 'Current state', 'After 30-day list', 'After 90-day list'],
        [
            ('Multi-tenant safety',     'Strong + CI guard live', 'Strong + CI guard',     'Strong + CI guard'),
            ('Test coverage',           'Light (2 integration)',  'Medium (10+ integration)', 'Medium-strong (+ e2e)'),
            ('Security posture',        'Medium-strong (CSP, MFA infra)', 'Strong (dep scan, rate limits)', 'Strong (MFA enforced)'),
            ('Operational maturity',    'Medium (runbook, no uptime)', 'Strong (uptime + dep scan)', 'Strong'),
            ('Code quality',            'Good',                   'Good',                  'Better (any pass + doc)'),
            ('Compliance readiness',    'Medium',                 'Medium',                'Medium-strong'),
            ('Tenant onboarding pain',  'Medium (81 admin pages)', 'Medium', 'Lower (referral self-create)'),
        ],
        col_widths=[1.6, 1.7, 1.9, 1.9])

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
