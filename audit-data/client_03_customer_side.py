"""Client 3 — Your customers' experience."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 3, "Your Customers' Experience",
        'From "I want to rent a bounce house" to "Thanks, see you next year." End-to-end.',
        audience_tags=['Rental Owner'])

    api['add_h2'](doc, "3.1  How a new customer finds you")

    api['add_p'](doc,
        'A new customer types something like "bounce house rental near me" into Google. They '
        'land on your branded website (yourcompany.com). They see your photos. They tap '
        '"Book now" on a product they like.')

    api['add_p'](doc,
        'Or — they\'re on Facebook and they click an ad. Or they\'re on a friend\'s referral '
        'link. Either way, they arrive at your storefront. The store is fast, mobile-friendly, '
        'and the booking button is unmissable.')

    api['add_h2'](doc, "3.2  The 5-step booking wizard")

    api['add_p'](doc,
        'Once they tap "Book now," they go through 5 steps. The whole thing takes 2-3 minutes '
        'on a phone.')

    api['add_kv_table'](doc,
        ['Step', 'What customer does', 'What we handle for you'],
        [
            ('1. Date',
             'Pick a date (or date range for multi-day)',
             'We check your inventory. Days when the product is fully booked are dimmed out — '
             'no double-booking surprises.'),
            ('2. Product',
             'Confirm or change product',
             'Pulled from the catalog you built in the admin.'),
            ('3. Add-ons',
             'Pick chairs, tables, power supply, damage protection',
             'Pricing math automatic — including weekend rates and multi-day surcharges.'),
            ('4. Info',
             'Name, email, phone, delivery address',
             'Returning customers auto-fill from their last booking. Optional waiver e-signature. '
             'Optional certificate of insurance request.'),
            ('5. Pay',
             'Credit card, Apple Pay, Google Pay, Link',
             'Stripe collects. Money goes to your bank in ~2 days. You get an email + SMS '
             'notification immediately.'),
        ],
        col_widths=[1.0, 2.6, 3.5])

    api['add_callout'](doc, 'good',
        'After payment, customer sees a confirmation screen with booking ID + date + product + '
        'total. They also get a confirmation email + SMS within 30 seconds.')

    api['add_h2'](doc, "3.3  What happens next (automated)")

    api['add_p'](doc,
        'You don\'t lift a finger for any of this. It all happens on a schedule:')

    api['add_kv_table'](doc,
        ['When', 'What happens'],
        [
            ('30 seconds after payment',
             'Confirmation email + SMS sent to customer. Booking appears in your dashboard. '
             'Customer info pushed to your GHL (if connected).'),
            ('3 days before event',
             'Reminder email + SMS sent automatically with date, time, address.'),
            ('Day of event',
             'You assign the booking to a driver route. Driver sees it on their phone app.'),
            ('Day of delivery',
             'Driver navigates, marks delivered, snaps proof photos. Customer sees status in their portal.'),
            ('1 day after event',
             'Review request email + SMS sent. Includes link to your Google review page.'),
            ('90 days after event',
             'Re-engagement email: "ready to book again?"'),
            ('1 year after first booking',
             'Anniversary email with a small loyalty discount.'),
        ],
        col_widths=[1.7, 5.4])

    api['add_callout'](doc, 'value',
        'These emails + SMS are templates you customize once in /admin/email-templates. After '
        'that, the lifecycle runs forever. The cron jobs fire at the right time. You can also '
        'turn any of these off.')

    api['add_h2'](doc, "3.4  Returning customers")

    api['add_p'](doc,
        'After a customer\'s first booking, they\'re in your database forever. The next time '
        'they want to book:')

    api['add_bullet'](doc, [
        ('They go straight to the booking wizard. ', False),
        ('Their info auto-fills.', True),
        (' Two taps and they\'re done.', False),
    ])
    api['add_bullet'](doc, [
        ('They log into the portal ', True),
        ('(no password — 6-digit code via email). They see all past bookings, loyalty points, '
         'their referral code.', False),
    ])
    api['add_bullet'](doc, [
        ('They earn loyalty points ', True),
        ('on every dollar spent. Configurable rate. They redeem at checkout.', False),
    ])
    api['add_bullet'](doc, [
        ('They share their referral code ', True),
        ('with friends. When friends book using their code, the referrer earns commission. '
         'W-9 collection + payout flow built in.', False),
    ])

    api['add_h2'](doc, "3.5  The customer portal")

    api['add_data_sheet'](doc,
        title='What your customer sees when they log in',
        subtitle='No more "can you check on my booking?" calls.',
        fields=[
            ('Welcome',
             'First name + total bookings + next event date'),
            ('Recent bookings',
             'Last 3 bookings with status. Tap → full detail.'),
            ('Booking detail',
             'Address, time, products, total. Reschedule button (within your cutoff window). '
             'Extend rental button. Internal message thread (they can chat with your team).'),
            ('Points',
             'Current balance + redemption rate + transaction history'),
            ('Referrals',
             'Their code + share link. Who they referred + commission earned. Payout request '
             'button (with W-9 upload).'),
            ('Profile',
             'Edit name, phone, address. Auto-fills future bookings.'),
        ])

    api['add_h2'](doc, "3.6  What the customer never has to do")

    api['add_callout'](doc, 'good',
        'Most of your customer-service calls go away because:')

    api['add_bullet'](doc, '"What\'s my delivery window?" → in the confirmation email + SMS + portal.')
    api['add_bullet'](doc, '"When are you bringing my order?" → 3-day reminder email + SMS + portal.')
    api['add_bullet'](doc, '"Can I reschedule?" → portal button (within your configured cutoff).')
    api['add_bullet'](doc, '"How many points do I have?" → portal points page.')
    api['add_bullet'](doc, '"What\'s my referral code?" → portal referrals page.')
    api['add_bullet'](doc, '"Can I see my past bookings?" → portal bookings list.')
    api['add_bullet'](doc, '"Can I extend my rental?" → portal extend button.')

    api['add_p'](doc,
        'You stop being the call center. Customer service goes from "8-10 calls a day" to '
        '"the genuine emergencies." Every owner who switches to RentalFlow says this is the '
        'biggest week-1 win.')
