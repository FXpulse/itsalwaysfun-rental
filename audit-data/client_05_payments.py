"""Client 5 — Payments. How money flows from customer to your bank."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 5, 'How You Get Paid',
        'Stripe Connect. Money lands in your bank in about 2 days. RentalFlow never touches it.',
        audience_tags=['Rental Owner'])

    api['add_callout'](doc, 'quote',
        '"The first thing operators ask me: \'wait, does the money go through you?\' No. It\'s '
        'your money. Stripe sends it to YOUR bank account. RentalFlow has no claim on it."')

    api['add_h2'](doc, "5.1  How Stripe Connect works")

    api['add_p'](doc,
        'During onboarding, you create a Stripe Connect account. It takes about 15 minutes — '
        'Stripe verifies your business (SSN/EIN, bank account, basic identity). After that:')

    api['add_kv_table'](doc,
        ['Step', 'What happens'],
        [
            ('Customer pays via the booking wizard',
             'Card / Apple Pay / Google Pay / Link.'),
            ('Stripe collects the payment',
             'Customer\'s card is charged.'),
            ('Stripe routes to YOUR Connect account',
             'Money is held in your Stripe balance for ~2 days.'),
            ('Stripe deposits to your bank',
             'Daily payout (default) to the bank account you connected. ~2 business days from '
             'payment to bank.'),
            ('Stripe takes its fee',
             '2.9% + 30¢ per transaction. Standard. RentalFlow takes NOTHING.'),
        ],
        col_widths=[2.6, 4.5])

    api['add_callout'](doc, 'value',
        'On a $300 booking: Stripe fee is $9. You net $291. RentalFlow gets $0 from the '
        'transaction. The $99/month subscription is the only money you pay us.')

    api['add_h2'](doc, "5.2  What you can do with payments")

    api['add_data_sheet'](doc,
        title='Payment operations from /admin',
        subtitle='Everything you\'d expect, all in one place.',
        fields=[
            ('Take payment',
             'Customer does it through the booking wizard. You do nothing.'),
            ('Manual payment entry',
             'For phone-call bookings — create the booking manually, mark as paid (cash, check, '
             'Venmo, whatever).'),
            ('Refund (full or partial)',
             'One-click refund from /admin/bookings/[id]. Stripe processes. Customer sees the '
             'refund in 5-10 days.'),
            ('Refund with reason',
             'You note the reason (weather cancel, customer no-show, etc.) — audit log stores it.'),
            ('Dispute handling',
             'If a customer disputes a charge, you see the dispute in /admin/settings/payments. '
             'Upload evidence (delivery photos, signed waiver, communication). Stripe handles '
             'the rest.'),
            ('Booking extensions',
             'Customer asks for more days. You bill the additional via Stripe automatically. '
             'New PaymentIntent generated. Customer pays. Booking updates.'),
            ('Gift card payments',
             'Customers buy gift cards. Recipients redeem at checkout. Balance tracking automatic.'),
        ])

    api['add_h2'](doc, "5.3  Deposits + holds")

    api['add_p'](doc,
        'RentalFlow uses a 15-minute payment hold pattern. When a customer reaches the payment '
        'step:')

    api['add_bullet'](doc, 'A Stripe PaymentIntent is created. Their date + product is locked for 15 minutes.')
    api['add_bullet'](doc, 'If they complete payment within 15 minutes: booking is confirmed, slot is yours.')
    api['add_bullet'](doc, 'If they abandon: the hold expires automatically. The slot reopens for the next customer.')
    api['add_bullet'](doc, 'You see "pending payment" bookings on your dashboard so you know who almost bought.')

    api['add_callout'](doc, 'good',
        'This prevents the "two customers paid for the same Saturday" nightmare. Inventory is '
        'never accidentally over-allocated.')

    api['add_h2'](doc, "5.4  Damage protection (optional revenue stream)")

    api['add_p'](doc,
        'You can offer customers a one-time damage protection add-on at checkout. If you '
        'enable it:')

    api['add_bullet'](doc, 'Set the price in /admin/settings/damage-protection (e.g. $25 flat).')
    api['add_bullet'](doc, 'Customer sees the option at checkout with a brief description.')
    api['add_bullet'](doc, 'If they opt in, $25 is added to the total. Customer is covered for minor damages.')
    api['add_bullet'](doc, 'When damages happen, you mark "covered by protection" in the booking — easier '
                            'accounting at year-end.')

    api['add_callout'](doc, 'value',
        'IAF runs a 30% opt-in rate on damage protection. At $25/opt-in × ~100 bookings/month = '
        '~$750/month of pure-margin revenue. Pays for RentalFlow 7×.')

    api['add_h2'](doc, "5.5  Coupons + discount codes")

    api['add_p'](doc, 'For promotions, referrals, and loyalty:')

    api['add_kv_table'](doc,
        ['Type', 'Example'],
        [
            ('Percent off',
             '"SUMMER10" — 10% off any booking. Set max_uses + expiration.'),
            ('Fixed amount off',
             '"WELCOME25" — $25 off. Useful for first-time customers.'),
            ('Overnight free',
             '"FREEMONDAY" — waives the day-2 surcharge (great for school-year weekday demand).'),
            ('Referrer-attributed',
             'Auto-generated unique codes per referrer. When the referrer\'s friends use the '
             'code, the referrer earns commission.'),
        ],
        col_widths=[1.6, 5.5])

    api['add_h2'](doc, "5.6  Gift cards (another revenue stream)")

    api['add_p'](doc, '/gift-cards is a separate revenue surface on your website:')

    api['add_bullet'](doc, 'Customer picks an amount ($10 - $10,000)')
    api['add_bullet'](doc, 'Customer enters recipient details + optional message + optional delivery date')
    api['add_bullet'](doc, 'Customer pays via Stripe → recipient gets the code via email + SMS')
    api['add_bullet'](doc, 'Recipient redeems at checkout — balance tracked automatically')
    api['add_bullet'](doc, 'Unused balance carries over indefinitely')

    api['add_callout'](doc, 'fact',
        'Gift card sales are pure cash-flow revenue — you collect today, deliver service later. '
        'Many IAF customers buy gift cards for kids\' birthdays + holiday gifts. ~$200-500 extra '
        'revenue per month with zero marketing.')

    api['add_h2'](doc, "5.7  Reporting on the money")

    api['add_p'](doc, 'From /admin/reports:')

    api['add_bullet'](doc, 'See revenue + refunds + net by day / week / month / year')
    api['add_bullet'](doc, 'See gross margin (revenue − product cost − expenses)')
    api['add_bullet'](doc, 'See cash flow projection (upcoming bookings × expected revenue)')
    api['add_bullet'](doc, 'Export to CSV for your bookkeeper or QuickBooks')
    api['add_bullet'](doc, 'Generate 1099-NEC forms at year-end for drivers + referrers (W-9 collection automatic)')

    api['add_callout'](doc, 'good',
        'Year-end accounting goes from "panic for 2 weeks in January" to "export 3 CSVs, hand '
        'to bookkeeper, done in an hour." Many operators say this single change saves them '
        '$500-1,000 in accounting fees annually.')

    api['add_h2'](doc, "5.8  What you don't need anymore")

    api['add_callout'](doc, 'value',
        'On the payments side, RentalFlow replaces / removes the need for:')

    api['add_bullet'](doc, [('Standalone Square or Stripe account ', True), ('(you keep Stripe — but it\'s integrated, not separate)', False)])
    api['add_bullet'](doc, [('Manual reconciliation between bookings and payments', True)])
    api['add_bullet'](doc, [('Refund tracking in a spreadsheet', True)])
    api['add_bullet'](doc, [('Gift card software (specialized POS-attached gift card systems often charge $30-100/month)', True)])
    api['add_bullet'](doc, [('Discount code tracking in a sheet', True)])
    api['add_bullet'](doc, [('Manual 1099 generation at year-end', True)])
