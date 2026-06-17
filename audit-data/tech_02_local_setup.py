"""Tech 2 — Local Setup. From git clone to dev server in 30 minutes."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 2, 'Local Setup',
        'From git clone to dev server in ~30 minutes. Follow the steps in order.',
        audience_tags=['New Engineer'])

    api['add_h2'](doc, '2.1  Prerequisites')

    api['add_kv_table'](doc,
        ['Tool', 'Version', 'How to verify'],
        [
            ('Node.js',  '22.x (LTS)',          'node --version → v22.x.x'),
            ('npm',      'comes with Node',     'npm --version'),
            ('Git',      'any recent',          'git --version'),
            ('Supabase CLI', '1.x or later',    'supabase --version'),
            ('Stripe CLI',   'optional but recommended', 'stripe --version'),
            ('VS Code or Cursor', 'recommended', 'open the repo'),
        ],
        col_widths=[1.6, 1.6, 3.9])

    api['add_callout'](doc, 'warn',
        'Node 22 is REQUIRED. The /superadmin email inbox uses imapflow + mailparser + '
        'isomorphic-dompurify in patterns that depend on Node 22 ESM behavior. Older Node = '
        'mysterious failures on /superadmin only.')

    api['add_h2'](doc, '2.2  Clone + install')

    api['add_mono_block'](doc, """
   git clone https://github.com/FXpulse/itsalwaysfun-rental.git
   cd itsalwaysfun-rental
   npm install

   # If you see "fund" + "audit" output but no errors, you're good.
""")

    api['add_h2'](doc, '2.3  Environment variables')

    api['add_p'](doc,
        'There is no .env.example checked in (per Chapter 16 — this is on the doc-debt list). '
        'Get the .env.local from Ludmila or Henry. It contains 40+ secrets across Supabase, '
        'Stripe, GHL, Twilio, Resend, AWS, Cloudflare, Upstash, Sentry, Anthropic, OpenAI, '
        'IMAP encryption, CRON_SECRET, OTP_SECRET.')

    api['add_callout'](doc, 'risk',
        'Treat .env.local as a credential vault. Never commit. Never paste into Slack. If you '
        'leak even one Stripe key, rotate immediately at the provider dashboard AND in Vercel '
        'env. Notify Henry the same day.')

    api['add_h2'](doc, '2.4  Supabase: link to dev project')

    api['add_p'](doc,
        'Each developer connects to a SHARED dev Supabase project — not production. The dev '
        'project mirrors prod schema but has test data only.')

    api['add_mono_block'](doc, """
   # One-time: login to Supabase CLI
   supabase login

   # Link this repo to the dev project (project-ref from Ludmila/Henry)
   supabase link --project-ref <DEV_PROJECT_REF>

   # Verify
   supabase status
""")

    api['add_callout'](doc, 'info',
        'For migrations: there is a separate test Supabase project (TEST_SUPABASE_URL / '
        'TEST_SUPABASE_SERVICE_ROLE_KEY) that integration tests run against. Both dev and test '
        'have schema parity with prod.')

    api['add_h2'](doc, '2.5  Run the dev server')

    api['add_mono_block'](doc, """
   npm run dev
   # ▸ ready on http://localhost:3000
""")

    api['add_h2'](doc, '2.6  Pretend you are a tenant locally')

    api['add_p'](doc,
        'Tenant resolution is by Host header. Locally, this means /etc/hosts (or Windows '
        'equivalent) entries OR a tunneling tool like ngrok. The pragmatic local pattern:')

    api['add_kv_table'](doc,
        ['URL', 'What you see'],
        [
            ('http://localhost:3000/marketing',  'The marketing apex'),
            ('http://localhost:3000/?tenant=iaf', 'IAF as tenant (NOT a real flow — middleware '
                                                    'reads Host, not query param)'),
            ('http://iaf.localhost:3000/',       'IAF tenant via Host (works in most browsers '
                                                    'because *.localhost resolves to 127.0.0.1)'),
            ('http://iaf.localhost:3000/admin/login', 'Log in to admin'),
            ('http://iaf.localhost:3000/portal/login', 'Customer portal'),
            ('http://iaf.localhost:3000/driver',  'Driver app'),
        ],
        col_widths=[3.0, 4.1])

    api['add_callout'](doc, 'info',
        'On Windows, *.localhost resolves to 127.0.0.1 by default in modern browsers. '
        'On macOS and Linux it also resolves. If it doesn\'t in your setup, edit /etc/hosts.')

    api['add_h2'](doc, '2.7  Stripe webhook locally')

    api['add_p'](doc,
        'To test the booking → payment → webhook flow end-to-end locally, use the Stripe CLI.')

    api['add_mono_block'](doc, """
   # Listen for events and forward to local dev
   stripe listen --forward-to localhost:3000/api/webhooks/stripe

   # Output gives you a webhook signing secret like whsec_...
   # Put it in .env.local as STRIPE_WEBHOOK_SECRET temporarily.

   # In a second terminal, trigger a test event
   stripe trigger payment_intent.succeeded
""")

    api['add_callout'](doc, 'warn',
        'When you switch back to using the deployed dev environment, REMEMBER to restore the '
        'real STRIPE_WEBHOOK_SECRET (from the Stripe dashboard webhook endpoint). The CLI '
        'secret only works while the CLI is running.')

    api['add_h2'](doc, '2.8  Type-check + test loop')

    api['add_kv_table'](doc,
        ['Command', 'When to run'],
        [
            ('npm run dev',              'Hot-reload dev server'),
            ('npm run typecheck',         'After every meaningful change. Catches type errors.'),
            ('npm run test',              'Unit + integration tests (8 files, 19 cases)'),
            ('npm run test:watch',        'TDD loop'),
            ('npm run test:integration',  'Against the dedicated test Supabase project'),
            ('npm run lint',              'ESLint pass'),
            ('npm run check:scope',       'Verifies MULTI_TENANT_TABLES in sync with live schema'),
            ('npm run build',             'Production build (runs in Vercel automatically)'),
        ],
        col_widths=[2.8, 4.3])

    api['add_h2'](doc, '2.9  Database changes locally')

    api['add_p'](doc, 'Two paths depending on what you\'re doing:')

    api['add_kv_table'](doc,
        ['Scenario', 'Pattern'],
        [
            ('Read schema reference',
             'Open supabase/SCHEMA_BASELINE.sql (pg_dump output) for a current snapshot.'),
            ('Write a new migration',
             'New file: supabase/<feature_name>.sql (no timestamp prefix). Idempotent (IF NOT '
             'EXISTS, DROP-then-CREATE for policies). Add to ALL_MIGRATIONS.sql in the right '
             'order. Apply via `supabase db query --linked --yes -f supabase/<file>.sql`.'),
            ('Regenerate TypeScript types',
             '`npm run supabase:types` updates types/database.ts.'),
            ('Add a new tenant-scoped table',
             '(1) The migration creates the table with tenant_id NOT NULL + FK to tenants. '
             '(2) Add to MULTI_TENANT_TABLES in lib/tenant/scope.ts. '
             '(3) Add at least one RLS policy. '
             '(4) Run `npm run check:scope` to verify.'),
        ],
        col_widths=[2.0, 5.1])

    api['add_callout'](doc, 'warn',
        'NEVER add `tenant_id DEFAULT \'<some-uuid>\'` to a column. The 2026-06-10 audit '
        'removed all defaults to make missing tenant_id loud (NOT NULL violation). Re-adding '
        'a default re-introduces silent leak risk.')

    api['add_h2'](doc, '2.10  First commit — sanity check')

    api['add_numbered'](doc, 'Make a trivial change (e.g., edit a string in app/marketing/page.tsx)')
    api['add_numbered'](doc, 'npm run typecheck   → passes')
    api['add_numbered'](doc, 'npm run test         → passes')
    api['add_numbered'](doc, 'git checkout -b sandbox/<yourname>-first')
    api['add_numbered'](doc, 'git commit -am "test: first commit on the repo"')
    api['add_numbered'](doc, 'git push -u origin sandbox/<yourname>-first')
    api['add_numbered'](doc, 'Open a PR. Vercel preview deploys automatically. Open the preview URL.')
    api['add_numbered'](doc, 'Verify your change shows. Then close the PR (don\'t merge — it\'s a sandbox).')

    api['add_callout'](doc, 'good',
        'If you reach the end of this exercise without errors, your environment is set up '
        'correctly. Welcome aboard. The next chapter covers the real workflow.')
