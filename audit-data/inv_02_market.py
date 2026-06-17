"""Investor 2 — The Market. Why rental software is overpriced and underpowered."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 2, 'The Market',
        'Rental software is overpriced, underpowered, and openly hated by operators. That gap is the opportunity.',
        audience_tags=['Angel', 'Pre-Seed'])

    api['add_h2'](doc, '2.1  The category')

    api['add_p'](doc,
        'There is a real, recurring-revenue business in "software that runs a rental business." '
        'It spans party rentals (inflatables, tables, tents), equipment rentals (construction, tools, '
        'audio/visual), vehicle rentals, and adjacent service businesses. RentalFlow\'s initial wedge '
        'is the inflatable / party-rental segment — well-defined operators, clear job-to-be-done, and '
        'a known group of incumbents to displace.')

    api['add_h2'](doc, '2.2  The incumbents')

    api['add_kv_table'](doc,
        ['Vendor', 'Pricing', 'Reality'],
        [
            ('Booqable',
             '$29 - $179/mo + transaction fees',
             'Decent catalog UX. Weak dispatch + driver tooling. No customer portal worth using.'),
            ('Goodshuffle Pro',
             '$59 - $109/seat/mo',
             'Strong for party/event rental ops. Per-seat pricing punishes small teams.'),
            ('Rentle',
             '$54 - $269/mo + 0.5-2.5% per booking',
             'Beautiful UI. Per-booking commission disliked by mid-size operators.'),
            ('Inflatable Office',
             '$100-300+/mo',
             'Dominates inflatables but UX is 2008-era. Operators stay out of inertia.'),
            ('Spreadsheets + DIY',
             'Free',
             'Surprisingly common at $100k-500k revenue tier. Pain at $500k+.'),
        ],
        col_widths=[1.8, 2.0, 3.3])

    api['add_callout'](doc, 'fact',
        'There is NO incumbent that bundles website + booking + payments + dispatch + customer '
        'portal + driver app + email/SMS + loyalty + AI assistant for one flat price. The "all-in-one" '
        'positioning is white space — and the existing player closest to it (Goodshuffle) prices per '
        'seat, which kicks operators back to Frankenstein stacks.')

    api['add_h2'](doc, '2.3  The Frankenstein stack RentalFlow replaces')

    api['add_p'](doc,
        'Talk to almost any inflatable-rental operator below $1M revenue. Their current stack:')

    api['add_kv_table'](doc,
        ['What they use today', 'Cost', 'Pain'],
        [
            ('Squarespace / Wix for the website', '$20-40/mo', 'Booking is bolted on. Doesn\'t talk to payments.'),
            ('Calendly or third-party booking',  '$15-30/mo', 'Manual confirm. No inventory awareness.'),
            ('Stripe / Square for payments',      '2.9% + 30¢', 'Disconnected from booking — manual reconciliation.'),
            ('Mailchimp for emails',              '$15-30/mo', 'Manual export of customer list. Stale lists.'),
            ('GoHighLevel for SMS + automation', '$97/mo',     'Steep learning curve. Templates require maintenance.'),
            ('Google Sheets for dispatch',        'Free',       'Drivers see the wrong sheet. Mistakes compound.'),
            ('FrontApp / Help Scout for inbox',  '$19+/seat',  'Per-seat pricing. Disconnected from bookings.'),
            ('Bookkeeper / QuickBooks',           '$60+/mo',    'Year-end pain. No mid-year P&L visibility.'),
        ],
        col_widths=[2.7, 0.9, 3.5])

    api['add_callout'](doc, 'value',
        'Total Frankenstein cost: $250-400+/month, plus the 5-10 hours/week the owner spends '
        'gluing it together manually. RentalFlow replaces this for $99/month flat. The pitch '
        'writes itself.')

    api['add_h2'](doc, '2.4  How big')

    api['add_p'](doc,
        'Rather than handwave a TAM number, let\'s anchor in real ratios:')

    api['add_bullet'](doc, [
        ('U.S. inflatable / party rental operators: ', False),
        ('estimated 5,000-8,000 active businesses', True),
        (' (industry association data + Google Places density check). Revenue ranges from '
         '$50k (side-hustle) to $5M+ (multi-location regional).', False),
    ])
    api['add_bullet'](doc, [
        ('Equipment rental + adjacent (tents, tools, A/V): another ', False),
        ('20,000-50,000 small operators', True),
        (' fit the same product shape and pricing tolerance.', False),
    ])
    api['add_bullet'](doc, [
        ('At $99/mo, 1,000 paying customers = ', True),
        ('$99k MRR = ~$1.2M ARR. ', True),
        ('At 5,000 customers = $6M ARR. The math works at small percentages of the addressable count.', False),
    ])

    api['add_callout'](doc, 'info',
        'The bottoms-up math is the honest math. "$X billion TAM" doesn\'t pay bills. 1,000 '
        'paying customers does. RentalFlow needs to win a small fraction of the addressable '
        'market to become a respectable lifestyle business; a meaningful fraction to become a '
        '$10M+ ARR business.')

    api['add_h2'](doc, '2.5  Why operators switch')

    api['add_p'](doc, 'When asked "what would make you change software?" — the consistent answers:')

    api['add_bullet'](doc, '"Stop charging me per booking — I\'m already paying you a subscription."')
    api['add_bullet'](doc, '"Give my drivers a real mobile app, not a glorified URL bookmark."')
    api['add_bullet'](doc, '"Let my customers see their own bookings without calling me."')
    api['add_bullet'](doc, '"Send the confirmation emails. Send the reminders. Send the review requests. '
                            'I don\'t want to set up Mailchimp."')
    api['add_bullet'](doc, '"Tell me what made money last month without me opening a spreadsheet."')

    api['add_callout'](doc, 'good',
        'Every single one of these is shipped in RentalFlow today. Not coming soon. Not on the '
        'roadmap. Shipped. The customer portal, driver PWA, automated email/SMS lifecycle, '
        '/admin/reports with P&L — all live. See Chapters 3 (Product) and 5 (Traction).')

    api['add_h2'](doc, '2.6  The wedge — why inflatables first')

    api['add_p'](doc,
        'IAF (Ludmila + Henry\'s flagship) is an inflatable rental business. Henry built the platform '
        'to scratch IAF\'s own itch. That means:')

    api['add_bullet'](doc, '✓ Product-market fit is proven in segment 1 — IAF runs on it daily.')
    api['add_bullet'](doc, '✓ Every feature is dog-food tested by an operator who depends on it.')
    api['add_bullet'](doc, '✓ The vocabulary, the workflows, the pain points — all from inside the segment.')

    api['add_p'](doc,
        'Adjacent segments (equipment, tents, party supplies, tools) need 10-20% feature tweaks. '
        'Most of the architecture (multi-tenant, dispatch, drivers, portal) is segment-agnostic.')

    api['add_callout'](doc, 'quote',
        '"We didn\'t build this for the market. We built it for ourselves and found out it was '
        'a market." — that\'s the right founding story for B2B vertical SaaS.')
