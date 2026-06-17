"""Client 4 — Your office. How you run the day-to-day."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 4, 'Your Office',
        'The admin panel. Where you spend most of your operating time.',
        audience_tags=['Rental Owner'])

    api['add_callout'](doc, 'value',
        'The admin panel has 81 surfaces. That sounds like a lot. In practice, you live in 5-6 '
        'pages every day. The rest are there when you need them.')

    api['add_h2'](doc, "4.1  The dashboard — your first stop every morning")

    api['add_p'](doc,
        'When you sign in, the dashboard shows the day at a glance:')

    api['add_kv_table'](doc,
        ['What you see', 'Why it matters'],
        [
            ('Today\'s bookings + tomorrow\'s bookings',
             'Quick read on the workload.'),
            ('Pending payments',
             'Anyone who started checkout but didn\'t finish. Follow up if you want.'),
            ('Damages reported (unresolved)',
             'Drivers flagged something. Decide insurance claim or in-house.'),
            ('Quotes in flight',
             'Sent but not yet accepted. Time to follow up?'),
            ('Loyalty payout requests',
             'Customers asking for their referral commission.'),
            ('Inbox alerts',
             'Customer messages that need attention.'),
            ('Today + tomorrow routes',
             'Visual columns. Click a route to open the dispatch view.'),
            ('Recent bookings',
             'Last 5 to remind you what came in today.'),
        ],
        col_widths=[2.6, 4.5])

    api['add_callout'](doc, 'good',
        'Dashboard auto-refreshes every 45 seconds so you don\'t miss new bookings.')

    api['add_h2'](doc, "4.2  Bookings — your daily workflow")

    api['add_p'](doc,
        'Every booking is one row. You can search, filter, sort. Tap a row to open the booking '
        'detail. From there:')

    api['add_bullet'](doc, 'See customer info, address, products, dates, payment status')
    api['add_bullet'](doc, 'Add expenses (gas, payroll, tolls, etc.) for accurate margins')
    api['add_bullet'](doc, 'Record damages (with severity + photos + insurance claim flag)')
    api['add_bullet'](doc, 'View / capture delivery + pickup proof photos')
    api['add_bullet'](doc, 'Review signed waiver (immutable copy of what customer agreed to)')
    api['add_bullet'](doc, 'Start a delivery / pickup / spot-check inspection')
    api['add_bullet'](doc, 'Process refunds (full or partial)')
    api['add_bullet'](doc, 'Internal team chat — coordinate with drivers + staff in one thread')
    api['add_bullet'](doc, 'Add or edit the dispatch stop assignment')

    api['add_h2'](doc, "4.3  Dispatch — the route planner")

    api['add_p'](doc,
        'You build daily routes by assigning bookings to vehicles. Drag-and-drop:')

    api['add_data_sheet'](doc,
        title='Dispatch workflow',
        subtitle='From booking list to driver phone in 10 minutes.',
        fields=[
            ('Pick a date',
             'Pick today (or any date). See all bookings for that date.'),
            ('Create a route',
             'New route → pick vehicle + trailer + driver. Type: Delivery or Pickup.'),
            ('Add stops',
             'Click bookings to add as stops. Reorder by drag-and-drop. Stop order = drive order.'),
            ('Driver sees instantly',
             'Driver opens the PWA on their phone. Today\'s route appears. Each stop has '
             'address, time window, customer name, products.'),
            ('Driver marks delivered',
             'Per-stop "Delivered" button. Status syncs back to admin in real-time. The booking '
             'flips to "delivered" once all stops on the route are marked.'),
        ])

    api['add_callout'](doc, 'value',
        'No more printed route sheets. No more "wait, which truck has the chairs?" Everything '
        'is on the driver\'s phone, with addresses you tap to open Google Maps.')

    api['add_h2'](doc, "4.4  The calendar")

    api['add_p'](doc,
        'A visual month/week/day view of every confirmed booking. Color-coded by status. '
        'Useful for:')

    api['add_bullet'](doc, 'Seeing weekend volume at a glance')
    api['add_bullet'](doc, 'Spotting overbookings before they happen')
    api['add_bullet'](doc, 'Planning days off (block dates from /admin/availability)')
    api['add_bullet'](doc, 'Showing the operator at a glance how busy "this Saturday" is')

    api['add_h2'](doc, "4.5  Quotes")

    api['add_p'](doc,
        'For customers who want a custom package or have special requirements — build a quote '
        'instead of having them go through the standard wizard.')

    api['add_data_sheet'](doc,
        title='Quote workflow',
        subtitle='Especially useful for corporate events, big packages, multi-day rentals.',
        fields=[
            ('Build quote',
             'Pick customer, dates, line items (products + qty + price). Discount + tax automatic.'),
            ('Email quote',
             'Customer gets a public link (no login needed). They see the quote nicely formatted.'),
            ('Customer accepts / declines',
             'One click. You see the response in /admin/quotes.'),
            ('Convert to booking',
             'When customer accepts, the quote auto-converts to a confirmed booking. Stripe '
             'PaymentIntent generated if they need to pay now.'),
            ('Quote expires after 14 days',
             '(Configurable). Auto-reminders 3 days + 6 hours before expiration.'),
        ])

    api['add_h2'](doc, "4.6  Inventory")

    api['add_p'](doc,
        'Track what you own at the level of detail you want:')

    api['add_kv_table'](doc,
        ['Mode', 'When to use'],
        [
            ('Simple counts',
             'You have 5 bounce houses. Stock = 5. No per-unit tracking. Most owners use this.'),
            ('Per-unit tracking',
             'You want to know which specific blower (BLOWER001 vs BLOWER002) went on which '
             'route. Useful for warranty tracking + condition history.'),
            ('Per-product requirements',
             'Link products to required inventory (e.g. "this bounce house needs the big blower '
             '+ 50ft extension cord"). Dispatch auto-includes them on the route.'),
        ],
        col_widths=[2.0, 5.1])

    api['add_callout'](doc, 'info',
        'Low-stock alerts fire automatically once per week (so you don\'t get spammed) when an '
        'item drops below threshold.')

    api['add_h2'](doc, "4.7  Reports")

    api['add_p'](doc, 'Where you find out what made money:')

    api['add_kv_table'](doc,
        ['Report', 'What you see'],
        [
            ('P&L by period',
             'Revenue, expenses, gross margin by week / month / year.'),
            ('Cash flow projection',
             'Upcoming bookings → expected revenue by date.'),
            ('Drivers report',
             'Hours, earnings, 1099 total per driver.'),
            ('Customer LTV',
             'Lifetime value per customer. Sort by top spenders.'),
            ('Product performance',
             'Which products book most. Which are most profitable.'),
            ('Custom reports',
             'Build your own — pick columns, filters, time ranges.'),
            ('1099-NEC',
             'Generate IRS-ready 1099 forms for drivers + referrers at year-end.'),
        ],
        col_widths=[2.0, 5.1])

    api['add_callout'](doc, 'good',
        'For the question "how much did I actually make on the bounce house side this month?" '
        'you can also ask the AI admin assistant in plain English. It reads your real data and '
        'answers.')

    api['add_h2'](doc, "4.8  Customers + loyalty")

    api['add_p'](doc,
        'Your customer database is automatically populated. Every booking adds (or updates) a '
        'customer profile. From /admin/customers:')

    api['add_bullet'](doc, 'Search by name, email, phone')
    api['add_bullet'](doc, 'See LTV, total bookings, last event date')
    api['add_bullet'](doc, 'Tag customers (VIP, corporate, etc.)')
    api['add_bullet'](doc, 'Adjust loyalty points (refunds, bonuses, corrections)')
    api['add_bullet'](doc, 'Approve / deny / process payout requests for referrer commissions')
    api['add_bullet'](doc, 'View their referral tree')

    api['add_h2'](doc, "4.9  Staff + drivers")

    api['add_p'](doc, 'Invite staff at no extra cost. Three roles:')

    api['add_kv_table'](doc,
        ['Role', 'Can do', 'Cannot do'],
        [
            ('Admin',
             'Everything',
             '—'),
            ('Staff',
             'Bookings, dispatch, products, customers, reports',
             'Settings, billing, users, API keys, webhooks'),
            ('Driver',
             'See assigned routes, mark delivered, capture proof, message the team, do inspections',
             'See other drivers\' routes or any admin pages'),
        ],
        col_widths=[1.0, 3.6, 2.5])

    api['add_callout'](doc, 'info',
        'No per-seat pricing. Add as many staff + drivers as you need. The team chat surface '
        'is included. W-9 collection for drivers + 1099-NEC generation also included.')
