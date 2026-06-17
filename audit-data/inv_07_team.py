"""Investor 7 — The Team. How Ludmila + Henry ship at this pace."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 7, 'The Team',
        'Two people. Complementary skills. Multi-year execution history. Why this combination ships.',
        audience_tags=['Angel', 'Pre-Seed'])

    api['add_h2'](doc, '7.1  The founding pair')

    api['add_2col'](doc,
        'OPERATOR + GO-TO-MARKET. Owns the customer relationship. Marketing background. Currently '
        'operates It\'s Always Fun (the flagship rental business that RentalFlow runs). Manages '
        'GoHighLevel outbound, prospecting, demo calls, onboarding, and tenant success. The '
        '"voice of the customer" — every product decision passes through "would Ludmila say this '
        'is useful?"',
        'BUILDER + TECHNICAL LEAD. Architected and shipped the entire RentalFlow platform '
        '(273 .ts files, 115 SQL migrations, 11 live integrations, 13 cron jobs). Multi-year '
        'history of shipping fully-functioning SaaS solo (FXPulse, FXPulse Scanner, BRJ '
        'Prospector). Handles deployment, monitoring, incident response.',
        left_title='Ludmila',
        right_title='Henry')

    api['add_h2'](doc, '7.2  Why the pairing works')

    api['add_p'](doc,
        'The hardest part of vertical SaaS is the gap between "we know what to build" and "we '
        'can build it." Most early-stage teams fail because they sit on only one side of that gap:')

    api['add_kv_table'](doc,
        ['Common failure mode', 'How this pair avoids it'],
        [
            ('Operator-only founder',
             'Hires technical co-founder too late; spends 6 months looking for "a CTO who gets it." '
             'Henry is already in.'),
            ('Technical-only founder',
             'Builds the wrong product for 18 months; first hires a "growth person" too late. '
             'Ludmila is already feeding requirements.'),
            ('Hired-CTO model',
             'Engineering ownership wanes when the contractor moves on. Henry built and owns it.'),
            ('Solo founder',
             'Either no time to sell OR no time to build. RentalFlow has both happening in parallel.'),
        ],
        col_widths=[2.0, 5.1])

    api['add_h2'](doc, '7.3  Operating cadence')

    api['add_data_sheet'](doc,
        title='How they work',
        subtitle='Multi-year operating partnership.',
        fields=[
            ('Decision split',
             'Product priorities + customer relationships: Ludmila decides. Architecture + '
             'engineering trade-offs: Henry decides. Both sign off on revenue / pricing / '
             'roadmap changes.'),
            ('Release rhythm',
             'Continuous deploys to production. Most days have at least one merge. Features '
             'ship in days, not quarters. Vercel preview deploys make peer review fast.'),
            ('Outbound rhythm',
             'Ludmila runs daily GHL outbound (10 → 50 leads/day ramp). Henry monitors platform '
             'health + ships requested features within the day for high-priority items.'),
            ('Communication',
             'Continuous async — Slack-level message density. Joint home base. No "weekly sync" '
             'overhead because they live the business together.'),
            ('Customer feedback loop',
             'Ludmila handles every customer conversation directly. New feature requests reach '
             'Henry the same day. Bug reports get a hotfix within hours.'),
        ])

    api['add_h2'](doc, '7.4  Track record beyond RentalFlow')

    api['add_p'](doc,
        'A pre-seed investment is partly a bet on the team\'s ability to ship the NEXT thing. '
        'The pair has multiple parallel ship-and-monetize datapoints:')

    api['add_kv_table'](doc,
        ['Project', 'Status', 'What it proves'],
        [
            ("It's Always Fun (IAF)",
             'LIVE — Jacksonville rental business',
             'Ludmila can run a real, paying-customer business operation. RentalFlow exists '
             'because she lives the problem.'),
            ("RentalFlow",
             'LIVE — multi-tenant SaaS',
             'Henry can architect and ship a complete vertical SaaS. Pair can monetize it.'),
            ("FXPulse + FXPulse Scanner",
             'LIVE — fxpulse.org + scanner.fxpulse.org',
             'Henry can ship algorithmic trading infrastructure (price feeds, scanner, '
             'auto-execute) including a 24/7 live broadcast operation.'),
            ("BRJ Prospector",
             'LIVE — brjprospector.streamlit.app',
             'Pair can ship a Streamlit SaaS to a paying B2B customer in <30 days. Pivot to '
             'multi-tenant validated.'),
            ('Il Murali Jacksonville campaign',
             'Active — marketing project',
             'Ludmila runs multi-channel paid + organic marketing campaigns end-to-end.'),
        ],
        col_widths=[1.7, 1.9, 3.5])

    api['add_callout'](doc, 'good',
        'Multiple shipped projects, multiple paying customers, multiple verticals — without any '
        'raised capital. That\'s the multi-year hand-built proof of capital efficiency.')

    api['add_h2'](doc, '7.5  Where the team has gaps')

    api['add_callout'](doc, 'warn',
        'Honest assessment — what would help the most in the next 6-12 months:')

    api['add_bullet'](doc, [
        ('A part-time / fractional customer success person ', True),
        ('to absorb the support work that currently flows to Ludmila. Frees her time for sales + '
         'product decisions.', False),
    ])
    api['add_bullet'](doc, [
        ('A growth-marketing partner ', True),
        ('to test paid acquisition channels in parallel with GHL outbound. Today this is '
         'untested ground.', False),
    ])
    api['add_bullet'](doc, [
        ('A second engineer ', True),
        ('— not urgent, but the bus factor of one technical founder is real. The right second '
         'engineer is hired AFTER the platform has 50+ paying tenants, not before.', False),
    ])

    api['add_p'](doc,
        'None of these gaps blocks growth today. They are the kinds of investments the next '
        '$50-500K can fund without distorting the operating model.')

    api['add_h2'](doc, '7.6  Equity + ownership')

    api['add_p'](doc,
        'Pair owns 100% of RentalFlow today. No prior raises. No outside cap table. Clean room '
        'for a single angel or small angel syndicate.')

    api['add_callout'](doc, 'info',
        'For specifics on the cap table + investment structure, see Chapter 9 (The Ask).')
