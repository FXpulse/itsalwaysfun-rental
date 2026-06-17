"""Client 8 — Pricing and what it means."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 8, 'Pricing — and What It Means',
        "$99 flat. No per-booking. No upsells. No tiers. Here\'s exactly what that buys.",
        audience_tags=['Rental Owner'])

    api['add_h2'](doc, "8.1  The price")

    api['add_callout'](doc, 'value',
        '$99 per month. Flat. That\'s it. No matter how many bookings you take, how many '
        'staff you have, how many add-ons you offer, or how much revenue you do. The same $99.')

    api['add_stats_strip'](doc, [
        ('$99', 'monthly', P['NAVY']),
        ('$0',  'per booking', P['GREEN']),
        ('$0',  'per staff seat', P['BLUE']),
        ('$0',  'per integration', P['TEAL']),
    ])

    api['add_h2'](doc, "8.2  What's included for $99")

    api['add_p'](doc, 'Everything. No tier games. Specifically:')

    api['add_kv_table'](doc,
        ['Feature', 'Included?'],
        [
            ('Branded website + custom domain support',           'Yes'),
            ('Full product catalog',                              'Yes'),
            ('5-step booking wizard',                             'Yes'),
            ('Stripe Connect (you connect your account)',         'Yes'),
            ('Apple Pay, Google Pay, Link, card support',         'Yes'),
            ('Customer portal (loyalty, referrals, history)',     'Yes'),
            ('Driver mobile app (PWA)',                           'Yes'),
            ('Photo proof + e-signature at delivery',             'Yes'),
            ('Per-booking team chat',                             'Yes'),
            ('Inspection checklists',                             'Yes'),
            ('Dispatch + route planner',                          'Yes'),
            ('Live calendar',                                     'Yes'),
            ('Quote builder + send + accept flow',                'Yes'),
            ('Inventory tracker (per-item + per-unit)',           'Yes'),
            ('Fleet management (vehicles + trailers)',            'Yes'),
            ('Email lifecycle (7 templates, customizable)',       'Yes'),
            ('SMS lifecycle (10DLC compliant)',                   'Yes'),
            ('Email campaigns (one-off blasts)',                  'Yes'),
            ('Loyalty program',                                   'Yes'),
            ('Referral program (W-9 + payout)',                   'Yes'),
            ('Google reviews sync',                               'Yes'),
            ('Gift card sales',                                   'Yes'),
            ('Coupons + bulk-assign + referrer attribution',      'Yes'),
            ('Damage protection (charge customers, track claims)','Yes'),
            ('Custom reports + P&L',                              'Yes'),
            ('1099-NEC generation',                               'Yes'),
            ('CRM sync to GHL (if you use it)',                   'Yes'),
            ('AI admin assistant (Claude)',                        'Yes'),
            ('AI public chat widget (OpenAI, optional)',          'Yes'),
            ('Audit log of every admin action',                   'Yes'),
            ('Unlimited staff users',                             'Yes'),
            ('Unlimited customers',                               'Yes'),
            ('Unlimited bookings',                                'Yes'),
            ('Daily backups',                                     'Yes'),
            ('Email + chat support',                              'Yes'),
        ],
        col_widths=[5.6, 1.5])

    api['add_h2'](doc, "8.3  What costs extra (and why)")

    api['add_p'](doc, 'A few costs are passed through to you at cost — RentalFlow takes no margin:')

    api['add_kv_table'](doc,
        ['Extra cost', 'Rate', 'Why'],
        [
            ('Stripe payment processing',
             '2.9% + 30¢ per transaction',
             'Stripe\'s standard fee. RentalFlow has no claim on this. You can choose to pass '
             'it to customer or absorb it.'),
            ('Twilio SMS',
             '~$0.0079 per text',
             'Twilio\'s rate, billed to you separately. Roughly $5-20/month for typical volume. '
             'Can be turned off if you prefer email-only.'),
            ('Custom domain',
             '~$15/year',
             'You pay your domain registrar (GoDaddy, etc.) directly. Or use the free '
             'yourcompany.getrentalflow.com subdomain at no cost.'),
            ('Google Places API',
             'Negligible (~$0.50/mo)',
             'For pulling your Google reviews daily. Most operators stay in the free tier.'),
        ],
        col_widths=[2.0, 1.7, 3.4])

    api['add_callout'](doc, 'info',
        'Total practical monthly cost: $99 (RentalFlow) + $5-20 (Twilio if you use SMS) = '
        '$104-119. Stripe fees come out of customer payments, not your subscription.')

    api['add_h2'](doc, "8.4  What does NOT cost extra")

    api['add_callout'](doc, 'good',
        'A short list of things that are commonly charged extra by other rental platforms — '
        'NOT charged extra by RentalFlow:')

    api['add_bullet'](doc, '✓ Adding staff users (other platforms: $15-25/seat/month)')
    api['add_bullet'](doc, '✓ Per-booking commission (other platforms: 0.5-3% per booking)')
    api['add_bullet'](doc, '✓ Customer portal access (often a paid add-on)')
    api['add_bullet'](doc, '✓ Driver mobile app (often a paid add-on or separate product)')
    api['add_bullet'](doc, '✓ AI admin assistant (rare or paid add-on)')
    api['add_bullet'](doc, '✓ Custom reports (often a Pro-tier feature)')
    api['add_bullet'](doc, '✓ Branded email (often a Pro-tier feature)')

    api['add_h2'](doc, "8.5  Pricing comparison")

    api['add_kv_table'](doc,
        ['Vendor', 'Monthly', 'Per-booking', 'Per-seat'],
        [
            ('Booqable',             '$29-179',     '0-1.5%',     'Some tiers'),
            ('Goodshuffle Pro',      '$59-109',     'No',         'Yes — $59-109/seat'),
            ('Rentle',               '$54-269',     '0.5-2.5%',   'No'),
            ('Inflatable Office',    '$100-300+',   'No',         'Yes'),
            ('RentalFlow',           '$99 flat',    'No',         'No'),
        ],
        col_widths=[2.0, 1.5, 1.5, 1.6])

    api['add_callout'](doc, 'value',
        'At 100 bookings/month averaging $300 each = $30,000 monthly revenue: '
        'A 1% per-booking competitor charges you $300/month + their subscription. '
        'A 3% competitor charges $900/month + subscription. '
        'RentalFlow charges $99/month. That\'s the difference at scale.')

    api['add_h2'](doc, "8.6  Free trial")

    api['add_p'](doc, '14-day free trial. No credit card required to start. You get the full '
                       'platform, no feature gates. After 14 days you continue at $99/month or '
                       'cancel — no questions, no retention call.')

    api['add_callout'](doc, 'good',
        'During the trial you can: build your full catalog, import customers from a CSV, take '
        'real bookings via Stripe Connect, send real customer emails, dispatch real routes. It '
        'is a full operating trial — not a feature demo.')

    api['add_h2'](doc, "8.7  Annual + lifetime")

    api['add_p'](doc, 'Two long-term commit options:')

    api['add_kv_table'](doc,
        ['Plan', 'Cost', 'Equivalent'],
        [
            ('Monthly', '$99/mo',           '$1,188/year'),
            ('Annual',  '$990/year (2 months free)', '$82.50/mo equivalent'),
            ('Pause',   'Free — keep data, suspend access', 'For seasonal businesses (e.g. summer-only operators)'),
        ],
        col_widths=[1.6, 2.5, 3.0])

    api['add_callout'](doc, 'info',
        'Pause is genuinely free. Seasonal operators (summer-only) appreciate this — you keep '
        'your data, catalog, customer history, all of it. When you resume in spring, your '
        'business is exactly where you left it.')

    api['add_h2'](doc, "8.8  No surprises")

    api['add_p'](doc, 'Things that are NOT in the pricing:')

    api['add_bullet'](doc, '✗ Setup fee — none')
    api['add_bullet'](doc, '✗ Onboarding fee — none')
    api['add_bullet'](doc, '✗ Migration fee — none (we help you import customers + products free)')
    api['add_bullet'](doc, '✗ Cancellation fee — none (cancel anytime, mid-month, refund prorated)')
    api['add_bullet'](doc, '✗ Long-term contract — none required')
    api['add_bullet'](doc, '✗ "Upgrade for SMS" tier — SMS is included')
    api['add_bullet'](doc, '✗ "Pro tier for unlimited bookings" — unlimited bookings at $99')
    api['add_bullet'](doc, '✗ "Add-on for driver app" — driver app is included')

    api['add_callout'](doc, 'quote',
        '"$99. Flat. Everything. Forever." We say it because we mean it. The pricing page on '
        'getrentalflow.com is one line because there\'s nothing else to explain.')
