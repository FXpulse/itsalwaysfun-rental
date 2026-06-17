"""Chapter 9 — Booking Wizard. The single most critical customer flow."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 9, 'Booking Wizard Deep Dive',
        'The hottest path in the system. Date picker to payment confirmation in 5 steps.',
        audience_tags=['Owner', 'Operations', 'Engineer'])

    api['add_callout'](doc, 'fact',
        '/order-by-date is the single highest-revenue surface. Every $ collected by every '
        'tenant flows through it. It has 5 steps, talks to 2 APIs, integrates with Stripe '
        'Elements, GHL, Resend, Twilio, and updates 7 tables. It is also the target of the '
        '10/min per-IP rate limit and the 15-min hold expiration logic.')

    api['add_h2'](doc, '9.1  The 5 steps')

    api['add_mono_block'](doc, """
   Step indicator (top of page, always visible)

   ◉─── ○─── ○─── ○─── ○
   1    2    3    4    5
   Date Cat. Prod Info Pay
""", title='Visual progress')

    api['add_h2'](doc, '9.2  Step-by-step contract')

    api['add_data_sheet'](doc,
        title='Step 1 — Date selection',
        subtitle='Pick start date + end date + start/end time.',
        fields=[
            ('UI', [
                'Full-month calendar with prev/next navigation',
                'Date range selector (start required, end optional for multi-day)',
                'Time pickers: 6am – 10pm hourly, 4-hour default duration',
                'Auto-computed end time (clamped to 10pm)',
                'Unavailable / blocked dates dimmed',
                'Price preview by day (if product pre-selected)',
            ]),
            ('Validations', [
                'start_date ≥ now + min_lead_hours (default 48h, configurable per tenant)',
                'end_date ≥ start_date',
                'Max 14 days in range',
                'No dates in blocked_dates for selected product',
                'No dates already at stock cap (occupied_by_day ≥ product.stock)',
            ]),
            ('API calls', 'GET /api/products/[slug] returns unavailable_dates for next 90 days'),
            ('Next', '"Continue" → Category step (skipped if product pre-selected from item page)'),
        ])

    api['add_data_sheet'](doc,
        title='Step 2 — Category selection',
        subtitle='Pick a category. Skipped if customer arrived via "Book now" on a specific product.',
        fields=[
            ('UI', 'Category pill buttons. display_order honored.'),
            ('Data', 'categories WHERE is_active = true'),
            ('Next', 'Select a category → Product step'),
        ])

    api['add_data_sheet'](doc,
        title='Step 3 — Product selection',
        subtitle='Pick the actual rental.',
        fields=[
            ('UI', 'Product grid filtered to chosen category. Each card: image, name, short description, price/day.'),
            ('Data', 'products WHERE is_active = true AND is_addon = false AND category_slug = selected'),
            ('Next', 'Select product → Customer info step'),
        ])

    api['add_data_sheet'](doc,
        title='Step 4 — Customer info & add-ons',
        subtitle='Form heavy. Every business rule lives here.',
        fields=[
            ('UI', [
                'Name + contact: first_name, last_name, email, phone (auto-fill from session if authenticated)',
                'Delivery: address, city, zip',
                'Surface type dropdown (from setup_surfaces)',
                'Power source radio (Yes/No) — "No" auto-adds power supply add-on per-day',
                'Add-on checkboxes + qty spinners (chairs, tables, etc.)',
                'Damage protection checkbox (one-time fee)',
                'Notes textarea (special instructions)',
                'Waiver agreement checkbox + e-signature name (if waiver enabled)',
                'COI request toggle + venue fields (name, address, additional insured, instructions)',
                'SMS opt-in checkbox (explicit, default-unchecked)',
                'Loyalty points redemption slider (if authenticated + has points)',
                'Coupon code input + "Apply" button',
                'Gift card code input + "Apply" button',
            ]),
            ('Validations', [
                'Required: first_name, last_name, email, phone',
                'Email format validation',
                'If waiver enabled: agreed_checkbox = true AND signed_name length ≥ 2',
                'If COI requested: venue_name required',
                'SMS opt-in: explicit, not default-checked (10DLC compliance)',
            ]),
            ('API calls', 'POST /api/bookings/check-and-hold (the big one — see 9.3)'),
            ('Next', '"Continue" → Payment step (or Done if fully discounted)'),
        ])

    api['add_data_sheet'](doc,
        title='Step 5 — Payment',
        subtitle='Stripe Elements form.',
        fields=[
            ('UI', [
                'Stripe PaymentElement (card, Apple Pay, Google Pay, Link)',
                'Order summary (itemized: product base + power supply + add-ons + protection − discount + tax = total)',
                'Big "Pay & Confirm Rental" button with lock icon + total',
                'If Stripe not configured: replaced with "Booking request received — payment by phone" message',
            ]),
            ('Validations', 'Stripe.js client-side validation. Server re-validates everything on webhook.'),
            ('API calls', 'stripe.confirmPayment() — may trigger 3DS redirect'),
            ('Post-payment', 'On client success: toast + move to Done. Webhook independently fires to confirm booking.'),
            ('Next', 'Done (confirmation screen)'),
        ])

    api['add_h2'](doc, '9.3  POST /api/bookings/check-and-hold — the hot path')

    api['add_p'](doc,
        'This endpoint is the most-called server-side handler. It is rate-limited 10/min per IP. '
        'It is the only place where pricing logic, inventory check, and Stripe PaymentIntent '
        'creation all converge. The full sequence:')

    api['add_mono_block'](doc, """
   Receive request (Step 4 submission)
                    │
                    ▼
   1. Rate limit check: Upstash sliding window (10/min per IP)
                    │
                    ▼
   2. Zod schema validation
                    │
                    ▼
   3. Resolve tenant from headers (x-tenant-id)
                    │
                    ▼
   4. Lookup product by slug or id (must be is_active = true)
                    │
                    ▼
   5. For each date in range:
        • Check blocked_dates
        • Count confirmed/delivered bookings — must be < product.stock
                    │
                    ▼
   6. Calculate pricing:
        • Day 1 = product.price_per_day (or weekend_price_per_day if Sat/Sun)
        • Day 2+ = day 1 × 0.30 (30% surcharge)  unless weekend pricing overrides
        • Add power_supply_fee × days (if needs_power_supply)
        • Add Σ(addons[].price × qty × days)
        • Add damage_protection_cents (one-time, if accepted)
        • Subtotal = above
                    │
                    ▼
   7. Apply coupon (if code given):
        • percent: discount = subtotal × pct/100
        • fixed: discount = min(subtotal, fixed_cents)
        • overnight_free: waives day 2+ surcharge
        • DO NOT increment coupon counter yet (only on payment success)
                    │
                    ▼
   8. Apply gift card (if code given):
        • Pro-rated balance deduction
                    │
                    ▼
   9. Apply loyalty points (if authenticated + redeem_points > 0)
                    │
                    ▼
   10. Calculate tax (if enabled):
        • tax_cents = round(taxable_subtotal × tax_rate/100)
                    │
                    ▼
   11. Total = subtotal − discount + tax
                    │
                    ▼
   12. If Stripe configured AND total > 0:
        • stripe.paymentIntents.create({
            amount: total, currency, metadata: { tenant_id, booking_id, product_id },
            transfer_data: { destination: tenant.stripe_account_id }
          })
        • Returns client_secret
                    │
                    ▼
   13. INSERT bookings (status = 'pending_payment', stripe_payment_intent_id,
                          hold_expires_at = now + 15 min, total_amount, ...)
                    │
                    ▼
   14. Reserve inventory implicitly (the booking row IS the reservation)
                    │
                    ▼
   15. Return { booking_id, client_secret, amount, fully_discounted, ... }
""", title='check-and-hold — the full server-side sequence')

    api['add_h2'](doc, '9.4  payment_intent.succeeded — the webhook cascade')

    api['add_mono_block'](doc, """
   Stripe POSTs to /api/webhooks/stripe
                    │
                    ▼
   1. Verify signature (HMAC-SHA256, STRIPE_WEBHOOK_SECRET)
                    │
                    ▼
   2. Parse event.type
                    │
                    ▼
   payment_intent.succeeded with metadata.type = 'booking' (default):
                    │
                    ▼
   3. SELECT booking by stripe_payment_intent_id
                    │
                    ▼
   4. IDEMPOTENCY GUARD: if booking_status != 'pending_payment', do nothing
       (Stripe retries up to 3 days — protects against re-processing)
                    │
                    ▼
   5. UPDATE bookings SET booking_status = 'confirmed',
                       stripe_payment_status = 'paid',
                       confirmed_at = now()
                    │
                    ▼
   6. Increment coupon counter (current_uses++) IF coupon_code present
                    │
                    ▼
   7. Award loyalty points to customer_profile (loyalty_points +=
                                                  total × points_per_dollar)
                    │
                    ▼
   8. Send booking_confirmation email (Resend) — idempotent via booking_emails_sent
                    │
                    ▼
   9. Send booking_confirmation SMS (Twilio) IF customer_phone_sms_consent_at is set
                    │
                    ▼
   10. Upsert GHL contact + add note + add tag 'booking_confirmed'
       (non-blocking — failures logged but don't break)
                    │
                    ▼
   11. Fire outbound webhooks: booking.paid, booking.confirmed
                    │
                    ▼
   12. Stamp booking row: emails_sent_at, ghl_synced_at, webhooks_fired_at
""", title='What happens when the payment lands')

    api['add_h2'](doc, '9.5  Pricing rules cheat sheet')

    api['add_kv_table'](doc,
        ['Rule', 'How it applies', 'Configured by'],
        [
            ('Day 1 full, Day 2+ 30% surcharge',
             'Multi-day rentals: day 1 at base rate, days 2+ at 30% of base rate',
             'Hard-coded ratio; configurable at the product level via weekend_price_per_day'),
            ('Weekend pricing override',
             'If Sat or Sun, use weekend_price_per_day if set on the product',
             'Per-product weekend_price_per_day_cents column'),
            ('Power supply',
             'Flat per-day add-on if customer answers "no" to "do you have power?"',
             'site_settings.power_supply_per_day_cents'),
            ('Add-ons (chairs, tables, etc.)',
             'Each add-on: price × qty × days. Flat — no surcharge.',
             'product.is_addon = true; price_per_day_cents'),
            ('Damage protection',
             'One-time fee added if customer opts in.',
             'site_settings.damage_protection_cents + enabled flag'),
            ('Tax',
             'Calculated on taxable items only (product + power + add-ons + protection).',
             'site_settings.tax_rate, tax_label, tax_enabled. Tax-exempt products (e.g. services) flag.'),
            ('Coupons',
             'percent / fixed / overnight_free — applied to subtotal pre-tax.',
             'coupons.discount_type + discount_value + max_uses + expires_at'),
            ('Gift cards',
             'Pro-rated balance deduction. Remaining balance carries over.',
             'gift_cards.balance_cents'),
            ('Loyalty redemption',
             'Customer chooses points to redeem. Converted to $ via points_redemption_rate.',
             'site_settings.points_per_dollar + points_redemption_rate + min_redeem_points'),
        ],
        col_widths=[2.0, 2.7, 2.5])

    api['add_h2'](doc, '9.6  Inventory + the hold')

    api['add_callout'](doc, 'info',
        'Pending_payment bookings DO block inventory while their hold is active (booking row '
        'exists and hold_expires_at > now). When the hold expires without payment, the booking '
        'row remains (audit trail) but is filtered out of the "blocking" SELECT — so the slot '
        'reopens for the next attempt. This is the right design: clean audit + reactive UX.')

    api['add_callout'](doc, 'good',
        'Only PAID inventory (booking_status IN (confirmed, delivered)) counts against stock '
        'in the public availability checks. This is what prevents stale holds from blocking '
        'new bookings — the public catalog is always responsive.')

    api['add_h2'](doc, '9.7  Abandoned cart')

    api['add_p'](doc,
        'If the customer fills out their email in step 4 and then idles for 30 minutes without '
        'completing payment, the wizard fires POST /api/bookings/abandoned-cart in the background. '
        'That endpoint pushes a webhook to GHL ("source=abandoned-cart-30min") which triggers a '
        'recovery SMS + email sequence and also sends a Resend recovery email directly with a '
        'one-click resume link.')

    api['add_callout'](doc, 'fact',
        'Only fires once per email per 30-min window (localStorage key prevents duplicates if '
        'the user reloads). Failures are non-fatal — the booking flow continues regardless.')

    api['add_h2'](doc, '9.8  Race conditions handled')

    api['add_kv_table'](doc,
        ['Race', 'What could go wrong', 'How it\'s prevented'],
        [
            ('Two customers booking same slot',
             'Both pass availability check, only one should win',
             'Hold row exists in pending_payment before payment. Second customer\'s check sees '
             'the existing hold and the available stock count is updated. (Worst case: both pay '
             'and admin manually refunds — Stripe Connect makes this clean.)'),
            ('Stripe webhook + client redirect race',
             'Client marks confirmed before webhook fires',
             '2026-06-15 fix: defense-in-depth in webhook handler — sendBookingConfirmation is '
             'called from out-of-band update paths AND from the webhook. Idempotency via '
             'booking_emails_sent ledger.'),
            ('Coupon counter double-count',
             'Counter incremented at hold AND at payment',
             'Only at payment. Hold creation does NOT increment counter. Worst case: hold '
             'expires, counter doesn\'t move.'),
            ('Late webhook retry (3 days)',
             'Could re-process a manually cancelled booking',
             'Webhook handler checks booking_status != \'pending_payment\' — bails early.'),
        ],
        col_widths=[1.8, 2.5, 3.0])
