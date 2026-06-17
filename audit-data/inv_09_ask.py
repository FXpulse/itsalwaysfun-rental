"""Investor 9 — The Ask. What we want. What you get. What happens next."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 9, 'The Ask',
        'What we want. What you get. What happens next.',
        audience_tags=['Angel', 'Pre-Seed'])

    api['add_h2'](doc, '9.1  The check')

    api['add_callout'](doc, 'quote',
        '"$50,000 - $500,000 in angel capital, structured as SAFE or convertible note. Single '
        'angel preferred; small syndicate considered."')

    api['add_h2'](doc, '9.2  What the capital buys')

    api['add_p'](doc,
        'Allocations are rough — every dollar gets discussed before it ships. The shape:')

    api['add_kv_table'](doc,
        ['Use', 'Approx %', 'Why this'],
        [
            ('Paid acquisition testing (Google, Meta, niche)',
             '40-50%',
             'Untested channel. $5-20K/month for 3-6 months tells us CAC per channel and unlocks '
             'sustained growth beyond GHL outbound.'),
            ('Close 30-day reliability gaps',
             '15-20%',
             'CI on PR, integration tests, MFA enforcement, CSP headers, uptime monitor, dependency '
             'scanning. Sets the floor before tenant count scales.'),
            ('Fractional customer success',
             '15-20%',
             'Free Ludmila\'s time from support. $30-50K/year for fractional CS. Unlocks more sales + '
             'product decisions.'),
            ('Niche directory + partnership work',
             '5-10%',
             'partytime.org, Inflatable Office, ARA, etc. Visibility in the segment.'),
            ('Founder cushion (Ludmila, Henry)',
             '10-15%',
             'Modest founder salaries during the acquisition test window so they\'re not '
             'context-switching to consulting work.'),
            ('Buffer + opportunistic',
             '5-10%',
             'Unforeseen tactical opportunities. Conferences, podcast sponsorships, etc.'),
        ],
        col_widths=[2.4, 0.8, 3.9])

    api['add_callout'](doc, 'info',
        'NONE of this is "hire 5 engineers and build for 6 months." The platform is shipped. '
        'The capital accelerates distribution of an already-working product.')

    api['add_h2'](doc, '9.3  What you get — beyond equity')

    api['add_p'](doc, 'The right angel for RentalFlow brings more than capital:')

    api['add_bullet'](doc, [
        ('Distribution intros ', True),
        ('— anyone with reach in the rental industry, party planning, equipment rental, or '
         'adjacent verticals. Direct intros to operators are 10× a cold email.', False),
    ])
    api['add_bullet'](doc, [
        ('Vertical SaaS / marketplace pattern recognition ', True),
        ('— having seen the playbook at Booqable / Vagaro / Mindbody / etc. accelerates '
         'decision-making at the next 2-3 inflection points.', False),
    ])
    api['add_bullet'](doc, [
        ('Founder-friendly operating ', True),
        ('— quarterly check-ins, not monthly board meetings. We need a partner, not a board '
         'manager.', False),
    ])
    api['add_bullet'](doc, [
        ('Honest signal on the next round ', True),
        ('— if seed becomes the right next step in 18-24 months, having an angel who can credibly '
         'introduce + endorse to seed VCs is worth more than the check.', False),
    ])

    api['add_h2'](doc, '9.4  What we offer in return')

    api['add_kv_table'](doc,
        ['You get', 'How it manifests'],
        [
            ('Equity in a profitable-margin SaaS',
             '79-96% gross margin on a $99 ARPU. Path to $1-10M ARR without dilution-heavy raises.'),
            ('Full operational transparency',
             'Quarterly written update. Open metrics. Access to the technical audit, /superadmin '
             'platform, and direct conversation with founders.'),
            ('Pro-rata rights for the next round',
             'If we raise seed in 18-24 months, your angel position is honored.'),
            ('A clean cap table',
             '100% founder owned today. No prior dilution. The angel position is meaningful.'),
            ('A real product, not a deck',
             'You can open itsalwaysfun.com today. You can sign up at getrentalflow.com. The '
             'system runs.'),
        ],
        col_widths=[2.4, 4.7])

    api['add_h2'](doc, '9.5  The wrong angel')

    api['add_callout'](doc, 'warn',
        'We are intentionally NOT the right fit for some angels. If you require any of the '
        'following, we are not aligned:')

    api['add_bullet'](doc, '"You should plan to raise a seed round in 6 months." — we may; we may not. '
                            'Pressuring a fast follow-on round is the wrong signal at this stage.')
    api['add_bullet'](doc, '"You should pivot to enterprise contracts at $5K/seat/month." — our wedge '
                            'is small operators. Moving upmarket prematurely kills the brand promise.')
    api['add_bullet'](doc, '"You should add 5 more verticals in year 1." — depth in inflatables → '
                            'adjacent rentals is the sequence. Spraying verticals dilutes the moat.')
    api['add_bullet'](doc, '"Monthly board meetings + heavy reporting." — neither of us is full-time '
                            'on RentalFlow yet. Heavy investor management starves customer time.')

    api['add_h2'](doc, '9.6  What happens next')

    api['add_numbered'](doc, 'If this brief interested you, schedule a 30-min conversation with '
                              'Ludmila + Henry. Async-friendly.')
    api['add_numbered'](doc, 'We share the comprehensive Technical Audit (the parent document this '
                              'brief was derived from) for due diligence.')
    api['add_numbered'](doc, 'We share tenant pipeline detail (specific tenant names + stages) under '
                              'NDA. Public-facing materials do not name early tenants.')
    api['add_numbered'](doc, 'If we mutually agree to move forward, we structure a SAFE or '
                              'convertible note at a valuation we discuss directly.')
    api['add_numbered'](doc, 'Quarterly update cadence after close. We do not hide anything from '
                              'investors; we also do not over-communicate.')

    api['add_h2'](doc, '9.7  Contact')

    api['add_kv_table'](doc,
        ['Who', 'What for', 'How'],
        [
            ('Ludmila',
             'Customer relationships, product priorities, sales',
             'ludmilayhenry@gmail.com'),
            ('Henry',
             'Architecture, due diligence, technical questions',
             'ludmilayhenry@gmail.com'),
        ],
        col_widths=[1.5, 3.0, 2.6])

    api['add_h2'](doc, '9.8  Closing note')

    api['add_callout'](doc, 'quote',
        '"We built this with $0 raised because we wanted to know if it would work before asking '
        'someone to bet on it. It works. Now we are looking for one partner who wants to see how '
        'far it can go."')

    api['add_p'](doc,
        'Thank you for reading. The full Technical Audit (parent document) is available on '
        'request and goes 200+ pages deep into the platform itself. The Client Guide (a '
        'companion document for operators considering RentalFlow) is available if you want to '
        'see the buyer-facing pitch.')

    api['add_p'](doc, '— Ludmila & Henry', italic=True, color=P['GRAY'])
