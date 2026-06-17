"""Investor 8 — Risks. The honest assessment."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 8, 'Risks',
        'Five honest risks. What we are doing about each.',
        audience_tags=['Angel', 'Pre-Seed'])

    api['add_callout'](doc, 'quote',
        '"Every pitch that hides risks is hiding from itself. Here are ours — what they are, '
        'how big, what mitigates them."')

    api['add_h2'](doc, '8.1  Risk 1 — Single technical founder (bus factor)')

    api['add_data_sheet'](doc,
        title='Risk: Henry is the only person who can change the architecture',
        subtitle='Magnitude: HIGH (severity) × LOW (likelihood)',
        fields=[
            ('What could happen',
             'Henry is unavailable (illness, life event, burnout) for >2 weeks. Production stays '
             'running but no new features ship. Tenant churn risk if a critical bug hits.'),
            ('Why it\'s real',
             'There is no second engineer. Code clarity + Sentry monitoring + Vercel rollback + '
             'documented runbooks mitigate, but a real incident still needs human attention.'),
            ('Mitigations in place', [
                'Comprehensive technical audit + reference doc (this one) — onboarding any '
                'second engineer is a faster path than starting from scratch',
                'Runbook for restore from S3/R2 backups (docs/runbook-restore.md)',
                'Sentry alerts on production errors, cron monitor SLAs',
                'Vercel one-click rollback for bad deploys',
                'Code is documented in plain English + Ludmila can drive operational tasks',
            ]),
            ('What capital would buy',
             'Eventually a second engineer (after ~50 paying tenants). Earlier: contracted '
             'pinch-hitter on retainer for emergencies. ~$5K/quarter for "in case of fire" coverage.'),
        ])

    api['add_h2'](doc, '8.2  Risk 2 — Acquisition channel concentration')

    api['add_data_sheet'](doc,
        title='Risk: Outbound via GHL is the primary channel; paid is untested',
        subtitle='Magnitude: MEDIUM × MEDIUM',
        fields=[
            ('What could happen',
             'GHL deliverability degrades (Gmail/Yahoo flags), 10DLC compliance changes break '
             'cold SMS, or LinkedIn outreach gets gated. Acquisition slows while we figure out '
             'a new channel.'),
            ('Why it\'s real',
             'Paid channels (Google Ads, Meta) untested at scale. Niche directories (Inflatable '
             'Office, partytime) require manual relationship work. The "what if outbound stops '
             'working" scenario is the single channel-risk worth pricing.'),
            ('Mitigations in place', [
                'Inbound from IAF\'s SEO + organic referrals provides a floor',
                'Public marketing site optimized for keyword capture',
                'Free-tools lead magnets (1099 tracker) feed top-of-funnel',
                'Pair has marketing background (Ludmila) — channel-switching capability is real',
            ]),
            ('What capital would buy',
             'Test paid channels in parallel ($5-20K/month for 3-6 months) to validate CAC. Hire '
             'fractional growth marketer to test 2-3 new channels concurrently.'),
        ])

    api['add_h2'](doc, '8.3  Risk 3 — Test coverage / "the platform breaks under load"')

    api['add_data_sheet'](doc,
        title='Risk: 19 test cases protect a system with 51 API endpoints + 13 crons',
        subtitle='Magnitude: MEDIUM × MEDIUM',
        fields=[
            ('What could happen',
             'A regression slips through to production. Booking confirmation emails stop firing '
             'for 12 hours. Customer churn risk + tenant trust hit.'),
            ('Why it\'s real',
             'The 2026-06-15 quote-converted-bookings race condition is exactly this class of '
             'bug. It was caught and fixed within hours via Sentry + customer signal — but a '
             'larger tenant base means more blast radius per incident.'),
            ('Mitigations in place', [
                'Pricing logic + multi-tenant isolation + booking-email idempotency ARE tested',
                'Sentry catches uncaught exceptions in production within seconds',
                'Cron monitors detect missed runs within minutes',
                'Vercel rollback is one click + ~30 seconds',
            ]),
            ('What capital would buy',
             'Engineering time to ship 10 integration tests covering booking + payment + webhook '
             'cascade + dispatch state machine. ~1 week of focused work. Plus 3 e2e tests covering '
             'happy path. ~$10K-15K of focused engineering time.'),
        ])

    api['add_h2'](doc, '8.4  Risk 4 — Competitive response from incumbents')

    api['add_data_sheet'](doc,
        title='Risk: Booqable / Goodshuffle / Rentle launch $99 flat tier or driver app',
        subtitle='Magnitude: MEDIUM × LOW-MEDIUM',
        fields=[
            ('What could happen',
             'A well-funded incumbent (Booqable raised millions) decides to launch flat-rate '
             'pricing or close the driver-app gap. Could cap our growth ceiling.'),
            ('Why it\'s real',
             'Vertical SaaS in $100k-1M ARR range often gets a competitive reaction at the '
             'next growth milestone. Incumbents have distribution; we have product.'),
            ('Mitigations in place', [
                'Integration depth (Chapter 4) makes "match feature for feature" an 18-month job',
                'Multi-tenant correctness debt is hidden — incumbents won\'t notice until they audit',
                'Vertical know-how (rental-specific rules) requires operator inside the team',
                'Flat-pricing positioning is sticky once established',
            ]),
            ('Honest view',
             'A determined incumbent CAN catch up. Our window is ~18-24 months. The right answer '
             'is grow fast enough to be category-leading by the time they react.'),
        ])

    api['add_h2'](doc, '8.5  Risk 5 — Platform / vendor dependency')

    api['add_data_sheet'](doc,
        title='Risk: Vercel / Supabase / Stripe / GHL / Twilio policy change',
        subtitle='Magnitude: MEDIUM × LOW',
        fields=[
            ('What could happen',
             'A major vendor changes pricing, deprecates an API, or terminates Connect access. '
             'Migration cost is real. Tenant trust hit during migration.'),
            ('Why it\'s real',
             'We use 11 third-party services. Each one is an external dependency. The most '
             'consequential are Supabase (DB), Stripe (payments), Vercel (hosting).'),
            ('Mitigations in place', [
                'Supabase: PostgreSQL underneath — portable to AWS RDS / Neon / self-hosted in '
                'weeks, not months. RLS policies + functions are pure SQL.',
                'Stripe Connect: harder to migrate but tenants own the relationship via Connect '
                'IDs — switching is a multi-month project, not catastrophic.',
                'Vercel: Next.js is portable to other Node hosts. Code change minimal; cron + '
                'env var migration mostly mechanical.',
                'GHL: Operator-facing only. If GHL changes, Ludmila switches to another CRM '
                'without code changes.',
            ]),
            ('What capital would buy',
             'No urgent need. Documented migration runbooks for each critical vendor is a '
             'documentation-debt item, not engineering work.'),
        ])

    api['add_h2'](doc, '8.6  Risk summary')

    api['add_kv_table'](doc,
        ['Risk', 'Magnitude', 'Likelihood', 'Mitigation status'],
        [
            ('1. Single technical founder', 'High', 'Low',           'Mitigated via docs + runbooks'),
            ('2. Acquisition concentration', 'Medium', 'Medium',     'Capital diversifies'),
            ('3. Test coverage',            'Medium', 'Medium',      'On 30-day list'),
            ('4. Competitive response',     'Medium', 'Low-Medium',  'Speed is the mitigation'),
            ('5. Vendor dependency',         'Medium', 'Low',         'Portable architecture'),
        ],
        col_widths=[2.5, 1.2, 1.4, 2.0])

    api['add_callout'](doc, 'good',
        'No single risk is "this could kill us tomorrow." The two operational risks (founder '
        'bus factor + test coverage) are the ones capital meaningfully accelerates. The market '
        'risks (channel concentration + competitive response) get faster mitigations from capital '
        'but are not blockers.')
