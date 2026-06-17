"""Investor 1 — The One-Pager. What RentalFlow is in 60 seconds."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 1, 'The One-Pager',
        'What RentalFlow is. Why now. What the check buys.',
        audience_tags=['Angel', 'Pre-Seed'])

    api['add_h2'](doc, '1.1  In one sentence')

    api['add_callout'](doc, 'quote',
        '"RentalFlow is the only $99-flat SaaS that runs an inflatable-rental business end-to-end '
        '— bookings, payments, dispatch, drivers, customer portal, marketing — and it\'s already '
        'live, paying its own bills via the flagship customer."')

    api['add_h2'](doc, '1.2  The 5 facts an angel needs')

    api['add_kv_table'](doc,
        ['#', 'Fact', 'So what'],
        [
            ('1', 'Built by a rental operator (IAF) for rental operators.',
             'No "we surveyed the market" — Ludmila lives the problem daily.'),
            ('2', 'Live in production with the flagship + 9 other tenants on board.',
             'This is not a prototype. It is collecting real payments today.'),
            ('3', '11 third-party integrations live (Stripe Connect, GHL, Twilio, Resend, IMAP, '
                  'Sentry, AWS, Cloudflare, Upstash, Claude, OpenAI).',
             'Integration depth is the moat. Each one took 1-2 weeks of figuring out.'),
            ('4', '$99/month flat — no per-booking, no commission, no upsell. '
                  '$99 buys: site, booking, payments, dispatch, drivers, portal, loyalty, '
                  'referrals, email + SMS, AI assistant.',
             'Customers immediately see the price as honest. Reduces sales friction to zero.'),
            ('5', 'Bootstrapped to LIVE. Zero capital raised. Built nights/weekends + flagship-side revenue.',
             'Capital efficiency is real. The next $50-500K should compound, not subsidize burn.'),
        ],
        col_widths=[0.4, 3.0, 3.7])

    api['add_h2'](doc, '1.3  Why now')

    api['add_p'](doc,
        'Three converging realities make this the right moment to grow this category:')

    api['add_bullet'](doc, [
        ('Existing rental software is overpriced AND undermaintained. ', True),
        ('The incumbents (Booqable, Goodshuffle, Rentle, Sharetribe) charge $200-500/month for '
         'less surface area. They were built for a different era and the per-booking commission '
         'model is openly hated by operators.', False),
    ])
    api['add_bullet'](doc, [
        ('AI lowers the cost of building vertical SaaS by 5-10×. ', True),
        ('Henry built 273 .ts files + 115 SQL migrations in nights/weekends. That used to take '
         'a full team. The same leverage is now available to defend the lead — outbound automation, '
         'in-product assistant, dispatch optimization.', False),
    ])
    api['add_bullet'](doc, [
        ('The bounce-house segment is in a generational ownership shift. ', True),
        ('Boomer-era operators are retiring; younger buyers are taking over and expect digital-first '
         'tools. RentalFlow is built for them.', False),
    ])

    api['add_h2'](doc, '1.4  What this brief covers')

    api['add_kv_table'](doc,
        ['Chapter', 'Question it answers'],
        [
            ('2 — Market',         'Is there a real market here, or is this a hobby?'),
            ('3 — Product',        'What actually exists today?'),
            ('4 — Moat',           'Why can\'t someone copy this in 3 months?'),
            ('5 — Traction',       'Who\'s paying? What\'s the early signal?'),
            ('6 — Unit economics', 'Does the $99 model work?'),
            ('7 — Team',           'Who\'s actually building this?'),
            ('8 — Risks',          'What could kill this?'),
            ('9 — Ask',            'What\'s the deal you\'re being offered?'),
        ],
        col_widths=[2.0, 5.1])

    api['add_h2'](doc, '1.5  Headline numbers')

    api['add_stats_strip'](doc, [
        ('$99',  'flat /mo',        P['NAVY']),
        ('11',   'integrations live', P['BLUE']),
        ('LIVE', 'production',      P['GREEN']),
        ('0',    'rounds raised',   P['PURPLE']),
        ('273',  '.ts files',       P['AMBER']),
        ('115',  'SQL migrations',  P['TEAL']),
    ])

    api['add_p'](doc,
        'These are not vanity metrics. They are proxies for code volume, integration depth, and '
        'capital efficiency. The rest of this brief substantiates each one.')

    api['add_h2'](doc, '1.6  What this brief is NOT')

    api['add_callout'](doc, 'info',
        'This brief is not a TAM-charts pitch deck. It is not "we surveyed 500 prospects and 87% '
        'said they would buy." It is a founder-direct technical and operational view of what '
        'exists today, where it works, where it does not, and what the next $50-500K would buy. '
        'If you want to see hockey-stick projections, this is the wrong document. If you want to '
        'see what\'s actually built — keep reading.')

    api['add_h2'](doc, '1.7  How to read the rest')

    api['add_p'](doc,
        'The chapters are short and dense. If you only have 10 minutes, read chapters 2, 4, and 9 '
        '— market, moat, and ask. If you have 40 minutes, read all 9 in order.')
