"""Chapter 3 — Technology Stack. Every framework, every service, why it was chosen."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 3, 'Technology Stack',
        'Every framework, every service, with the rationale behind each pick.',
        audience_tags=['Engineer', 'Acquirer'])

    api['add_h2'](doc, '3.1  Stack summary')

    api['add_kv_table'](doc,
        ['Layer', 'Choice', 'Notes'],
        [
            ('Framework', 'Next.js 14.2.35 (App Router)',
             'React Server Components + Server Actions. Bundle-light admin.'),
            ('Runtime', 'Node.js (Vercel functions)',
             'Vercel Fluid Compute by default — graceful shutdowns, reused instances.'),
            ('Hosting', 'Vercel (auto-deploy on push to main)',
             'Preview deploys per branch. Domain mapping in Vercel console.'),
            ('Database', 'Supabase Postgres (managed)',
             '88 tables, 197 RLS policies, 210 indexes. Postgres 17 default.'),
            ('Auth', 'Supabase Auth + custom Resend OTP for portal',
             'Cookie-based sessions. MFA (TOTP) supported for admins.'),
            ('Data access', 'PostgREST via @supabase/supabase-js + tenant proxy',
             'lib/tenant/scope.ts wraps client with auto-tenant injection.'),
            ('Payments', 'Stripe + Stripe Connect (v17 SDK, API 2024-09-30)',
             'Tenant-owned payouts. Webhook handler is the most critical route.'),
            ('Email — outbound', 'Resend (REST API)',
             'Per-tenant sender via getTenantEmailConfig.'),
            ('Email — inbound', 'IMAP via imapflow + Cloudflare Email Worker',
             'Polling every 5min. Encrypted credentials per account.'),
            ('SMS', 'Twilio Programmable Messaging',
             'A2P 10DLC compliant. Explicit opt-in at checkout.'),
            ('CRM', 'GoHighLevel v2021-07-28 API + webhooks',
             'pit-* bearer token, location-scoped. Bidirectional sync.'),
            ('Error tracking', 'Sentry 8.40 (@sentry/nextjs) + cron monitors',
             'PII scrubbing. SLA alerts on every cron job.'),
            ('Backups', 'AWS S3 + Cloudflare R2 (dual)',
             'Weekly via cron. JSON + CSV exports. Dual-target for redundancy.'),
            ('Cache / rate limit', 'Upstash Redis (KV REST API)',
             'Sliding-window rate limits. Fail-open if unreachable.'),
            ('PWA', 'next-pwa 5.6',
             'Driver app installable. Offline-aware caching.'),
            ('AI', 'Anthropic Claude API (admin assistant) + OpenAI (public chat)',
             'Tools-enabled — read-only catalog/booking lookups, no writes.'),
        ],
        col_widths=[1.5, 2.4, 3.2])

    api['add_h2'](doc, '3.2  Dependency manifest')

    api['add_p'](doc, 'package.json declares 25 runtime dependencies + 16 dev dependencies.')

    api['add_h3'](doc, 'Runtime dependencies (25)')

    api['add_kv_table'](doc,
        ['Package', 'Version', 'Used for'],
        [
            ('@aws-sdk/client-s3', '^3.1056', 'Weekly backup → S3 bucket'),
            ('@sentry/nextjs', '^8.40', 'Error + performance + cron monitoring'),
            ('@stripe/react-stripe-js', '^2.8', 'Stripe Elements payment UI'),
            ('@stripe/stripe-js', '^4.7', 'Stripe.js loader'),
            ('@supabase/ssr', '^0.5', 'Server-side cookie session handling'),
            ('@supabase/supabase-js', '^2.45', 'Postgres + Auth + Storage client'),
            ('@upstash/ratelimit', '^2.0', 'Sliding-window rate limiter'),
            ('@upstash/redis', '^1.38', 'KV store via REST'),
            ('class-variance-authority', '^0.7', 'Tailwind variant composer'),
            ('clsx', '^2.1', 'Conditional className utility'),
            ('date-fns', '^3.6', 'Date math (event_date, lead time, etc.)'),
            ('imapflow', '^1.3', 'IMAP client for superadmin inbox sync'),
            ('isomorphic-dompurify', '^2.36', 'HTML sanitization for email bodies'),
            ('lucide-react', '^0.447', 'Icon set (everywhere in admin UI)'),
            ('mailparser', '^3.9', 'Parse MIME email bodies'),
            ('next', '14.2.35', 'Framework (App Router)'),
            ('next-pwa', '^5.6', 'Driver PWA installability'),
            ('nodemailer', '^6.10', 'SMTP outbound (admin inbox replies)'),
            ('react / react-dom', '^18.3', 'UI framework'),
            ('sonner', '^1.5', 'Toast notification UI'),
            ('stripe', '^17.0', 'Stripe server SDK'),
            ('tailwind-merge', '^2.5', 'Conflict-aware Tailwind merge'),
            ('yaml', '^2.9', 'Used in audit / config parsing'),
            ('zod', '^3.23', 'Schema validation on every server action + API route'),
        ],
        col_widths=[2.5, 1.0, 3.6])

    api['add_h3'](doc, 'Dev / build dependencies (16)')

    api['add_kv_table'](doc,
        ['Package', 'Version', 'Used for'],
        [
            ('typescript', '^5.6', 'Type checking (npm run typecheck)'),
            ('eslint + eslint-config-next', '^8.57 / 14.2', 'Linting'),
            ('vitest + @vitest/ui', '^4.1', 'Unit + integration test runner'),
            ('happy-dom', '^20.9', 'Vitest DOM environment'),
            ('tsx', '^4.19', 'Run TypeScript scripts (seed, check-scope)'),
            ('tailwindcss + autoprefixer + postcss', '3.4 / 10 / 8', 'CSS pipeline'),
            ('sharp', '^0.34', 'Next.js image optimization'),
            ('@types/* (5 packages)', 'various', 'Type definitions'),
        ],
        col_widths=[2.5, 1.0, 3.6])

    api['add_h2'](doc, '3.3  Why this stack')

    api['add_p'](doc, 'Decisions that materially shape the architecture:')

    api['add_bullet'](doc,
        'Next.js App Router → Server Components → the admin pages ship almost no JS to the '
        'browser. A 56-page admin with 100+ tables loads as fast as a static site.')
    api['add_bullet'](doc,
        'Supabase replaces what would otherwise be three services (Postgres + Auth + Storage). '
        'It also gives realtime out of the box, which the admin dashboard uses for live updates.')
    api['add_bullet'](doc,
        'Direct HTTP calls (no SDK) for Twilio, Resend, GHL → simpler debugging, no SDK '
        'version drift, ~10kb of bundle savings, and full control over retry/error semantics.')
    api['add_bullet'](doc,
        'IMAP via imapflow is unusual. It powers the superadmin unified inbox — Ludmila can '
        'connect external email accounts (Gmail forwarding, 20i StackMail) and get a CRM-like '
        'view without paying for Front or Help Scout.')
    api['add_bullet'](doc,
        'Vercel + Supabase + Stripe is the "SaaS in a weekend" baseline. RentalFlow extends '
        'it substantially with Cloudflare R2 dual-backups, Upstash rate limiting, Sentry cron '
        'monitors, and per-tenant email domain support.')

    api['add_callout'](doc, 'info',
        'Stack age: Next.js 14 (latest stable is 15 at audit time). React 18 (latest 19). '
        'Both upgrades are non-trivial but well-documented. They\'re on the 180-day roadmap, '
        'not the 30-day list — the current stack is stable and supported.')

    api['add_h2'](doc, '3.4  Build, type-check, and CI')

    api['add_kv_table'](doc,
        ['Script', 'Command', 'When it runs'],
        [
            ('dev',           'next dev',                         'Local development'),
            ('build',         'next build',                       'Every Vercel deploy (auto)'),
            ('start',         'next start',                       'Production serve'),
            ('lint',          'next lint',                        'Manual / pre-commit (when configured)'),
            ('typecheck',     'tsc --noEmit',                     'Manual + recommended in CI'),
            ('test',          'vitest run',                       'Manual + recommended in CI'),
            ('test:integration', 'vitest run --config vitest.integration.config.ts',
                                                                  'Against dedicated test Supabase project'),
            ('check:scope',   'tsx scripts/check-tenant-scope.ts',
                                                                  'Multi-tenant audit (recommend nightly + CI)'),
            ('seed',          'tsx scripts/seed.ts',              'Local fresh-install'),
            ('supabase:types', 'supabase gen types typescript --local > types/database.ts',
                                                                  'After schema changes'),
        ],
        col_widths=[1.5, 2.7, 2.9])

    api['add_callout'](doc, 'good',
        'CI on PR is live as of the June 2026 sprint. .github/workflows/ci.yml runs typecheck + '
        'lint + tests + scope-check + integration-tests on every PR + push to main. Adding a '
        'new tenant_id column without registering it in MULTI_TENANT_TABLES now fails CI.')
