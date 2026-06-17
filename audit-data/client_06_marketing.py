"""Client 6 — Marketing. How you grow."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 6, 'Grow Your Business',
        'Email + SMS + loyalty + referrals + reviews — all built in. No Mailchimp, no Calendly, no GHL needed.',
        audience_tags=['Rental Owner'])

    api['add_callout'](doc, 'quote',
        '"The marketing tools most owners pay for separately — Mailchimp, GHL, review tools, '
        'referral apps — they\'re already in here. We built them because IAF needed them."')

    api['add_h2'](doc, "6.1  Automated email + SMS lifecycle")

    api['add_p'](doc,
        'Seven emails fire automatically across the customer lifecycle. SMS versions of each '
        'are sent if the customer opted in at checkout. You customize the template once.')

    api['add_kv_table'](doc,
        ['When', 'Email', 'SMS'],
        [
            ('30 seconds after payment',
             'Confirmation — date, products, delivery window, important tips',
             'Yes (transactional — sent regardless of marketing opt-in)'),
            ('3 days before event',
             'Reminder — confirm details, "we look forward to seeing you"',
             'Yes (if opt-in)'),
            ('1 day after event',
             'Review request — link to your Google review page',
             'Yes (if opt-in, marked MARKETING)'),
            ('90 days after event',
             'Re-engagement — "ready to book again?"',
             'Email only'),
            ('365 days after first booking',
             'Anniversary — small loyalty discount code included',
             'Email only'),
            ('Quote sent (manual)',
             'Quote email with public link',
             'No'),
            ('Gift card purchase',
             'Recipient receives code + redemption URL',
             'Yes (if recipient phone provided)'),
        ],
        col_widths=[1.8, 4.0, 1.3])

    api['add_callout'](doc, 'value',
        'These templates are pre-written and ready to go on day 1. You can leave them as-is, '
        'or customize the wording in /admin/email-templates. SMS body is editable in the same '
        'place. Variables auto-substitute (customer first name, product name, dates, etc.).')

    api['add_h2'](doc, "6.2  SMS — the right way (compliant)")

    api['add_p'](doc,
        'SMS is the highest-engagement channel — but only if you do it compliantly. '
        'RentalFlow handles the compliance for you:')

    api['add_bullet'](doc, [('A2P 10DLC registration ', True), ('— required for US transactional SMS. We help you get registered during onboarding.', False)])
    api['add_bullet'](doc, [('Explicit opt-in ', True), ('— customer checks a box at booking. We stamp customer_phone_sms_consent_at on their row.', False)])
    api['add_bullet'](doc, [('STOP / HELP handling ', True), ('— customer texts "STOP" and they\'re removed automatically. Twilio handles.', False)])
    api['add_bullet'](doc, [('MARKETING vs TRANSACTIONAL ', True), ('— review request SMS is tagged MARKETING; confirmation + reminder are TRANSACTIONAL.', False)])

    api['add_callout'](doc, 'good',
        'If you\'re currently sending SMS manually via your phone — you\'re technically not '
        '10DLC compliant. Carriers are increasingly enforcing this. RentalFlow gets you compliant '
        'before it becomes a problem.')

    api['add_h2'](doc, "6.3  Email campaigns (one-off blasts)")

    api['add_p'](doc,
        'Beyond the lifecycle templates, you can send one-off campaigns from /admin/campaigns:')

    api['add_kv_table'](doc,
        ['Use case', 'Example'],
        [
            ('Seasonal promo',  '"Spring is here — book your party 10% off through Sunday."'),
            ('Holiday',         '"Memorial Day weekend booking now open."'),
            ('Re-engagement',   'Send to customers who haven\'t booked in 6+ months.'),
            ('VIP-only offers', 'Send to customers tagged VIP (top 10% LTV).'),
            ('New product',     '"Just added: 22-ft water slide. First 10 bookings get $25 off."'),
        ],
        col_widths=[2.0, 5.1])

    api['add_p'](doc,
        'Build the campaign in the editor. Pick the recipient filter (all, by tag, custom '
        'segment). Schedule for now or future. Watch sent / opened / clicked stats.')

    api['add_h2'](doc, "6.4  Reviews — automatic Google sync")

    api['add_p'](doc,
        'Your Google Business reviews show on your /reviews page automatically:')

    api['add_bullet'](doc, 'Paste your Google Business Profile URL in /admin/site')
    api['add_bullet'](doc, 'Daily cron pulls new reviews + ratings')
    api['add_bullet'](doc, 'Reviews show on your public /reviews page')
    api['add_bullet'](doc, 'You can manually feature specific reviews (pin to top)')
    api['add_bullet'](doc, 'New negative review (≤3 stars)? You get an alert email')

    api['add_callout'](doc, 'value',
        'You can also manually add testimonials customers send you via email — not every great '
        'review lives on Google. /admin/reviews lets you add them.')

    api['add_h2'](doc, "6.5  Loyalty program")

    api['add_p'](doc, 'Built in. Configurable. Optional.')

    api['add_data_sheet'](doc,
        title='How loyalty works',
        subtitle='Configure once. Runs forever.',
        fields=[
            ('Setting',
             'In /admin/settings/loyalty: points_per_dollar (e.g. 1), redemption_rate (e.g. '
             '100 points = $1), min_redeem (e.g. need 200 points to redeem).'),
            ('Earning',
             'Customer pays $300 → earns 300 points (configurable). Awarded on payment success, '
             'not on hold creation.'),
            ('Redeeming',
             'Customer sees points balance in portal. At checkout, slider to apply points. '
             'Subtracted from total.'),
            ('Tracking',
             'Customer sees full transaction history. Operator can manually adjust (refund, '
             'bonus, correction) from /admin/loyalty.'),
            ('Tier (optional)',
             'You can add tier logic via custom email_templates if you want VIP-only perks.'),
        ])

    api['add_h2'](doc, "6.6  Referral program — the growth lever")

    api['add_p'](doc,
        'This is the highest-leverage marketing feature. Every customer gets a unique '
        'referral code. When their friends use it, the referrer earns commission.')

    api['add_data_sheet'](doc,
        title='How referrals work',
        subtitle='Done well — your customers acquire your next customers for you.',
        fields=[
            ('Referrer side', [
                'After first booking, customer sees their unique code in /portal/referrals',
                'They share via copy-link, social, text — whatever',
                'They see who they referred, how many booked, commission earned',
                'They request payout (Stripe → their bank, or store credit)',
            ]),
            ('Referee side',
             'New customer enters the code at checkout. Gets discount (you configure). Books.'),
            ('Commission flow',
             'When referee\'s booking is paid, referrer earns commission ($X per booking or '
             '% of total — you configure). Logged in loyalty_transactions.'),
            ('Payout flow',
             'Referrer requests payout. You approve in /admin/loyalty. Stripe transfers to '
             'their bank. W-9 collection for >$600/year commission for 1099-NEC compliance.'),
        ])

    api['add_callout'](doc, 'good',
        'IAF runs referrals with $25 per referral. Cost: $25. Customer LTV: $400-1,500. ROI: '
        '15-60×. The best marketing dollar in the business.')

    api['add_h2'](doc, "6.7  CRM sync (if you use GHL)")

    api['add_p'](doc,
        'If you already use GoHighLevel (many rental operators do — it\'s a powerful CRM):')

    api['add_bullet'](doc, 'Every booking auto-pushes contact + booking detail to GHL')
    api['add_bullet'](doc, 'Every abandoned cart pushes too (after 30 min idle)')
    api['add_bullet'](doc, 'GHL workflows can then send your own SMS/email sequences')
    api['add_bullet'](doc, 'GHL forms can push BACK into RentalFlow to create bookings (e.g. inbound leads)')

    api['add_callout'](doc, 'info',
        'If you don\'t use GHL, you don\'t need it. RentalFlow\'s built-in email + SMS handle '
        'the customer lifecycle. GHL is for operators who want extra automation depth.')

    api['add_h2'](doc, "6.8  Public chat assistant (optional)")

    api['add_p'](doc,
        'Optionally enable an AI chat widget on your public website. It answers customer '
        'questions about products, availability, FAQs — without you having to be online. '
        'Built on OpenAI. Read-only (it can\'t book or change anything).')

    api['add_callout'](doc, 'value',
        'Reduces phone calls about basic questions. Customer asks "do you have a 15-ft slide '
        'for Saturday?" The chat checks availability and answers immediately.')
