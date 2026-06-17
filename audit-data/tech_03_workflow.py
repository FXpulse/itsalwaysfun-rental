"""Tech 3 — Daily Workflow. Git, deploys, testing, hotfixes."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 3, 'Daily Workflow',
        'How code goes from your laptop to production. The rules and the rituals.',
        audience_tags=['New Engineer'])

    api['add_h2'](doc, '3.1  Branches')

    api['add_kv_table'](doc,
        ['Branch', 'Purpose'],
        [
            ('main',
             'Always deployable. Every push triggers a Vercel production deploy. Protect it.'),
            ('feature/<short-name>',
             'A new feature or substantial change. Off main. Becomes a PR.'),
            ('fix/<short-name>',
             'A bug fix. Off main. Becomes a PR.'),
            ('hotfix/<short-name>',
             'A production-down or near-emergency fix. Same as fix/ but flagged for fast review.'),
            ('sandbox/<yourname>-*',
             'Playground for trying things. PRs closed without merge. Free to delete.'),
        ],
        col_widths=[1.8, 5.3])

    api['add_h2'](doc, '3.2  Commit messages')

    api['add_p'](doc, 'Convention from the git log:')

    api['add_mono_block'](doc, """
   feat(driver): bottom nav + dedicated Inbox/Chat/Me pages
   fix(driver): 4 bugs found in audit — photo uploads, status sync, layout gates
   feat(api-v1): OpenAPI 3.0 spec + Swagger UI docs at /api/v1/docs
   feat(bookings): per-booking team chat thread UI (admin/staff/driver)

   Pattern:
     <type>(<scope>): <summary in present tense, lowercase>

   Types:
     feat   — new feature
     fix    — bug fix
     refactor — change with no behavior diff
     docs   — README / docs only
     chore  — tooling, deps, build
     test   — tests only
     perf   — performance fix
""")

    api['add_callout'](doc, 'info',
        'Multi-line commit messages are encouraged for non-trivial PRs. Explain WHY in the '
        'body. The diff explains WHAT.')

    api['add_h2'](doc, '3.3  Pull request lifecycle')

    api['add_numbered'](doc, 'Branch off main. Make your change. Type-check + test locally.')
    api['add_numbered'](doc, 'Push. Open PR against main with descriptive title.')
    api['add_numbered'](doc, 'Vercel auto-deploys a preview URL. Check that URL on a tenant host '
                              'like itsalwaysfun-rental-<hash>-iaf.vercel.app or your test domain.')
    api['add_numbered'](doc, 'Request review. Henry or Ludmila merges (depending on scope).')
    api['add_numbered'](doc, 'Merge → production deploys in ~3-4 minutes.')
    api['add_numbered'](doc, 'Verify on production by hitting itsalwaysfun.com (or any active tenant).')

    api['add_callout'](doc, 'warn',
        'There is NO CI gate on PRs today. Type-check + test run locally only. Vercel build '
        'catches type errors as the last line of defense — but THAT is also after merge. The '
        '30-day plan adds GitHub Actions on PR.')

    api['add_h2'](doc, '3.4  Sensitive areas — extra care')

    api['add_kv_table'](doc,
        ['Area', 'What to verify before merging'],
        [
            ('middleware.ts',
             'Test on at least: apex (getrentalflow.com), tenant subdomain (iaf), tenant custom '
             'domain (itsalwaysfun.com). One change here can break every surface.'),
            ('lib/tenant/scope.ts',
             'Run `npm run check:scope` AND add a unit test if the change is non-trivial. The '
             'multi-tenant audit (Chapter 6) explains why this is sacred.'),
            ('app/api/webhooks/stripe/route.ts',
             'The most-critical handler. Use the Stripe CLI locally to trigger every event you '
             'touch. Verify idempotency (run the same event twice — second time must be a no-op).'),
            ('app/api/bookings/check-and-hold/route.ts',
             'The hot path. Add or update pricing unit tests. Verify rate limiting still triggers.'),
            ('Any actions.ts under /admin',
             'Always Zod-validate input. Always call revalidatePath for affected surfaces. '
             'Always logAuditEvent for non-trivial mutations.'),
            ('SQL migrations',
             'Idempotent? Reversible if possible? Tested on dev Supabase first? Updated '
             'ALL_MIGRATIONS.sql? Updated MULTI_TENANT_TABLES if applicable?'),
        ],
        col_widths=[2.4, 4.7])

    api['add_h2'](doc, '3.5  Hotfix workflow')

    api['add_p'](doc, 'When production is broken or near-broken:')

    api['add_numbered'](doc, 'Branch hotfix/<short-name> off main.')
    api['add_numbered'](doc, 'Make the SMALLEST possible change that fixes the issue. Resist '
                              'the temptation to refactor while you\'re there.')
    api['add_numbered'](doc, 'Add a test if feasible (idempotency tests are easy to retrofit).')
    api['add_numbered'](doc, 'Push. Watch the preview deploy. Verify the fix.')
    api['add_numbered'](doc, 'Merge to main. Watch the prod deploy.')
    api['add_numbered'](doc, 'Verify on production immediately.')
    api['add_numbered'](doc, 'Send a Slack / email summary to Ludmila + Henry: what broke, what fixed '
                              'it, what you\'ll do follow-up.')

    api['add_callout'](doc, 'risk',
        'NEVER force-push to main. NEVER use --no-verify on the commit hook. NEVER skip '
        'the preview deploy verification step on a hotfix. Hotfixes feel urgent, but the '
        'speed bumps are there for a reason.')

    api['add_h2'](doc, '3.6  Deploys + rollbacks')

    api['add_kv_table'](doc,
        ['Action', 'How'],
        [
            ('Deploy production',  'git push main (Vercel auto-deploys)'),
            ('See deploy status',  'vercel.com → itsalwaysfun-rental project → Deployments'),
            ('Roll back',          'Vercel UI → previous deployment → "Promote to production". <30s.'),
            ('Manual hotfix env var', 'Vercel UI → Settings → Environment Variables. Redeploy.'),
            ('Run a cron manually', 'curl https://<host>/api/cron/<name> with Authorization: Bearer $CRON_SECRET'),
        ],
        col_widths=[2.2, 4.9])

    api['add_callout'](doc, 'good',
        'Vercel\'s instant rollback is your safety net. If a prod deploy breaks something '
        'within 5 minutes of merging, ROLL BACK FIRST, investigate after. Rollback is faster '
        'than debugging under pressure.')

    api['add_h2'](doc, '3.7  Reading logs + errors')

    api['add_kv_table'](doc,
        ['Where', 'For what'],
        [
            ('Sentry (errors)',
             'Uncaught exceptions, server + client. Filtered breadcrumbs (PII scrubbed). '
             'Set up email alerts for new error fingerprints.'),
            ('Sentry (cron monitors)',
             'Misses, SLA violations on cron jobs. 7 of 13 jobs are monitored.'),
            ('Vercel logs',
             'Real-time function logs. Vercel UI → Logs. Filter by route. ~7 day retention.'),
            ('Supabase dashboard',
             'Slow queries, RLS denied counts, connection pool, storage usage.'),
            ('Resend dashboard',
             'Email delivery status (delivered, bounced, spam).'),
            ('Twilio dashboard',
             'SMS delivery status. 10DLC compliance reports.'),
            ('Stripe dashboard',
             'Payment events, webhook delivery, dispute notifications, Connect accounts status.'),
            ('GHL dashboard',
             'Contact upserts, opportunity creates, automation runs.'),
            ('Upstash dashboard',
             'Rate limit hits per key. Useful for diagnosing 429s.'),
        ],
        col_widths=[2.0, 5.1])

    api['add_h2'](doc, '3.8  Testing discipline')

    api['add_p'](doc,
        'Current state: 19 test cases (mostly pricing + multi-tenant isolation + booking-email '
        'idempotency). Recommended discipline when adding code:')

    api['add_bullet'](doc, [
        ('New pricing logic → ', False),
        ('add a case in tests/unit/pricing.test.ts', True),
        ('. Pricing tests are the most-loved (and easiest to extend).', False),
    ])
    api['add_bullet'](doc, [
        ('New tenant-scoped table → ', False),
        ('add a case in tests/integration/multi-tenant-isolation.test.ts', True),
        ('.', False),
    ])
    api['add_bullet'](doc, [
        ('New scheduled email → ', False),
        ('add a case in tests/integration/booking-email-idempotency.test.ts', True),
        (' to verify the ledger prevents duplicate sends.', False),
    ])
    api['add_bullet'](doc, [
        ('Any Zod schema change → ', False),
        ('extend tests/unit/validation.test.ts', True),
        ('.', False),
    ])

    api['add_callout'](doc, 'warn',
        'Test coverage is light. If you ship features without tests, you\'re relying on the '
        'next engineer (or yourself) to catch regressions in QA. That\'s expensive. The bar: '
        'every payment-affecting change has at least one new test.')
