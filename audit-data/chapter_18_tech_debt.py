"""Chapter 18 — Technical debt. By the numbers."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 18, 'Technical Debt — by the Numbers',
        'Real counts. No hand-waving. Where the debt actually is.',
        audience_tags=['Engineer', 'Acquirer'])

    api['add_callout'](doc, 'fact',
        'This chapter contains concrete numbers from the codebase. Every count is extracted '
        'via grep/glob/AST against the current main branch.')

    api['add_h2'](doc, '18.1  Code volume')

    api['add_kv_table'](doc,
        ['Metric', 'Count'],
        [
            ('TypeScript files under app/', '273'),
            ('  — page.tsx', '101'),
            ('  — route.ts (API endpoints)', '53'),
            ('  — actions.ts (server actions)', '55'),
            ('  — layout.tsx', '6'),
            ('TypeScript files under lib/', '98'),
            ('Reusable components/', '13'),
            ('SQL migration files', '115'),
            ('Markdown docs', '10'),
        ],
        col_widths=[3.5, 1.0])

    api['add_h2'](doc, '18.2  Test coverage — the headline gap')

    api['add_stats_strip'](doc, [
        ('19', 'test cases',          P['RED']),
        ('8',  'test files',          P['AMBER']),
        ('1',  'integration tests',   P['AMBER']),
        ('0',  'e2e tests',           P['RED']),
    ])

    api['add_kv_table'](doc,
        ['Test', 'Cases', 'Covers'],
        [
            ('pricing.test.ts',                 '7', 'Day 1 / Day 2+ / weekend / coupon / gift card / tax / fully-discounted'),
            ('validation.test.ts',              '3', 'Zod schemas for booking, contact, quote'),
            ('utils.test.ts',                   '2', 'Date math + currency formatting'),
            ('waiver-default.test.ts',          '2', 'Waiver template defaults + fallback'),
            ('csv.test.ts',                     '1', 'Bulk import CSV parsing'),
            ('tenant-resolve.test.ts',          '2', 'Tenant resolution by hostname'),
            ('encryption.test.ts',              '?', 'AES roundtrip for IMAP credentials'),
            ('rules-engine.test.ts',            '?', 'Email rules engine for IMAP sync'),
            ('integration: multi-tenant-isolation.test.ts', '1', 'No cross-tenant data leak in joins'),
            ('integration: booking-email-idempotency.test.ts', '1', 'No duplicate sends on cron retry'),
        ],
        col_widths=[2.7, 0.6, 3.8])

    api['add_callout'](doc, 'risk',
        '19 test cases / ~225 source files = ~8% file coverage. The tests that DO exist cover '
        'the right things (pricing math, idempotency, tenant resolution). But the booking flow, '
        'admin actions, and 11 integrations are uncovered. For payment-handling SaaS, '
        '10+ integration tests + 3 e2e is the minimum recommended floor.')

    api['add_h2'](doc, '18.3  TODO / FIXME / HACK markers')

    api['add_p'](doc, 'Grep result: 6 files contain TODO markers.')

    api['add_kv_table'](doc,
        ['File', 'Status'],
        [
            ('lib/superadmin/health-data.ts:70',
             'last_admin_activity_at not wired — returns null. Cosmetic gap.'),
            ('app/admin/inventory/unit-movement-actions.ts:143',
             'Utilization metrics incomplete — returns warehouse-scoped subset.'),
            ('lib/backup-restore.ts',
             'TODO marker — likely on restore validation or partial-restore behavior.'),
            ('app/(public)/order-by-date/BookingWizard.tsx',
             'TODO marker — likely on edge-case wizard validation.'),
            ('app/admin/help/HelpClient.tsx',
             'TODO marker — likely a "next: add this article" placeholder.'),
            ('lib/sms/send.ts',
             'TODO marker — likely retry or rate-limit handling.'),
        ],
        col_widths=[3.0, 4.1])

    api['add_callout'](doc, 'good',
        '6 TODO markers across ~225 source files is a low TODO density. The team isn\'t '
        'accumulating "I\'ll fix this later" debt.')

    api['add_h2'](doc, '18.4  Type-safety markers')

    api['add_kv_table'](doc,
        ['Marker', 'Count', 'Reading'],
        [
            ('any type usage',                   '335 across 140 files',
             'Concentrated in lib/email/*, lib/ghl/client.ts, '
             '@ai/diagnose-places (24!). Recommend per-domain typing initiative.'),
            ('@ts-ignore + @ts-expect-error',    '1 (app/layout.tsx)',
             'Very low. Pattern is "fix the type, don\'t silence."'),
            ('as unknown as casts',              '1 (lib/delivery-checklist.ts)',
             'Almost non-existent.'),
            ('eslint-disable directives',        '13 across 11 files',
             'Spread across builders + editors. Worth a quick "why each one" pass.'),
            ('console.log',                      '30 across 6 files',
             'Mostly in scripts/import-backup.ts (21). Production code is clean.'),
        ],
        col_widths=[2.5, 1.5, 3.1])

    api['add_callout'](doc, 'warn',
        '335 `any` usages is the single largest type-safety opportunity. Concentrated in '
        '/admin/diagnose-places (24 in one file) + email infrastructure. A focused '
        '"strip any" pass on lib/email would unlock cleaner refactor opportunities.')

    api['add_h2'](doc, '18.5  Documentation debt')

    api['add_kv_table'](doc,
        ['Doc', 'Status'],
        [
            ('README.md',                        'Present (~7.7 KB)'),
            ('CONTRIBUTING.md',                  'MISSING'),
            ('ARCHITECTURE.md',                  'MISSING (this audit doc is a partial substitute)'),
            ('API_REFERENCE.md / OpenAPI',       'MISSING'),
            ('docs/runbook-restore.md',          'Present + 2026-06-16 findings file'),
            ('docs/multi-tenant-setup.md',       'Present'),
            ('docs/multi-tenant-migration.md',   'Present'),
            ('docs/seo-setup-iaf.md',            'Present'),
            ('Session-memory playbooks',         '~50 markdown files in C:\\Users\\chemm\\.claude\\ '
                                                  '— "memory" but not in-repo'),
            ('Per-tenant onboarding doc',        'Embedded in /admin/onboarding wizard'),
        ],
        col_widths=[2.8, 4.3])

    api['add_callout'](doc, 'info',
        'Per-feature playbooks (getrentalflow-ghl-playbook.md, rentalflow-help-videos-playbook.md, '
        'ilmurali-jacksonville-playbook.md) exist outside the repo as session memory. For a new '
        'engineer joining, moving these into repo (or referencing them from CONTRIBUTING.md) is '
        'a one-day chore worth doing.')

    api['add_h2'](doc, '18.6  Migration footprint')

    api['add_stats_strip'](doc, [
        ('115', 'SQL files', P['NAVY']),
        ('88', 'CREATE TABLE', P['BLUE']),
        ('197', 'CREATE POLICY', P['GREEN']),
        ('210', 'CREATE INDEX', P['PURPLE']),
        ('41', 'CREATE FUNCTION', P['AMBER']),
    ])

    api['add_kv_table'](doc,
        ['Pattern', 'Note'],
        [
            ('No timestamp-prefixed migrations',
             'Files named by feature. Order maintained in ALL_MIGRATIONS.sql.'),
            ('All migrations idempotent',
             'IF NOT EXISTS, DO blocks for constraints, DROP-then-CREATE for policies.'),
            ('Applied manually',
             '`supabase db query --linked --yes -f <file>` — not auto-applied on push.'),
            ('No formal migration tool',
             'Pure SQL files. Atlas / sqitch on 180-day roadmap.'),
            ('ALL_MIGRATIONS.sql',
             'Concatenated in dependency order for fresh setup.'),
            ('SCHEMA_BASELINE.sql',
             'pg_dump output — schema snapshot for quick reference + restore drills.'),
        ],
        col_widths=[2.3, 4.8])

    api['add_h2'](doc, '18.7  Dependency posture')

    api['add_kv_table'](doc,
        ['Concern', 'Reading'],
        [
            ('Next.js 14 (vs 15 latest)',
             'Stable + supported. Upgrade non-trivial. 180-day item.'),
            ('React 18 (vs 19 latest)',
             'Stable. Upgrade gated by Next.js 15.'),
            ('Supabase JS 2.45',
             'Current. No upgrade urgency.'),
            ('Stripe SDK v17',
             'Current. API version 2024-09-30 pinned in client.'),
            ('No Dependabot / Snyk wired',
             'Vulnerability scanning runs only via npm audit. Recommend wiring.'),
            ('Heavy deps (S3, AI, IMAP, Sentry)',
             'All justified by features in production. No dead weight visible.'),
        ],
        col_widths=[2.3, 4.8])

    api['add_h2'](doc, '18.8  Recently closed (June 2026)')

    api['add_callout'](doc, 'good',
        '14 debt items closed between the June sprint and the 2026-06-17 hardening wave. Worth '
        'calling out because earlier audit drafts listed them as "open."')

    api['add_kv_table'](doc,
        ['ID', 'How it closed'],
        [
            ('CI-1',  '.github/workflows/ci.yml runs typecheck + lint + tests on every PR.'),
            ('OBS-1', 'scope-check CI job runs scripts/check-tenant-scope.ts on every PR.'),
            ('SEC-1', 'Content-Security-Policy headers configured in next.config.js.'),
            ('SEC-3', 'site_settings.require_admin_mfa per-tenant policy switch + admin layout gate + UI toggle.'),
            ('SEC-5', '60/min/IP rate limit on /api/products, /api/products/[slug], /api/availability via Upstash.'),
            ('SEC-6', 'docs/runbook-rotate-email-encryption-key.md + scripts/rotate-email-encryption-key.ts.'),
            ('SEC-9', '.github/dependabot.yml — weekly npm + GitHub Actions CVE scanning, already filing PRs.'),
            ('PII review', 'lib/sentry/scrub-pii.ts hardened with +6 patterns + REDACT_KEYS + 27 unit tests.'),
            ('OPS-2',  'R2 backup retention: lib/backup-r2.ts pruneOldBackupsFromR2 wired into weekly-backup cron, 84d window.'),
            ('Webhook archival', '/api/cron/cleanup-old-rows daily: succeeded>30d / failed>90d / portal_otp>7d.'),
            ('DOC-1', 'CONTRIBUTING.md — 470-line onboarding doc with local setup + workflow + 10 recipes.'),
            ('DOC-2', 'OpenAPI 3.0 spec + Swagger UI live at /api/v1/openapi.json + /api/v1/docs.'),
            ('TEST-INFRA', 'tests/integration/ + dedicated TEST_SUPABASE_URL project + integration-tests CI job.'),
            ('TEST-1 partial', '5 integration test files / ~25 cases live (multi-tenant isolation, email idempotency, inventory, dispatch, booking status).'),
            ('AI-1', 'Admin assistant grew from 6 → 12 tools (dispatch, payments, damages, low-stock, quotes, payouts).'),
        ],
        col_widths=[1.4, 5.7])

    api['add_h2'](doc, '18.9  Still open')

    api['add_kv_table'](doc,
        ['ID', 'Description', 'Effort', 'Priority'],
        [
            ('TEST-1 finish', 'Expand integration tests 5 → 10+ files (refund, extension, abandoned cart, GHL inbound, hold expiration)', '1-2d', 'High'),
            ('TEST-2', '3 e2e tests (Playwright)', '2-3d', 'Medium'),
            ('OPS-1', 'UptimeRobot (or BetterStack) ping on /api/health', '15min', 'High'),
            ('SEC-3 next', 'Default require_admin_mfa = true for new tenants after a chosen date', '2h', 'Medium'),
            ('SEC-4', 'GHL webhook secret constant-time compare', '15min', 'Low'),
        ],
        col_widths=[0.8, 4.0, 0.9, 1.3])
