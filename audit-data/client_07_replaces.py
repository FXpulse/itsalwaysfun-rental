"""Client 7 — What you can stop paying for."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 7, 'What You Can Stop Paying For',
        'The 6-8 tools you probably have today — and what each one costs you. RentalFlow replaces all of them for $99.',
        audience_tags=['Rental Owner'])

    api['add_callout'](doc, 'quote',
        '"Before I sat down to write this, I added up what I was paying for tools. $387/month. '
        'I was also losing 5+ hours a week glueing them together. RentalFlow is $99. The math '
        'was easy."')

    api['add_h2'](doc, "7.1  The tools you probably have")

    api['add_kv_table'](doc,
        ['What you pay for today', 'Typical cost', 'What it does'],
        [
            ('Website builder (Squarespace, Wix, Shopify)',
             '$20-40/mo',
             'Hosts your site. Doesn\'t handle bookings well.'),
            ('Booking widget (Booqable, Acuity, Calendly)',
             '$25-100/mo',
             'Calendar + payment. Doesn\'t know your inventory or dispatch.'),
            ('Email marketing (Mailchimp, Constant Contact)',
             '$15-50/mo',
             'Send marketing emails. Manual import of customer list.'),
            ('SMS marketing (GHL, EZ Texting)',
             '$30-100/mo',
             'Send marketing SMS. Compliance work is on you.'),
            ('Inbox / CRM (FrontApp, Help Scout)',
             '$15-25/seat/mo',
             'Customer inbox. Disconnected from bookings.'),
            ('Loyalty / referral software',
             '$30-100/mo',
             'Track points + referral codes. Usually a separate app.'),
            ('Driver dispatch / route sheets',
             '$0 (Google Sheets) - $50',
             'Printed sheets or a basic dispatch tool. Drivers can\'t see status.'),
            ('Bookkeeping software',
             '$30-60/mo',
             'QuickBooks Online or similar.'),
            ('Total typical stack',
             '$200-450/mo',
             ''),
        ],
        col_widths=[2.6, 1.7, 2.8])

    api['add_callout'](doc, 'value',
        'Even at the LOW end ($200/month), RentalFlow at $99/month saves you $100+/month. '
        'At the typical mid-range ($300-400), savings are $200-300/month. Plus 5+ hours/week '
        'of integration glue work eliminated.')

    api['add_h2'](doc, "7.2  Side-by-side")

    api['add_kv_table'](doc,
        ['Capability', 'Your old stack', 'RentalFlow'],
        [
            ('Branded website',
             'Squarespace ($25/mo)',
             'Included'),
            ('Online booking + payment',
             'Booqable + Stripe ($79/mo + 1% fee)',
             'Included (Stripe at standard 2.9%+30¢)'),
            ('Multi-day pricing rules',
             'Manual in Squarespace',
             'Built-in (Day 1 / Day 2+ / weekend)'),
            ('Real-time inventory check',
             'Calendar shows occupancy, not stock',
             'Stock-aware — no double-bookings'),
            ('Customer email confirmations',
             'Manual or Mailchimp ($25/mo)',
             'Automatic — 7 lifecycle emails'),
            ('SMS confirmations + reminders',
             'GHL ($97/mo) or manual',
             'Automatic — 10DLC compliant'),
            ('Customer portal (login, history)',
             'Not available in most stacks',
             'Included'),
            ('Driver mobile app',
             'Not available — printed sheets',
             'Included (PWA, installable)'),
            ('Dispatch route planning',
             'Google Sheets manually',
             'Drag-and-drop'),
            ('Photo proof at delivery',
             'Drivers text photos to owner',
             'Captured in the app, stored on booking'),
            ('Gift cards',
             'Specialized POS gift card system ($40/mo)',
             'Included'),
            ('Loyalty + referrals',
             'Smile.io ($49+/mo)',
             'Included'),
            ('Reviews aggregation',
             'NiceJob or similar ($75+/mo)',
             'Included (Google sync automatic)'),
            ('Custom reports + P&L',
             'QuickBooks ($35/mo) + manual',
             'Included'),
            ('1099-NEC for drivers',
             'CPA hour by hour at year-end',
             'Generated automatically'),
            ('CRM sync to GHL',
             'Manual export / Zapier ($30/mo)',
             'Built-in'),
            ('Inbox unified across emails',
             'FrontApp ($19/seat/mo)',
             'Included (per tenant inbox + superadmin unified)'),
            ('AI admin assistant',
             'Not available',
             'Included (ask your data in plain English)'),
            ('AI route optimizer',
             'Saturday paper puzzle — 30+ min/week',
             'Included (1-click proposal with reasoning, you approve or adjust)'),
            ('QuickBooks Online export',
             'Manual data entry into QBO',
             'Built-in — Sales Receipts + Customers CSVs match QBO import format'),
            ('Approval sign-off on big bookings',
             'Hoping staff doesn\'t mistake a $5k order',
             'Set a threshold; bookings over it pause for your sign-off. Built-in.'),
            ('Multi-staff access',
             'Per-seat pricing on most tools',
             'Included — unlimited staff users'),
        ],
        col_widths=[2.0, 2.5, 2.6])

    api['add_h2'](doc, "7.3  The hidden cost — integration time")

    api['add_p'](doc,
        'Beyond money, the bigger savings is time. With a Frankenstein stack:')

    api['add_bullet'](doc, 'You manually export customer lists from booking system → Mailchimp')
    api['add_bullet'](doc, 'You manually update SMS templates in 3 different places')
    api['add_bullet'](doc, 'You manually copy delivery addresses into your driver\'s route sheet')
    api['add_bullet'](doc, 'You manually reconcile Stripe payments against your booking list')
    api['add_bullet'](doc, 'You manually email gift card codes to recipients')
    api['add_bullet'](doc, 'You manually generate 1099s at year-end')
    api['add_bullet'](doc, 'You manually merge customer info from 4 places before the bookkeeper takes over')

    api['add_callout'](doc, 'fact',
        'Most owners spend 5-10 hours a week on integration glue. RentalFlow makes most of it '
        'go away. That\'s ~$1,500-3,000/month of your time back at owner wages.')

    api['add_h2'](doc, "7.4  What you DON'T have to stop")

    api['add_p'](doc, 'Some tools are still worth keeping:')

    api['add_bullet'](doc, [
        ('Stripe ', True),
        ('— stays. We integrate with Stripe Connect. You keep your account, the money flows '
         'to your bank.', False),
    ])
    api['add_bullet'](doc, [
        ('Your domain registrar (GoDaddy, Namecheap, etc.) ', True),
        ('— stays. Your domain stays with whoever you bought it from. You just point DNS to us.', False),
    ])
    api['add_bullet'](doc, [
        ('GoHighLevel ', True),
        ('— optional. If you love your GHL workflows, keep them — we sync into them. If you '
         'don\'t use GHL, you don\'t need it.', False),
    ])
    api['add_bullet'](doc, [
        ('QuickBooks ', True),
        ('— optional. Most owners keep QuickBooks for their bookkeeper. We export CSVs that '
         'import cleanly.', False),
    ])
    api['add_bullet'](doc, [
        ('Your phone, Gmail, business credit card ', True),
        ('— stays. We don\'t change how you live. We just remove the tools you don\'t need.', False),
    ])

    api['add_h2'](doc, "7.5  The ROI conversation")

    api['add_callout'](doc, 'value',
        'Operating math: $99 RentalFlow + $20-30 Stripe (you already pay) + $0-15 SMS = $120-145/mo. '
        'Compare to your current $200-450/month + 5-10 hours of glue work. Savings: $80-300/month + '
        'most of a workday weekly. ROI is typically positive in month 1.')

    api['add_p'](doc,
        'Most operators we talk to break even on RentalFlow in the first 2 weeks just by stopping '
        'their existing subscriptions. The time savings compound after that.')
