"""Client 1 — Why RentalFlow exists."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 1, 'Why This Exists',
        "Written by someone who runs a rental business. For people who run rental businesses.",
        audience_tags=['Rental Owner'])

    api['add_callout'](doc, 'quote',
        '"I started a bounce-house rental business in Jacksonville. Within a year I was using '
        'six different tools — Squarespace, Calendly, Stripe, Mailchimp, GoHighLevel, Google '
        'Sheets — and they didn\'t talk to each other. I was the integration. So we built '
        'RentalFlow."   — Ludmila, founder of It\'s Always Fun')

    api['add_h2'](doc, "1.1  The problem you probably have right now")

    api['add_p'](doc,
        'If you\'re reading this, your rental business is probably running on a Frankenstein '
        'stack. You\'ve got a website built somewhere. A booking calendar somewhere else. '
        'Stripe or Square handling payments. A spreadsheet for the schedule. Maybe a printed '
        'sheet for the drivers. Maybe an email tool — or maybe you\'re just hitting "send" '
        'manually for confirmation emails.')

    api['add_p'](doc,
        'It works. You\'re making money. But every Friday afternoon you find yourself doing the '
        'same five things by hand:')

    api['add_bullet'](doc, 'Cross-checking the booking calendar against the deposits in Stripe')
    api['add_bullet'](doc, 'Re-typing each weekend\'s addresses into the route sheet for the drivers')
    api['add_bullet'](doc, 'Hand-sending confirmation emails to customers who booked late')
    api['add_bullet'](doc, 'Texting customers their delivery window because the system doesn\'t do it')
    api['add_bullet'](doc, 'Hoping the driver remembers to take photos at delivery for damage protection')

    api['add_callout'](doc, 'fact',
        'If you\'re reading this and nodding, you are exactly who RentalFlow was built for.')

    api['add_h2'](doc, "1.2  The promise")

    api['add_p'](doc,
        'One platform. One bill. Replace six tools. Get back five hours every week. '
        '$99 a month, flat. No per-booking fee. No commission. No surprise charges.')

    api['add_stats_strip'](doc, [
        ('$99', 'flat /mo',       P['NAVY']),
        ('0%',  'per-booking',    P['GREEN']),
        ('6+',  'tools replaced', P['BLUE']),
        ('5+',  'hours/wk back',  P['TEAL']),
    ])

    api['add_p'](doc,
        'That\'s it. That\'s the offer. The rest of this guide walks you through what you '
        'actually get, what it replaces, and what onboarding looks like.')

    api['add_h2'](doc, "1.3  Why you can trust this")

    api['add_p'](doc,
        'I run a real rental business. It\'s called It\'s Always Fun (itsalwaysfun.com). It '
        'rents inflatables in Jacksonville. Every day, customers book on it. Every day, my '
        'husband and I dispatch drivers, run the calendar, send invoices, handle payments. '
        'Every feature in RentalFlow exists because IAF needed it FIRST.')

    api['add_callout'](doc, 'good',
        'When you buy RentalFlow, you\'re not buying a demo. You\'re buying the same platform '
        'IAF runs on. The same software. The same dispatch app. The same customer portal. '
        'If a feature doesn\'t work, IAF\'s drivers can\'t deliver. We have skin in the game.')

    api['add_h2'](doc, "1.4  How to read this guide")

    api['add_kv_table'](doc,
        ['Chapter', "What it answers"],
        [
            ('2 — Everything you get',     '"What\'s included for $99?"'),
            ('3 — Your customers',         '"What do my customers actually see?"'),
            ('4 — Your office',            '"How do I run the day-to-day?"'),
            ('5 — Payments',               '"How do I get paid?"'),
            ('6 — Marketing',              '"How do I get + keep customers?"'),
            ('7 — What it replaces',       '"What can I stop paying for?"'),
            ('8 — Pricing',                '"$99... and?"'),
            ('9 — Get started',            '"What does the first 14 days look like?"'),
        ],
        col_widths=[2.0, 5.1])

    api['add_p'](doc,
        'No tech talk. No "platform architecture diagrams." Just what you get and how to use it.')

    api['add_callout'](doc, 'value',
        'If at any point this guide feels too long, jump to Chapter 8 (Pricing) and Chapter 9 '
        '(Get started). That\'s the practical "what does this cost and how do I try it" page.')
