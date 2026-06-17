"""Chapter 12 — API Reference. Every endpoint, its contract, its safeguards."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 12, 'API Reference',
        'All 51 endpoints — public, admin, v1, webhooks. Contracts, auth, rate limits, side effects.',
        audience_tags=['Engineer', 'Integration partner'])

    api['add_callout'](doc, 'fact',
        '51 route.ts files. Grouped: 14 public customer endpoints, 1 admin, 5 programmatic v1, '
        '2 inbound webhooks, 13 cron jobs, 3 health/misc, 13 admin/diagnostic/template helpers. '
        'Auth: none (host-resolved), Supabase session, rfk_* Bearer key with scope check, '
        'webhook signature, CRON_SECRET Bearer.')

    api['add_h2'](doc, '12.1  Public customer flow (14 endpoints)')

    public_endpoints = [
        ('GET',  '/api/products',
         'Catalog list. Cached 60s. No auth.',
         '{ products: [{id, slug, name, price_per_day_cents, ...}] }'),
        ('GET',  '/api/products/[slug]',
         'Product detail + next-90-day unavailable_dates. Cached 60s.',
         '{ product, unavailable_dates: [YYYY-MM-DD], range: {from, to} }'),
        ('GET',  '/api/availability',
         'Yes/no availability check for a product on a date.',
         '{ available: bool, reason: string }'),
        ('POST', '/api/bookings/check-and-hold',
         'THE hot path. Creates 15-min hold + Stripe PaymentIntent. Rate-limited 10/min/IP.',
         '{ booking_id, hold_expires_at, amount, client_secret, fully_discounted }'),
        ('DELETE', '/api/bookings/release-hold',
         'Cancel unpaid booking + reopen slot.',
         '{ success: true }'),
        ('POST', '/api/bookings/extend',
         'Add days to a paid booking. Stripe PaymentIntent for incremental cost.',
         '{ extension_id, client_secret, additional_amount_cents, additional_days }'),
        ('POST', '/api/contact',
         'Contact form. Triple-redundant (DB + email + GHL). Rate-limited 5/5min/IP.',
         '{ ok: true, id }'),
        ('POST', '/api/coupons/validate',
         'Test a coupon — does NOT increment counter (only on payment success).',
         '{ valid, coupon, discount_cents, new_total }'),
        ('POST', '/api/gift-cards/validate',
         'Balance check on a gift card code.',
         '{ valid, code, balance_cents, applicable_cents }'),
        ('POST', '/api/gift-cards/purchase',
         'Buy a gift card. Stripe PaymentIntent → webhook → email + SMS to recipient.',
         '{ purchase_id, client_secret, amount_cents }'),
        ('POST', '/api/bookings/abandoned-cart',
         'Fire recovery email + GHL webhook after 30 min idle.',
         '{ ok: true, results: { ghl: {...}, resend: {...} } }'),
        ('POST', '/api/bookings/notify-ghl',
         'Thin wrapper to push to GHL (keeps URL secret server-side).',
         '{ ok: bool, status: number }'),
        ('GET',  '/api/calendar/[token].ics',
         'Public ICS calendar feed (token-authenticated).',
         'text/calendar VCALENDAR body'),
        ('POST', '/api/chat/public',
         'Public AI chat. Tools: get_products, check_availability, search_faqs (read-only). '
         'Rate-limited 10/5min/IP.',
         'streaming SSE response'),
    ]
    api['add_kv_table'](doc,
        ['M', 'Path', 'Purpose', 'Response'],
        public_endpoints,
        col_widths=[0.5, 2.0, 2.6, 2.0])

    api['add_h2'](doc, '12.2  Admin endpoints')

    api['add_kv_table'](doc,
        ['M', 'Path', 'Purpose'],
        [
            ('POST', '/api/admin/assistant',
             'Claude AI admin assistant. Tools: get_bookings_for_range, revenue_summary, '
             'customer_stats, product_performance. Max 6 tool rounds, temp 0.3.'),
            ('POST', '/api/admin/backup', 'On-demand database export.'),
            ('POST', '/api/admin/export/[entity]', 'Bulk export (CSV/JSON) per entity.'),
            ('POST', '/api/admin/support', 'Support ticket creation.'),
            ('POST', '/api/admin/diagnose-places', 'Test Google Places integration (admin diagnostics).'),
            ('GET',  '/api/templates/[entity]', 'Download CSV template for bulk import.'),
        ],
        col_widths=[0.5, 2.5, 4.1])

    api['add_h2'](doc, '12.3  Programmatic v1 API (5 endpoints)')

    api['add_p'](doc, 'Auth: Authorization: Bearer rfk_<api_key>. Scope check on every request.')

    api['add_kv_table'](doc,
        ['M', 'Path', 'Scope', 'Purpose'],
        [
            ('GET',  '/api/v1/availability', 'bookings:read',
             'Availability across date range (product_id optional)'),
            ('GET',  '/api/v1/products', 'products:read', 'List tenant catalog'),
            ('POST', '/api/v1/bookings', 'bookings:write',
             'Create booking programmatically (no payment collected yet)'),
            ('GET',  '/api/v1/bookings', 'bookings:read', 'List bookings (filter by status, since)'),
            ('GET',  '/api/v1/customers', 'customers:read', 'List customer profiles'),
        ],
        col_widths=[0.5, 2.2, 1.5, 3.0])

    api['add_callout'](doc, 'info',
        'API keys stored bcrypt-hashed in tenant_api_keys. key_prefix (first 8 chars) shown in '
        'UI for identification. Each key has scopes[] (read or write per resource), last_used_at, '
        'last_used_ip, expires_at (nullable), revoked_at + revoked_reason. Rotating: create new, '
        'switch consumer, revoke old.')

    api['add_h2'](doc, '12.4  Webhooks inbound (2)')

    api['add_data_sheet'](doc,
        title='POST /api/webhooks/stripe',
        subtitle='The cascade trigger.',
        fields=[
            ('Auth', 'Stripe-Signature header HMAC-SHA256 verification with STRIPE_WEBHOOK_SECRET.'),
            ('Events handled', [
                'payment_intent.succeeded (booking)',
                'payment_intent.succeeded (booking extension — metadata.type)',
                'payment_intent.succeeded (gift card purchase — metadata.type)',
                'payment_intent.payment_failed',
                'charge.refunded',
                'invoice.payment_succeeded (tenant subscription)',
                'invoice.payment_failed (tenant subscription — kicks off dunning)',
                'customer.subscription.deleted',
            ]),
            ('Idempotency', 'Conditional update — booking_status != \'pending_payment\' → no-op. '
                             'Late Stripe retries (up to 3 days) safe. Email send idempotent via '
                             'booking_emails_sent ledger.'),
            ('External effects', [
                'Booking confirmation Resend email + Twilio SMS',
                'GHL upsertContact + addContactNote + addContactTags',
                'Coupon counter increment',
                'Loyalty points credit',
                'Outbound webhook fan-out: booking.paid + booking.confirmed',
            ]),
        ])

    api['add_data_sheet'](doc,
        title='POST /api/webhooks/ghl',
        subtitle='Inbound from GHL forms.',
        fields=[
            ('Auth', 'x-ghl-secret header must match GHL_WEBHOOK_SECRET env (simple string equality '
                     '— see Chapter 16 for the timing-attack note).'),
            ('Purpose', 'Allow GHL forms / workflows to create a booking on the tenant\'s behalf, '
                         'returning a Stripe PaymentIntent client_secret for the customer to complete.'),
            ('Request', [
                'tenant_id or tenant_slug (mandatory — prevents leak to default tenant)',
                'contact: { firstName, lastName, email, phone, address1 }',
                'custom_fields: { event_date, start_time, end_time, product_slug }',
                'opportunity_id (stored for later stage sync)',
            ]),
            ('Response', '{ booking_id, hold_expires_at, amount, currency, client_secret }'),
            ('Business rules', [
                'Tenant must exist',
                'Product must be is_active = true and stock available',
                'Date must not be in blocked_dates',
                'Booking created in pending_payment status — no email/SMS yet',
            ]),
        ])

    api['add_h2'](doc, '12.5  Health & misc')

    api['add_kv_table'](doc,
        ['M', 'Path', 'Purpose'],
        [
            ('GET',  '/api/health',
             'Public readiness probe (UptimeRobot, BetterStack). Checks DB + env. Returns status, '
             'total_ms, per-check timing.'),
            ('POST', '/api/email/inbound',
             'Inbound email from Cloudflare Email Worker. Decodes base64 + quoted-printable bodies. '
             'Writes to contact_messages. Tenant resolved by domain or explicit slug — rejects 422 '
             'if no match (prevents cross-tenant data write).'),
            ('POST', '/api/free-tools/1099-tracker/submit',
             'Marketing lead capture form. Stores submission, emails lead-magnet PDF, tags in GHL.'),
        ],
        col_widths=[0.5, 2.5, 4.1])

    api['add_h2'](doc, '12.6  Rate limits at a glance')

    api['add_kv_table'](doc,
        ['Endpoint', 'Limit', 'Storage', 'Behavior on breach'],
        [
            ('/api/bookings/check-and-hold', '10 / min / IP', 'Upstash sliding window', '429 with retry-after'),
            ('/api/contact',                 '5 / 5min / IP', 'Upstash sliding window', '429 with retry-after'),
            ('/api/chat/public',             '10 / 5min / IP', 'In-memory (per-process)', '429 with retry-after'),
            ('/api/v1/*',                    'Vercel plan-based', 'Vercel', 'Plan-level throttling'),
            ('Others',                       'None', '—', '—'),
        ],
        col_widths=[2.5, 1.4, 1.8, 1.5])

    api['add_callout'](doc, 'warn',
        'Public-readonly endpoints (/api/availability, /api/products) have NO rate limit today. '
        'A scrape attack would hit Supabase directly. This is on the 30-day list — adding a '
        'cheap per-IP limit via Upstash is ~1 hour of work.')
