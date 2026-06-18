"""Chapter 17 — Operations & Resilience. Deploy, monitor, backup, incident response."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 17, 'Operations & Resilience',
        'How the system is deployed, watched, backed up, and recovered.',
        audience_tags=['Engineer', 'Operations', 'Acquirer'])

    api['add_h2'](doc, '17.1  Deployment')

    api['add_kv_table'](doc,
        ['Aspect', 'Setup'],
        [
            ('Hosting',          'Vercel — auto-deploy on push to main'),
            ('Preview deploys',  'Every branch + PR gets its own preview URL'),
            ('Build command',    'next build (default). Sharp + autoprefixer in build pipeline.'),
            ('Build duration',   '~3-4 minutes (typical)'),
            ('Environments',     'Production (main branch), Preview (other branches), Development (local)'),
            ('Env var management', 'Vercel project settings (Production + Preview separate)'),
            ('Custom domains',   'Vercel domain configuration. DNS at 20i (registrar) for getrentalflow.com.'),
            ('Cron jobs',        'Registered via vercel.json — Vercel scheduler invokes routes'),
            ('Database migrations', 'Manual via supabase CLI: `supabase db query --linked --yes -f <file>`'),
            ('Schema baseline',  'supabase/SCHEMA_BASELINE.sql (regenerated via pg_dump)'),
            ('Type generation',  'npm run supabase:types regenerates types/database.ts'),
        ],
        col_widths=[2.0, 5.1])

    api['add_callout'](doc, 'good',
        'Vercel + git-flow auto-deploy is well-understood and operationally simple. Preview '
        'deploys let Ludmila + team test branches against a real (but isolated) URL before '
        'merging.')

    api['add_callout'](doc, 'good',
        'CI on PR is live. .github/workflows/ci.yml gates merges with FOUR jobs: typecheck + '
        'lint + unit tests (10 files, 131 cases); scope-check (MULTI_TENANT_TABLES drift); '
        'integration tests against a dedicated test Supabase project (5 files, 29 cases); '
        'and Playwright e2e against the same project + test Stripe key (10 spec files, '
        '11 cases — public smoke, admin auth, booking wizard mount, dispatch, driver auth, '
        'paid booking visibility, portal OTP, quote page mount, staff RBAC blocking admin-only '
        'routes, superadmin /superadmin/* scope). E2E job duration ~103s. The integration + '
        'scope-check + e2e jobs are auto-skipped on fork PRs (no secrets) AND skip gracefully '
        'with a warning if any expected secret is missing — no false-failure when an operator '
        'hasn\'t finished wiring the test project.')

    api['add_h2'](doc, '17.2  Monitoring')

    api['add_kv_table'](doc,
        ['Layer', 'Tool', 'Coverage'],
        [
            ('Errors (server)',      'Sentry @sentry/nextjs',     'Auto-capture uncaught exceptions'),
            ('Errors (client)',      'Sentry browser SDK',        'JS errors, network failures'),
            ('Cron monitoring',      'Sentry cron monitors',      '7 of 13 jobs wrapped with withMonitor()'),
            ('Performance',          'Sentry performance tracing', 'Spans on key server actions'),
            ('Uptime',               'NONE today',                'Recommended: UptimeRobot/BetterStack on /api/health'),
            ('Logs',                 'Vercel logs (built-in)',    '~7-day retention on free tier'),
            ('DB performance',       'Supabase dashboard',        'Slow queries, connection pool, storage'),
            ('Rate limit hits',      'Upstash dashboard',         'Per-key counter visibility'),
            ('Webhook delivery',     'webhook_deliveries table',  'Queryable from /admin/webhooks'),
            ('Email send tracking',  'booking_emails_sent table', 'Plus Resend dashboard for delivery'),
        ],
        col_widths=[2.0, 2.0, 3.1])

    api['add_callout'](doc, 'warn',
        'No external uptime monitor configured. /api/health is the right endpoint to ping but '
        'nothing is pinging it. Adding UptimeRobot (free) + paging Ludmila on outage is a '
        '15-minute setup — strongly recommended.')

    api['add_h2'](doc, '17.3  Backups')

    api['add_kv_table'](doc,
        ['Backup', 'Frequency', 'Target', 'Retention'],
        [
            ('weekly-backup cron', 'Weekly Sunday 3am UTC',
             'Supabase Storage + Cloudflare R2 (dual)', '84 days at both (since 2026-06-17)'),
            ('Supabase managed PITR', 'Continuous',
             'Supabase pro plan default', 'Up to 7 days (plan-dependent)'),
            ('Email send ledger',  'Append-only',
             'booking_emails_sent table',                'Indefinite (immutable audit)'),
            ('Admin audit log',    'Append-only',
             'admin_audit_log table',                    'Indefinite (immutable audit)'),
            ('Operational rows',  'Daily 5am UTC cleanup',
             'webhook_deliveries + portal_otp_codes',     'webhook succeeded 30d / failed 90d / OTP 7d'),
        ],
        col_widths=[2.0, 1.6, 2.0, 1.5])

    api['add_h2'](doc, '17.4  Restore drill — what was learned')

    api['add_p'](doc,
        'A restore drill was run on 2026-06-16 (documented in docs/runbook-restore.md + '
        'runbook-restore-findings-2026-06-16.md). Findings:')

    api['add_bullet'](doc, 'Importer (scripts/import-backup.ts) requires I_KNOW_WHAT_IM_DOING=true env — '
                            'good safety. Documented in runbook.')
    api['add_bullet'](doc, 'CSV import order matters (tenants → user_roles → products → bookings → '
                            'child tables). Order documented.')
    api['add_bullet'](doc, 'JSONB columns require explicit casting in restore SQL — gotcha caught + '
                            'documented.')
    api['add_bullet'](doc, 'Restore validated against a fresh Supabase project (no overwrite of '
                            'production data).')

    api['add_callout'](doc, 'good',
        'Annual restore drill on the calendar. Drill log is in the repo (docs/runbook-restore-'
        'findings-*.md). The pattern of "drill + document findings + fix issues" is healthy.')

    api['add_h2'](doc, '17.5  Incident response')

    api['add_h3'](doc, 'Documented past incidents (per session memory)')

    api['add_kv_table'](doc,
        ['Date', 'Incident', 'Resolution', 'Lesson'],
        [
            ('2026-06-15',
             'getrentalflow.com domain clientHold (DNS pulled)',
             'ICANN email verification expiration — user clicked the link, DNS restored',
             'Add a calendar reminder for ICANN registrar verification emails'),
            ('2026-06-15',
             'Stripe webhook race with quote-converted bookings',
             'Defense-in-depth: webhook handler calls sendBookingConfirmation directly from '
             'out-of-band update path too',
             'Idempotency tested in CI now (test integration: booking-email-idempotency)'),
            ('2026-05-29',
             'Subagent package.json accidental mutation',
             'Workflow guardrail added — implementer prompts block lockfile mutations',
             'feedback_subagent_guardrails memory; all future subagents check this'),
            ('2026-06-09',
             'FXPulse TV mojibake (encoding incident)',
             'PowerShell scripts on worker file → UTF-8 corruption. Rolled back immediately',
             'No PowerShell scripts on worker; use Edit tool or controlled rewrites'),
        ],
        col_widths=[1.0, 1.8, 2.5, 1.8])

    api['add_h3'](doc, 'Incident response runbook (informal)')

    api['add_numbered'](doc, 'Symptoms surface (Sentry alert, user report, monitor miss)')
    api['add_numbered'](doc, 'Triage: Sentry breadcrumbs + Vercel logs + Supabase dashboard')
    api['add_numbered'](doc, 'Identify if customer-facing impact (booking blocked, email failure, etc.)')
    api['add_numbered'](doc, 'Hotfix preview branch → preview deploy → test → merge to main → auto-deploy')
    api['add_numbered'](doc, 'Document in repo or session memory if novel')
    api['add_numbered'](doc, 'If data-integrity issue: scripts/import-backup.ts dry-run, then targeted restore')

    api['add_callout'](doc, 'warn',
        'There is no formal pager rotation. Ludmila is the single human on-call. For scaling '
        'beyond ~20 tenants, a basic Better Stack / Pagerduty integration on critical Sentry '
        'alerts is recommended.')

    api['add_h2'](doc, '17.6  Capacity & cost')

    api['add_kv_table'](doc,
        ['Resource', 'Plan', 'Current usage', 'Headroom'],
        [
            ('Vercel',         'Pro',         'Modest — well under limits',          'Significant'),
            ('Supabase',       'Pro',         'PITR + 8GB DB + auth users',          'Significant'),
            ('Resend',         'Production',  'Per-month volume per tenant',         'High'),
            ('Twilio',         '10DLC',       'Per-tenant SMS volume',               'High'),
            ('Stripe',         'Standard',    'Per-tenant payments',                 'No cap'),
            ('Sentry',         'Team',        'Errors + cron monitors',              'OK at current scale'),
            ('Upstash',        'Pay-go',      'Sliding window + transient caching',  'High'),
            ('Cloudflare R2',  'Pay-go',      'Weekly backups',                      'Very high'),
            ('AWS S3',         'Pay-go',      'Weekly backups',                      'Very high'),
            ('Anthropic + OpenAI', 'Pay-go',  'Low — capped via per-call max tokens', 'Cost-monitored'),
        ],
        col_widths=[1.7, 1.0, 2.3, 1.8])

    api['add_callout'](doc, 'info',
        'Operating cost at current scale (~10 tenants) is dominated by Vercel + Supabase Pro plans. '
        'Marginal cost per new tenant is ~$0-5/month (incremental DB rows + email volume). The $99/mo '
        'tenant fee gives substantial unit economics headroom.')
