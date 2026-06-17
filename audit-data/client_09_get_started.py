"""Client 9 — Getting started. The first 14 days."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 9, 'Getting Started',
        'What the first 14 days look like. From signup to taking real bookings.',
        audience_tags=['Rental Owner'])

    api['add_callout'](doc, 'quote',
        '"Most operators are taking real bookings on RentalFlow within 3-5 days of signing up. '
        'Not a demo — real Stripe payments hitting their bank account."')

    api['add_h2'](doc, "9.1  Day 0 — Sign up")

    api['add_numbered'](doc, 'Go to getrentalflow.com → click "Start free trial"')
    api['add_numbered'](doc, 'Enter your business name, email, password')
    api['add_numbered'](doc, 'Pick a subdomain (e.g. yourcompany.getrentalflow.com — free)')
    api['add_numbered'](doc, 'You\'re in. /admin/dashboard loads. Welcome.')

    api['add_callout'](doc, 'good',
        'No credit card. 14 days free. You\'re ready to start in under 5 minutes.')

    api['add_h2'](doc, "9.2  Day 1 — Set up your basics")

    api['add_p'](doc, 'The /admin/onboarding wizard walks you through the essentials. ~30 minutes:')

    api['add_kv_table'](doc,
        ['Step', 'What you do', 'Time'],
        [
            ('Branding',
             'Upload your logo, pick accent color, add hero image',
             '5 min'),
            ('Business info',
             'Phone, email, hours, service area, address',
             '5 min'),
            ('Stripe Connect',
             'Connect your Stripe (or create one if you don\'t have it)',
             '10 min'),
            ('First product',
             'Add your most-rented item: name, photo, price, stock',
             '5 min'),
            ('First settings check',
             'Tax rate, lead time hours, time zone',
             '5 min'),
        ],
        col_widths=[2.0, 4.0, 1.1])

    api['add_callout'](doc, 'info',
        'By end of Day 1, you can take a booking. Your customer-facing site is live at '
        'yourcompany.getrentalflow.com. The booking flow works. Stripe is connected.')

    api['add_h2'](doc, "9.3  Days 2-4 — Build out your catalog")

    api['add_p'](doc, 'Spend a few hours over a couple of days adding the rest of your catalog:')

    api['add_bullet'](doc, 'All your rental products — photos, descriptions, prices, stock')
    api['add_bullet'](doc, 'Categories (Inflatables, Tables, Chairs, Power Equipment, etc.)')
    api['add_bullet'](doc, 'Add-ons (chairs, tables, generators, etc.)')
    api['add_bullet'](doc, 'Packages (curated bundles with discount)')
    api['add_bullet'](doc, 'Gift card setup (turn on if you want to sell them)')
    api['add_bullet'](doc, 'Damage protection setup (optional — but recommended for inflatables)')

    api['add_callout'](doc, 'good',
        'Already have your catalog in a spreadsheet? Use /admin/bulk-upload — paste CSV and '
        'import in bulk. The CSV template is downloadable from the same page.')

    api['add_h2'](doc, "9.4  Days 5-7 — Migrate customers + invite team")

    api['add_kv_table'](doc,
        ['Task', 'How'],
        [
            ('Import existing customers',
             '/admin/customers/bulk-import — upload CSV with name, email, phone. We send them '
             'an "account created" welcome email so they can claim their portal access.'),
            ('Invite staff',
             '/admin/users — add each team member by email + role (admin/staff/driver). They get '
             'an invitation email.'),
            ('Set up drivers + W-9',
             'Same — invite as driver role. Have them upload W-9 in their profile if they\'re '
             'getting 1099s.'),
            ('Add vehicles + trailers',
             '/admin/fleet — register your vehicles + trailers + driver assignments.'),
            ('Set up email templates',
             '/admin/email-templates — review the 7 lifecycle templates. Most operators use them '
             'as-is. Customize if you want a different voice.'),
        ],
        col_widths=[2.0, 5.1])

    api['add_h2'](doc, "9.5  Days 8-14 — Live mode + grow")

    api['add_p'](doc, 'By day 8, you\'re running real operations:')

    api['add_bullet'](doc, 'Customers book on your site → confirmations + reminders auto-fire')
    api['add_bullet'](doc, 'Drivers see today\'s route on their PWA → mark stops delivered')
    api['add_bullet'](doc, 'You watch the dashboard — bookings, payments, damages, quotes')
    api['add_bullet'](doc, 'Returning customers get loyalty points + referral codes')

    api['add_p'](doc, 'Days 9-14 are also when you make growth decisions:')

    api['add_bullet'](doc, 'Connect Google Business so reviews sync to your /reviews page')
    api['add_bullet'](doc, 'Set up your first email campaign — welcome existing customers to the new system')
    api['add_bullet'](doc, 'Configure loyalty rate + referral commission')
    api['add_bullet'](doc, 'Optionally connect GHL if you use it for outbound')

    api['add_h2'](doc, "9.6  After day 14")

    api['add_p'](doc,
        'You\'ll have made the decision to continue ($99/mo) or cancel. Most operators continue. '
        'A few choose to cancel because the business is too small or too complex (very large '
        'multi-location chains, mostly). That\'s fine.')

    api['add_callout'](doc, 'info',
        'If you cancel, your data is yours — we export everything to CSV before deleting the '
        'account. No 30-day "we already have your stuff" hostage games.')

    api['add_h2'](doc, "9.7  What we do during your onboarding")

    api['add_p'](doc, 'You\'re not alone. During your trial + first 30 days:')

    api['add_bullet'](doc, [
        ('30-minute kickoff call ', True),
        ('with Ludmila — walk through your specific business, answer questions, set up Stripe '
         'Connect together if you want hand-holding.', False),
    ])
    api['add_bullet'](doc, [
        ('Email + chat support ', True),
        ('— typically replied within hours during business hours.', False),
    ])
    api['add_bullet'](doc, [
        ('Migration assistance ', True),
        ('— if you have a complex existing catalog, we help you map it to RentalFlow\'s '
         'structure.', False),
    ])
    api['add_bullet'](doc, [
        ('Domain setup help ', True),
        ('— if you want to use your own domain (yourcompany.com), we walk you through DNS '
         'records or do it for you.', False),
    ])

    api['add_callout'](doc, 'good',
        'You\'re also welcome to call. Real phone. Real owner answers.')

    api['add_h2'](doc, "9.8  Common questions")

    api['add_kv_table'](doc,
        ['Question', 'Answer'],
        [
            ('Can I use my own domain (mybiz.com)?',
             'Yes. You point DNS to us. About 24 hours to propagate. We help.'),
            ('Will I lose my old website during the transition?',
             'No. Keep it up until you\'re comfortable. Switch DNS when ready.'),
            ('Can I keep my Stripe account?',
             'Yes. RentalFlow uses Stripe Connect. Your existing account works.'),
            ('What if I don\'t like it after 14 days?',
             'Cancel. No fee. Export all your data to CSV. We delete the account.'),
            ('Do you offer custom features?',
             'For larger tenants, yes. Talk to us about your specific need.'),
            ('Will I have to learn complicated software?',
             'No. The interface is designed for rental owners, not techies. Most operators are '
             'comfortable within a week.'),
            ('Will my customers have to do anything different?',
             'Just book on the new site instead of the old. Returning customers get a "claim '
             'your account" email so their history shows up in the portal.'),
            ('Can I export my data?',
             'Anytime. /admin/export → pick the entity → CSV download.'),
        ],
        col_widths=[2.6, 4.5])

    api['add_h2'](doc, "9.9  Ready?")

    api['add_callout'](doc, 'value',
        'Three ways to start:')

    api['add_bullet'](doc, [
        ('1. Sign up directly: ', True),
        ('getrentalflow.com/signup — full trial in 5 minutes.', False),
    ])
    api['add_bullet'](doc, [
        ('2. Book a demo with Ludmila: ', True),
        ('email ludmilayhenry@gmail.com — we\'ll do a 30-minute walkthrough of your specific '
         'situation.', False),
    ])
    api['add_bullet'](doc, [
        ('3. Try IAF\'s live site first: ', True),
        ('itsalwaysfun.com — see exactly what your customers will see, before you commit to '
         'building yours.', False),
    ])

    api['add_callout'](doc, 'quote',
        '"This is the part where most pitches add urgency. I\'m not going to. RentalFlow will '
        'still be here tomorrow. Take the time you need. When you\'re ready — we are too." '
        '— Ludmila')

    api['add_p'](doc, '— Ludmila & Henry, RentalFlow team', italic=True, color=P['GRAY'])
