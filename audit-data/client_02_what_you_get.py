"""Client 2 — Everything You Get. Single-page summary."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 2, 'Everything You Get',
        'One page. Your whole business, organized.',
        audience_tags=['Rental Owner'])

    api['add_h2'](doc, '2.1  The headline')

    api['add_callout'](doc, 'value',
        'For $99/month flat, you get a complete rental business platform: branded website + '
        'booking + payments + dispatch + driver app + customer portal + email & SMS + loyalty + '
        'reviews + reports + AI assistant. Everything connects. Everything talks to itself.')

    api['add_h2'](doc, '2.2  By area')

    api['add_data_sheet'](doc,
        title='Your storefront',
        subtitle='What customers see online.',
        fields=[
            ('Branded website',
             'Your colors, your logo, your photos. Custom domain (yourcompany.com) or a free '
             'subdomain (yourcompany.getrentalflow.com).'),
            ('Product catalog',
             'Every item you rent — photos, descriptions, prices, calendar. Organized by category.'),
            ('Smart booking wizard',
             '5-step flow: pick date, pick product, add extras, enter info, pay. Customer '
             'finishes in under 3 minutes.'),
            ('Gift card sales',
             'Customers can buy gift cards in any amount. Recipient gets a code instantly.'),
            ('Customer reviews page',
             'Auto-pulled from your Google Business reviews. Or add manually.'),
            ('FAQ + policies + waiver',
             'You write it once. It shows on your website.'),
        ])

    api['add_data_sheet'](doc,
        title='Your office',
        subtitle='How you run the day-to-day.',
        fields=[
            ('Booking dashboard',
             'Today + this week at a glance. Pending payments. Damages. Quotes. Inbox alerts.'),
            ('Live calendar',
             'Visual calendar of every confirmed booking. Drag to reschedule. Color by status.'),
            ('Dispatch + route planner',
             'Drag-and-drop assignment of bookings to vehicles. Stop ordering. Driver assignment.'),
            ('Quote builder',
             'Build a quote, email it to the customer, get accept/decline back. Converts to booking on accept.'),
            ('Inventory tracker',
             'Per-item stock. Per-unit tracking if you want it (BLOWER001, BLOWER002...). Low-stock alerts.'),
            ('Fleet management',
             'Your vehicles + trailers. Compatible inventory per truck. Driver assignment.'),
            ('Reports + P&L',
             'Revenue by week / month / year. Cost margins. Driver expenses. Custom reports.'),
            ('1099-NEC generation',
             'For your drivers + referrers. W-9 collection built in.'),
            ('Customer database',
             'Every customer you\'ve ever served. LTV, total bookings, tags, loyalty points.'),
        ])

    api['add_data_sheet'](doc,
        title='Your team',
        subtitle='What your drivers and staff use.',
        fields=[
            ('Driver mobile app (PWA)',
             'Installable on iPhone + Android. Shows today\'s route. Tap an address → Google Maps.'),
            ('Photo proof at delivery',
             'Driver snaps photos. Stored against the booking. Damage claims become easy.'),
            ('Per-booking team chat',
             'You + drivers + customer service all on one thread per booking. @mention anyone.'),
            ('Inspection checklists',
             'Delivery + pickup checklists per product. Driver fills as they go.'),
            ('Status updates from the field',
             'Driver marks each stop delivered. You see it in real-time on the dashboard.'),
        ])

    api['add_data_sheet'](doc,
        title='Your customers',
        subtitle='Where returning customers go.',
        fields=[
            ('Customer portal',
             'Customers log in (no password — 6-digit code via email). See their bookings, '
             'loyalty points, referral code.'),
            ('Loyalty program',
             'Points per dollar. Customer redeems on next rental. Configurable rate.'),
            ('Referral program',
             'Each customer gets a unique referral code. When their friends book, they earn '
             'commission. W-9 collection + payout request flow built in.'),
            ('Self-serve booking history',
             'No more "can you check on my booking?" phone calls.'),
            ('Reschedule + extend',
             'Customer reschedules within their cutoff window. Customer extends rental days.'),
        ])

    api['add_data_sheet'](doc,
        title='Your marketing',
        subtitle='How customers find you and come back.',
        fields=[
            ('Automated email lifecycle',
             '7 emails fire automatically: confirmation → 3-day reminder → review request → '
             '90-day re-engagement → 1-year anniversary. You set the templates once.'),
            ('SMS at every step',
             'Same lifecycle in SMS. Customer opts in at checkout.'),
            ('Coupons + bulk codes',
             'Discount codes, referral codes, percent / fixed / free overnight types.'),
            ('Email campaigns',
             'Send a campaign to all customers in a tag, or a custom segment. Built-in editor.'),
            ('Google reviews sync',
             'Your Google Business reviews show on your /reviews page automatically.'),
            ('GHL CRM sync',
             'If you use GoHighLevel, every booking + abandoned cart pushes automatically.'),
        ])

    api['add_data_sheet'](doc,
        title='Your money',
        subtitle='How payments work.',
        fields=[
            ('Stripe Connect',
             'Money goes straight from customer to your bank in ~2 days. RentalFlow never holds it.'),
            ('Card, Apple Pay, Google Pay, Link',
             'All built in via Stripe.'),
            ('Refund + dispute handling',
             'One-click refund from the admin. Stripe disputes handled at /admin/settings/payments.'),
            ('Gift card balance + redemption',
             'Customers buy gift cards. Recipients redeem at checkout. Balance tracking automatic.'),
            ('Damage protection',
             'Optional add-on you can charge. Tracked separately for accounting.'),
            ('Booking extensions',
             'Customer extends rental days. Stripe collects the additional charge. You see it on the booking.'),
        ])

    api['add_h2'](doc, '2.3  What is NOT in the $99 (the honest part)')

    api['add_callout'](doc, 'info',
        'Some things cost extra because they\'re passed through from third parties at cost:')

    api['add_bullet'](doc, [
        ('Stripe payment processing: 2.9% + 30¢ per transaction ', True),
        ('— this is Stripe\'s fee, paid by you or your customer (your choice). RentalFlow takes nothing.', False),
    ])
    api['add_bullet'](doc, [
        ('Twilio SMS: ~$0.0079 per text ', True),
        ('— Twilio\'s rate, billed to you separately. We can also turn SMS off if you prefer email-only.', False),
    ])
    api['add_bullet'](doc, [
        ('Custom domain: ~$15/year ', True),
        ('— pay your domain registrar (GoDaddy, Namecheap, etc.) directly. Or use the free subdomain.', False),
    ])

    api['add_h2'](doc, '2.4  What is INCLUDED that you might think costs extra')

    api['add_callout'](doc, 'good',
        'These are commonly upcharged by other rental platforms — included with RentalFlow:')

    api['add_bullet'](doc, 'Customer portal with loyalty + referrals')
    api['add_bullet'](doc, 'Driver mobile app for your whole team')
    api['add_bullet'](doc, 'Per-booking photo + e-signature capture')
    api['add_bullet'](doc, 'Email + SMS lifecycle (no Mailchimp needed)')
    api['add_bullet'](doc, 'Automated review requests')
    api['add_bullet'](doc, 'Custom reports + P&L')
    api['add_bullet'](doc, '1099-NEC generation for drivers + referrers')
    api['add_bullet'](doc, 'AI admin assistant ("how much did I make last week?")')
    api['add_bullet'](doc, 'Multiple staff users at no extra cost (no per-seat pricing)')
