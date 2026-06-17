"""Chapter 7 — Customer Portal. The returning-customer experience."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 7, 'Customer Portal',
        'Returning customers log in to manage bookings, redeem points, share referral codes, and grow LTV.',
        audience_tags=['Owner', 'Operations', 'Engineer'])

    api['add_callout'](doc, 'fact',
        '7 portal pages behind a Resend-OTP auth wall. The portal is the retention surface — '
        'loyalty status, referral commissions, account history, optional W-9 collection for '
        'referrer payouts. A customer who books once gets an auth.users row + customer_profiles row.')

    api['add_h2'](doc, '7.1  The portal surface')

    api['add_kv_table'](doc,
        ['Path', 'Purpose'],
        [
            ('/portal/login', 'Email → 6-digit OTP → session (custom flow via Resend, not Supabase magic links)'),
            ('/portal', 'Dashboard: welcome, loyalty banner, stats, recent bookings, "Book again" CTA'),
            ('/portal/bookings', 'All bookings list (past + upcoming)'),
            ('/portal/bookings/[id]', 'Booking detail + actions (extend, weather cancel, internal chat)'),
            ('/portal/profile', 'Edit contact info (auto-prefills future bookings)'),
            ('/portal/points', 'Loyalty points balance + transaction history'),
            ('/portal/referrals', 'Referral code, assigned coupons, referred users, commission ledger, payout request'),
        ],
        col_widths=[1.8, 5.3])

    api['add_h2'](doc, '7.2  Auth: why custom OTP via Resend, not Supabase magic links')

    api['add_2col'](doc,
        'Supabase magic links use Supabase\'s own SMTP. Deliverability is variable, the link is '
        '40+ characters, and the From address is not under our control. For a customer with '
        'a sub-2-minute attention span, this was costing logins.',
        'Custom OTP via Resend: 6-digit code (short, mobile-friendly), our SMTP reputation, '
        'tenant-branded subject + body, audit trail in portal_otp_codes table. Token exchange '
        'still goes through Supabase Auth (admin.generateLink → verifyOtp magiclink) so the '
        'session is a normal Supabase session.',
        left_title='Standard Supabase flow',
        right_title='RentalFlow custom flow')

    api['add_mono_block'](doc, """
   Step 1 — Request code
   ─────────────────────
   POST /portal/login (action: requestPortalCode)
        │
        ├─ Generate random 6-digit code (000000-999999, zero-padded)
        ├─ Hash with HMAC-SHA256(email || code, OTP_SECRET)
        ├─ INSERT portal_otp_codes
        │      email, tenant_id, code_hash, expires_at = now + 15min,
        │      attempts = 0
        │      (any prior un-consumed codes for this email invalidated first)
        └─ Send Resend email to customer with the 6-digit code

   Step 2 — Verify code
   ─────────────────────
   POST /portal/login (action: verifyPortalCode)
        │
        ├─ Hash incoming code, lookup row by (email, tenant_id)
        ├─ Check expires_at, attempts < 5, code_hash matches
        ├─ Mark consumed_at = now
        │
        ├─ Find or create Supabase auth user:
        │     ▸ admin.createUser({ email, email_confirm: true, no password })
        │     ▸ OR existing — fall back to admin.listUsers() pagination
        │
        ├─ admin.generateLink({ type: 'magiclink', email })
        │     ─► returns hashed_token
        │
        ├─ userClient.auth.verifyOtp({
        │      type: 'magiclink', token_hash: hashed_token })
        │     ─► sets auth.session cookie on response
        │
        └─ Post-login chores:
              • ensureCustomerProfile(user_id)
              • linkReferrer(user_id, iaf_ref cookie) if present
              • Clear iaf_ref cookie
""", title='Resend OTP flow — under the hood')

    api['add_callout'](doc, 'info',
        'Codes are hashed with email-as-salt to prevent rainbow-table reuse. 5 max attempts per code. '
        'Prior un-consumed codes are invalidated on re-request. Shipped 2026-06-01. The pattern is '
        'documented for replication on other tenant-facing auth surfaces.')

    api['add_h2'](doc, '7.3  Portal page data sheets')

    api['add_data_sheet'](doc,
        title='/portal  — Dashboard',
        subtitle='The first thing a returning customer sees after sign-in.',
        fields=[
            ('Purpose', 'Re-engagement hub. Welcome → loyalty status → "Book again" CTA.'),
            ('UI elements', [
                'Welcome heading with customer first_name',
                'Loyalty banner (if a tenant-active LOYAL* coupon exists for them)',
                'Stats cards: total bookings, total spent, next event date',
                '"Ready to rent again?" CTA → /order-by-date',
                'Recent bookings (latest 3) with status badge + link to detail',
            ]),
            ('Data tables', [
                'auth.users (for email + session)',
                'customer_profiles (loyalty_points, w9, referral_code)',
                'bookings WHERE customer_email ilike user.email (paid + non-cancelled, last 3)',
                'coupons WHERE code ILIKE \'LOYAL%\' AND tenant_id = current_tenant',
            ]),
            ('Notable', 'Loyalty banner is admin-driven — operator creates LOYAL15 coupon and it auto-surfaces here.'),
        ])

    api['add_data_sheet'](doc,
        title='/portal/bookings  — History',
        subtitle='All bookings (past, current, upcoming) in a single sortable list.',
        fields=[
            ('Purpose', 'Customer self-service for booking history.'),
            ('UI elements', 'Table: Event date · Rental · Amount · Status badge · "View" link'),
            ('Data tables', 'bookings WHERE customer_email ilike user.email ORDER BY event_date DESC LIMIT 200'),
            ('Notable', 'Hard limit 200 to keep page snappy for high-LTV repeat customers.'),
        ])

    api['add_data_sheet'](doc,
        title='/portal/bookings/[id]  — Booking detail',
        subtitle='Full booking view + customer-initiated actions.',
        fields=[
            ('Purpose', 'Customer sees their own booking + can extend, weather-cancel, message the team.'),
            ('UI elements', [
                'Booking header: product, dates, times, address, total',
                'Timeline: created → paid → confirmed → delivered → completed',
                'Action panels: Extend (if not yet delivered), Weather cancel request, Internal chat',
                'Delivery proof (photos + signature) once delivered',
            ]),
            ('Data tables', 'bookings + booking_proofs + booking_internal_messages + booking_extensions'),
            ('Server actions', [
                'POST /api/bookings/extend → add days, recalculate price, Stripe PaymentIntent if cost > 0',
                'requestWeatherCancel server action → flags booking for admin review',
                'postInternalMessage → adds to booking_internal_messages thread (visible to admin/staff/driver)',
            ]),
            ('Business rules', [
                'Extensions require ≥6 hours lead time before original end_date',
                'Extensions max total 14 days from original event_date',
                'Weather cancel is a request — admin manually reviews + decides',
            ]),
        ])

    api['add_data_sheet'](doc,
        title='/portal/profile  — Account editor',
        subtitle='Save contact info for prefill on future bookings.',
        fields=[
            ('Purpose', 'Reduce friction on repeat bookings — wizard prefills from this.'),
            ('UI elements', 'Email (read-only), form: first/last name, phone, address.'),
            ('Data source', 'Supabase auth.users.user_metadata + latest booking fallback'),
            ('Server action', 'Updates auth.users.user_metadata via admin client'),
        ])

    api['add_data_sheet'](doc,
        title='/portal/points  — Loyalty wallet',
        subtitle='Show balance, equivalent dollars, transaction history.',
        fields=[
            ('Purpose', 'Loyalty engagement — make redemption visible and motivating.'),
            ('UI elements', [
                'Big balance card: points count, dollar equivalent (via points_redemption_rate), redemption status',
                'Settings preview: "1 point per $1, redeem at 100 points"',
                'Transaction history: date · description · points (±)',
            ]),
            ('Data tables', [
                'customer_profiles.loyalty_points',
                'site_settings (points_per_dollar, points_redemption_rate, min_redeem_points)',
                'loyalty_transactions WHERE type IN (booking_points, points_redeemed, admin_adjustment) ORDER BY created_at DESC',
            ]),
            ('Notable', 'Points are awarded at payment time inside the Stripe webhook handler — '
                         'never on hold creation.'),
        ])

    api['add_data_sheet'](doc,
        title='/portal/referrals  — Referrals & payouts',
        subtitle='The growth lever — customers earn cash by referring friends.',
        fields=[
            ('Purpose', 'Share referral code, see who signed up, track commission, request payout.'),
            ('UI elements', [
                'Referral code box with copy button + share link (?ref=CODE)',
                'Assigned coupons grid (admin-created codes attributed to this referrer)',
                'Referred users list: email · join date · has_paid · first paid booking total',
                'Commission ledger: date · description · commission ($)',
                'Payout section: pending balance · paid balance · W-9 upload + status · "Request payout" button',
            ]),
            ('Data tables', [
                'customer_profiles (referral_code, commission_pending_cents, commission_paid_cents, w9_url)',
                'customer_profiles WHERE referred_by_user_id = me',
                'loyalty_transactions WHERE type = \'referral_commission\'',
                'coupons WHERE referrer_user_id = me',
                'payout_requests history (pending → approved → processed)',
            ]),
            ('Business rules', [
                'Payout requires W-9 on file (1099-NEC compliance)',
                'Payout statuses: pending → approved → processed (admin marks)',
                'Commission earned when referred user uses referrer\'s assigned coupon code on a paid booking',
            ]),
            ('Notable', 'Customer-driven referral signup flow (the customer choosing their own coupon code) '
                         'is admin-driven today. Future enhancement on the 90-day list.'),
        ])

    api['add_h2'](doc, '7.4  Compliance hooks in the portal')

    api['add_kv_table'](doc,
        ['Compliance need', 'Where it lives', 'Detail'],
        [
            ('1099-NEC eligibility',
             '/portal/referrals + driver_tax_profiles',
             'W-9 upload (PDF or photo) stored encrypted. tin_last4 captured separately. '
             'Used in /admin/reports/1099-nec to generate forms.'),
            ('GDPR / CCPA-style right to delete',
             'Manual — no portal page',
             'Customer emails request → admin handles in customers/[id] page. Not self-serve yet.'),
            ('SMS opt-in audit',
             'Stamped on booking row',
             'customer_phone_sms_consent_at on bookings (set if SMS consent checkbox checked at order time).'),
        ],
        col_widths=[1.8, 2.3, 3.0])
