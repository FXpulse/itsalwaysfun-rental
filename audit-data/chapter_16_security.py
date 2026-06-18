"""Chapter 16 — Security audit. Authn, authz, secrets, RLS, compliance posture."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 16, 'Security Audit',
        'Authentication, authorization, secret management, compliance posture, and open findings.',
        audience_tags=['Security', 'Acquirer'])

    api['add_callout'](doc, 'fact',
        'Multi-layer defense: middleware gates + Supabase Auth + RLS + tenant proxy + audit '
        'logging. The pattern is right. The gaps are around password complexity, MFA coverage, '
        'and CSP headers.')

    api['add_h2'](doc, '16.1  Authentication')

    api['add_kv_table'](doc,
        ['Surface', 'Method', 'MFA'],
        [
            ('/admin/*',         'Supabase Auth (email + password)',         'TOTP available + middleware gate'),
            ('/superadmin/*',    'Supabase Auth + is_superadmin flag',       'TOTP available'),
            ('/driver/*',        'Supabase Auth (admin role required)',      'Same as admin (gated)'),
            ('/portal/*',        'Custom 6-digit OTP via Resend',            'No (single-factor email)'),
            ('/api/v1/*',        'rfk_* Bearer key + scope check',           'N/A (machine auth)'),
            ('/api/webhooks/*',  'HMAC-SHA256 signature (Stripe) or shared secret (GHL)', 'N/A'),
            ('/api/cron/*',      'CRON_SECRET Bearer header',                'N/A'),
        ],
        col_widths=[1.8, 3.0, 2.3])

    api['add_callout'](doc, 'warn',
        'Password complexity rules are not visible in code — relies on Supabase Auth defaults. '
        'Consider adding minimum length + HIBP breach check for admin accounts.')

    api['add_callout'](doc, 'good',
        'MFA enforcement policy is LIVE (shipped 2026-06-17) and IAF flipped its policy '
        '"Require 2FA for all admins" to ON on 2026-06-18 evening — IAF\'s admin user '
        '(admin@itsalwaysfun.com) has a verified TOTP factor and the require_admin_mfa '
        'site_setting is "true". For NEW tenants, the policy still defaults to OFF — they '
        'see a required onboarding checklist item "mfa_policy_decided" prompting them to '
        'make the choice consciously instead of being silently forced on.')

    api['add_h2'](doc, '16.2  Authorization')

    api['add_p'](doc,
        'Role-based via user_roles.role + is_superadmin flag. Enforced at three layers: '
        'middleware (route gates), server actions (requireXxx() helpers), and database (RLS).')

    api['add_kv_table'](doc,
        ['Role', 'Capabilities'],
        [
            ('admin',
             'Full tenant access. Manage users, billing, settings, all CRUD.'),
            ('staff',
             'All admin EXCEPT settings/billing/users/api-keys/webhooks. Can run dispatch, '
             'process bookings, send quotes.'),
            ('driver',
             'Read assigned routes + stops, mark delivered, capture proof, post messages, '
             'create inspections. No access to other admin surfaces.'),
            ('customer',
             'Portal access — own bookings, points, referrals, profile. RLS by customer_email match.'),
            ('superadmin',
             'Platform-wide. Cross-tenant queries. Manage tenants, billing, support, KB.'),
        ],
        col_widths=[1.5, 5.6])

    api['add_h2'](doc, '16.3  Secret management')

    api['add_kv_table'](doc,
        ['Secret', 'Where stored', 'Rotation'],
        [
            ('SUPABASE_SERVICE_ROLE_KEY',  'Vercel env (Production)',         'Supabase dashboard'),
            ('STRIPE_SECRET_KEY',          'Vercel env',                       'Stripe dashboard'),
            ('STRIPE_WEBHOOK_SECRET',      'Vercel env',                       'Stripe dashboard (per endpoint)'),
            ('RESEND_API_KEY',             'Vercel env',                       'Resend dashboard'),
            ('TWILIO_AUTH_TOKEN',          'Vercel env',                       'Twilio dashboard'),
            ('GHL_API_KEY',                'Vercel env',                       'GHL dashboard'),
            ('GHL_WEBHOOK_SECRET',         'Vercel env',                       'Manual rotation'),
            ('CRON_SECRET',                'Vercel env',                       'Manual rotation'),
            ('OTP_SECRET',                 'Vercel env',                       'Manual — coordinate with portal users'),
            ('EMAIL_ENCRYPTION_KEY',       'Vercel env',                       'CRITICAL — controls all stored IMAP/SMTP creds'),
            ('SENTRY_AUTH_TOKEN',          'Vercel env',                       'Sentry dashboard'),
            ('AWS_SECRET_ACCESS_KEY',      'Vercel env',                       'AWS IAM rotation'),
            ('R2_SECRET_ACCESS_KEY',       'Vercel env',                       'Cloudflare R2 token rotation'),
            ('GOOGLE_PLACES_API_KEY',      'Vercel env',                       'Google Cloud Console'),
            ('ANTHROPIC_API_KEY / OPENAI_API_KEY', 'Vercel env',               'Per-provider dashboard'),
        ],
        col_widths=[2.5, 2.0, 2.6])

    api['add_callout'](doc, 'good',
        'No secrets in repo. .gitignore covers .env*. Vercel environments cleanly separate '
        'preview vs production. Secret rotation is operationally feasible (every key has a '
        'dashboard where Ludmila can re-issue).')

    api['add_callout'](doc, 'risk',
        'EMAIL_ENCRYPTION_KEY is the highest-leverage secret — leaking it exposes every tenant\'s '
        'IMAP+SMTP credentials. Rotation requires re-encrypting all stored credentials. Worth a '
        'documented rotation runbook on the 90-day list.')

    api['add_h2'](doc, '16.4  Input validation')

    api['add_p'](doc,
        'Zod schemas on every server action + API route. Server-side re-validation even when '
        'the client already validated. PostgREST handles SQL injection at the driver level. '
        'Custom slugify in template editors prevents key collisions and XSS.')

    api['add_kv_table'](doc,
        ['Surface', 'Validation library', 'Notes'],
        [
            ('Server actions', 'zod 3.23', 'Schemas colocated with action files'),
            ('API routes', 'zod 3.23', 'Same patterns as server actions'),
            ('Forms (client)', 'Native + Zod', 'Server re-validates regardless'),
            ('Emails (HTML output)', 'isomorphic-dompurify', 'Lazy-loaded due to Node 22 ESM'),
            ('Email From: header', 'Inline sanitization', 'Strips < > " from business name'),
        ],
        col_widths=[2.0, 2.0, 3.1])

    api['add_h2'](doc, '16.5  Known security mitigations')

    api['add_bullet'](doc, [
        ('Stripe Connect rather than direct Stripe — ', False),
        ('tenants own their funds. ', True),
        ('Platform never holds end-customer money.', False)
    ])
    api['add_bullet'](doc, [
        ('SMS 10DLC compliance — ', False),
        ('explicit opt-in checkbox + customer_phone_sms_consent_at stamp.', True),
    ])
    api['add_bullet'](doc, [
        ('Audit log on every admin mutation — ', False),
        ('admin_audit_log table, indexed by user_email + action.', True),
    ])
    api['add_bullet'](doc, [
        ('/superadmin completely separate from /admin — ', False),
        ('different namespace, different auth check, no shared layout.', True),
    ])
    api['add_bullet'](doc, [
        ('SVG upload removed from inbox in 2026-06-XX security hardening commit.', False),
    ])
    api['add_bullet'](doc, [
        ('Rate limits on /api/contact and /api/bookings/check-and-hold via Upstash.', False),
    ])
    api['add_bullet'](doc, [
        ('Webhook signature verification on Stripe (constant-time via Stripe SDK).', False),
    ])
    api['add_bullet'](doc, [
        ('OBS-2 (drop default tenant_id) — converts silent leaks to NOT NULL violations.', False),
    ])
    api['add_bullet'](doc, [
        ('PII scrubbing in Sentry breadcrumbs — names, emails, phone numbers redacted.', False),
    ])

    api['add_h2'](doc, '16.6  Recently closed (June 2026)')

    api['add_callout'](doc, 'good',
        'Eight security items moved from "open" to "shipped" between the June sprint and the '
        '2026-06-17 hardening wave:')

    api['add_kv_table'](doc,
        ['#', 'Finding', 'How it closed'],
        [
            ('SEC-1', 'CSP (Content-Security-Policy) headers',
             'next.config.js sets Content-Security-Policy with explicit Stripe + GHL + GA '
             'allowlist. XSS blast-radius reduced.'),
            ('SEC-3', 'MFA available but NOT required',
             'site_settings.require_admin_mfa per-tenant switch (default off) + admin layout '
             'gate + UI toggle with anti-lockout guardrail. Shipped 2026-06-17. Bug found + '
             'fixed 2026-06-18: post-verify path called cancelEnroll() which unenrolled the '
             'just-verified factor → toast said "enabled" but DB had 0 rows. Refactored to '
             'closeEnrollUi(discardFactor) with explicit control (commit 429b4b1). IAF '
             'flipped the policy to require_admin_mfa=true 2026-06-18 evening.'),
            ('SEC-5', 'No per-IP rate limit on public reads',
             '/api/products, /api/products/[slug], /api/availability now use lib/rate-limit at '
             '60/min/IP via Upstash. Returns 429 + Retry-After 60. Shipped 2026-06-17.'),
            ('SEC-6', 'EMAIL_ENCRYPTION_KEY rotation runbook',
             'docs/runbook-rotate-email-encryption-key.md + scripts/rotate-email-encryption-key.ts '
             '(dry-run / --apply). 8-step operator flow + rollback. Shipped 2026-06-17.'),
            ('SEC-9', 'Dependency CVE scanning',
             '.github/dependabot.yml — weekly npm + GitHub Actions, grouped minor/patch, '
             'individual majors. Already filing PRs. Shipped 2026-06-17.'),
            ('SEC-10 / OBS-1', 'MULTI_TENANT_TABLES drift detection',
             'scripts/check-tenant-scope.ts runs as the "scope-check" CI job on every PR via '
             '.github/workflows/ci.yml. New tables without registration fail CI.'),
            ('PII review', 'Sentry breadcrumbs PII coverage',
             'lib/sentry/scrub-pii.ts hardened: +6 token patterns (rfk_, pit-, re_, sk-ant-, '
             'sk-proj-, E.164 phone), pattern reorder so tokens redact before phone, REDACT_KEYS '
             'field-name list (customer_email, signed_name, etc.). 27 unit tests caught 5 real '
             'bugs during development. Shipped 2026-06-17.'),
            ('TEST-1', 'Integration test infrastructure',
             'tests/integration/ + dedicated TEST_SUPABASE_URL project. 5 files live: multi-'
             'tenant isolation, booking-email idempotency, inventory availability, dispatch '
             'status rollup, booking status machine. ~25 cases.'),
        ],
        col_widths=[0.7, 2.5, 3.9])

    api['add_h2'](doc, '16.7  Open findings (priority-ranked)')

    api['add_kv_table'](doc,
        ['#', 'Finding', 'Effort', 'Impact'],
        [
            ('SEC-2', 'Password complexity rules not enforced (Supabase defaults)',
             '2 hours', 'Medium'),
            ('SEC-4', 'GHL webhook secret uses simple == comparison (timing attack)',
             '15 min', 'Low (attacker would need many attempts)'),
            ('SEC-7', 'No SOC2 / HIPAA / formal compliance attestation',
             'months', 'Optional — depends on enterprise customer targeting'),
            ('SEC-8', 'Webhook receivers can\'t signal "permanent failure" — 4xx still retries',
             '2 hours', 'Low — tenant integrator pain'),
            ('SEC-3-next', 'MFA enforcement default OFF for new tenants (policy switch ships off)',
             '2 hours', 'Medium — raises security floor automatically'),
        ],
        col_widths=[0.7, 3.4, 1.0, 1.9])
