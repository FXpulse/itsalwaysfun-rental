"""Investor 6 — Unit Economics. Why $99 flat is the right shape at this stage."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 6, 'Unit Economics',
        'Why $99 flat is the right shape. Margin math. Scale curve.',
        audience_tags=['Angel', 'Pre-Seed'])

    api['add_h2'](doc, '6.1  The pricing decision')

    api['add_callout'](doc, 'quote',
        '"We could charge $200. We could charge per-booking. We chose $99 flat because it removes '
        'the customer\'s objection at signup AND because we built a stack where the marginal cost '
        'per tenant is near-zero."')

    api['add_kv_table'](doc,
        ['Model considered', 'Why rejected'],
        [
            ('Per-booking commission (1-3%)',
             'Operators hate this. They already pay Stripe 2.9%+30¢. Adding another 1-3% on top '
             'feels punitive. Goodshuffle / Rentle do this — and it\'s a sales objection.'),
            ('Per-seat ($X / staff user / month)',
             'Punishes small teams. A 2-person rental business pays the same as a 10-person one '
             'unless we charge per seat — and then we punish growth. Booqable / Goodshuffle do this.'),
            ('Tiered (Starter / Pro / Enterprise)',
             'Adds sales complexity, pricing-page confusion, "wait, which tier has driver app?" '
             'questions. We want decision to be "yes/no," not "which one."'),
            ('Flat $99/month, everything included',
             'CHOSEN. Easy yes. Easy renewal. Easy referral. Doesn\'t punish growth. Makes pricing '
             'page a one-liner.'),
        ],
        col_widths=[2.0, 5.1])

    api['add_h2'](doc, '6.2  The COGS math per tenant')

    api['add_p'](doc,
        'Marginal cost of one additional tenant on the platform (the new tenant\'s share of '
        'platform infrastructure, NOT the platform fixed cost):')

    api['add_kv_table'](doc,
        ['Cost component', '$/tenant/month (est.)', 'Notes'],
        [
            ('Supabase row + storage delta',  '$0.50 - $2',   'A few thousand new rows + ~100 MB storage'),
            ('Vercel function invocations',   '$0.20 - $1',   'Tenant traffic is fractional of total'),
            ('Resend emails (transactional)',  '$1 - $5',      'Per-tenant email volume × $0.001'),
            ('Twilio SMS',                     '$2 - $10',     'Depends heavily on opt-in + booking volume'),
            ('Stripe fees',                    'pass-through', '0 — customer pays Stripe directly via Connect'),
            ('GHL workflow runs',              '$0 - $2',      'Shared GHL account, very low marginal cost'),
            ('Sentry events',                  '$0.10 - $0.50','Capped by sampling. Sentry has plan tiers.'),
            ('Cloudflare R2 + AWS S3',         '$0.05 - $0.20','Backup storage delta'),
            ('Upstash Redis',                  '$0.10 - $0.50','Rate limit + cache delta'),
        ],
        col_widths=[2.5, 1.7, 2.9])

    api['add_callout'](doc, 'fact',
        'Total estimated marginal COGS per tenant: $4-21/month. At $99 ARPU: 79-96% gross margin. '
        'These ratios are typical for vertical SaaS at this stage and are the reason the $99 flat '
        'price is sustainable.')

    api['add_h2'](doc, '6.3  Fixed costs (the SaaS overhead)')

    api['add_p'](doc,
        'The platform itself runs on fixed-cost infrastructure. These costs do NOT scale linearly '
        'with tenant count:')

    api['add_kv_table'](doc,
        ['Service', 'Plan', '$/month (est.)'],
        [
            ('Vercel',         'Pro',                  '$20'),
            ('Supabase',       'Pro',                  '$25'),
            ('Sentry',         'Team',                 '$26'),
            ('Resend',         'Production',           '$20'),
            ('Twilio',         'Pay-as-you-go',        'usage-based, counted in COGS above'),
            ('Stripe',         'Standard + Connect',   'pass-through'),
            ('Upstash',        'Pay-as-you-go',        '$5'),
            ('Cloudflare R2',  'Pay-as-you-go',        '$5'),
            ('AWS S3',         'Pay-as-you-go',        '$5'),
            ('Anthropic + OpenAI', 'Pay-as-you-go',    '$10-30 (usage-capped)'),
            ('Domain registry, DNS', 'Annual',         '~$2/month amortized'),
        ],
        col_widths=[2.0, 1.8, 3.3])

    api['add_callout'](doc, 'info',
        'Fixed platform overhead today: ~$130-150/month. This breaks even at ~2 paying tenants. '
        'Every tenant above that contributes 79-96% margin.')

    api['add_h2'](doc, '6.4  The customer cost-of-acquisition (CAC) story')

    api['add_p'](doc,
        'CAC is the open variable. RentalFlow is at the early stage where:')

    api['add_bullet'](doc, [
        ('Inbound (organic, referrals from IAF\'s reputation, SEO): ', True),
        ('CAC ≈ $0', True),
        (' but volume is small.', False),
    ])
    api['add_bullet'](doc, [
        ('Outbound via GHL (cold email, cold SMS): ', True),
        ('CAC = email infrastructure cost + Ludmila\'s sales time', True),
        ('. Volume scales by ramping leads/day.', False),
    ])
    api['add_bullet'](doc, [
        ('Paid ads (Google, Facebook, niche directories): ', True),
        ('untested yet', True),
        ('. Capital would unlock testing.', False),
    ])

    api['add_h2'](doc, '6.5  LTV math (illustrative)')

    api['add_callout'](doc, 'warn',
        'These are illustrative ranges, NOT projections. Real LTV requires 12-24 months of '
        'churn data at scale, which RentalFlow does not yet have.')

    api['add_kv_table'](doc,
        ['Assumption', 'Low', 'Mid', 'High'],
        [
            ('Monthly churn',         '5%',     '3%',     '1.5%'),
            ('Months retained (1/churn)', '20',  '33',    '67'),
            ('LTV at $99 ARPU',       '$1,980', '$3,267', '$6,633'),
            ('LTV / CAC at $200 CAC', '10×',    '16×',    '33×'),
            ('LTV / CAC at $500 CAC', '4×',     '6.5×',   '13×'),
        ],
        col_widths=[2.5, 1.5, 1.5, 1.6])

    api['add_p'](doc,
        'The mid scenario (3% monthly churn = 33-month retention = $3,267 LTV) is conservative '
        'for vertical SaaS at this price point. Multi-tenant SaaS targeting small businesses '
        'often runs 4-8% monthly churn early; "fat" SaaS like RentalFlow (where leaving means '
        'rebuilding the customer\'s entire stack) tends toward lower churn.')

    api['add_h2'](doc, '6.6  The 2-sided revenue lever (future)')

    api['add_p'](doc,
        'A second revenue stream that becomes available once the platform has hundreds of '
        'tenants:')

    api['add_bullet'](doc, [
        ('Marketplace fee on Stripe Connect transactions ', True),
        ('— RentalFlow could take 0.25-0.5% (well under per-booking competitors\' 1-3%) and still '
         'be the cheapest option in the category. At 1,000 tenants × $200k/year through their '
         'platform = $0.5M-1M incremental ARR.', False),
    ])

    api['add_callout'](doc, 'info',
        'This lever is deliberately NOT enabled today. The $99 flat positioning is brand-load-'
        'bearing for the next 12-18 months of acquisition. The marketplace fee is the "scale '
        'lever" available when category leadership is established.')

    api['add_h2'](doc, '6.7  The capital efficiency story')

    api['add_p'](doc,
        'RentalFlow exists today without raised capital. That means the next $50-500K does not '
        'subsidize burn — it accelerates already-working channels. The right places to spend:')

    api['add_kv_table'](doc,
        ['Use of $50-500K', 'Why this and not something else'],
        [
            ('Paid acquisition test (Google + Meta + niche directories)',
             'Untested channel. $5-20K/month for 3-6 months tells us CAC per channel.'),
            ('Close 30-day reliability gaps (CI, integration tests, MFA, CSP)',
             'Pre-empts the "outage during tenant scale-up" failure mode. ~$15K of engineering time.'),
            ('Hire fractional support / customer success',
             'Ludmila is both founder + first support. Off-loading support unlocks more sales time. '
             '~$30K/year for fractional CS.'),
            ('Niche directory listings + paid placements',
             'Partytime.org, Inflatable Office Directory, etc. ~$5-10K/year for visibility.'),
            ('AI-driven onboarding playbook + in-product assistant',
             'Builds on existing Claude assistant. Reduces white-glove onboarding cost per tenant. '
             '~$10K engineering.'),
        ],
        col_widths=[2.6, 4.5])

    api['add_callout'](doc, 'good',
        'Capital efficiency is the lens, not a slogan. Every dollar should accelerate channels '
        'that already work or close gaps that already block scale. None of the proposed uses is '
        '"hire a 5-person dev team and build for 6 months."')
