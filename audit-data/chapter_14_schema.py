"""Chapter 14 — Data Dictionary. 88 tables, 197 RLS policies, 41 functions, fully indexed."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 14, 'Data Dictionary',
        '88 tables. 197 RLS policies. 210 indexes. 41 functions. 28 triggers. The full picture.',
        audience_tags=['Engineer', 'Acquirer'])

    api['add_callout'](doc, 'fact',
        '115 SQL migration files in supabase/. Tables grouped by domain. JSONB used for '
        '12 columns where structured-but-flexible content makes sense (line items, add-ons, '
        'inspection results). State machines tracked on bookings, inventory_units, quotes, '
        'COI requests, coupons, support tickets.')

    api['add_stats_strip'](doc, [
        ('88', 'tables',        P['NAVY']),
        ('43', 'multi-tenant',  P['BLUE']),
        ('14', 'child-scoped',  P['TEAL']),
        ('197', 'RLS policies', P['GREEN']),
        ('210', 'indexes',      P['PURPLE']),
        ('41', 'functions',     P['AMBER']),
    ])

    api['add_h2'](doc, '14.1  Tenancy core')

    api['add_data_sheet'](doc,
        title='tenants',
        subtitle='The root — each row is one SaaS customer.',
        fields=[
            ('Tenancy', 'GLOBAL (no tenant_id — this IS the tenant table)'),
            ('Approx rows', '~10 (one per business)'),
            ('Key columns', [
                'id (uuid, PK)',
                'slug (text, unique, regex ^[a-z0-9][a-z0-9-]*[a-z0-9]$)',
                'business_name, owner_email, notification_email',
                'custom_domain (nullable)',
                'stripe_customer_id (platform subscription), stripe_account_id (Connect)',
                'subscription_status: trialing|active|past_due|canceled|incomplete|unpaid|paused',
                'suspended_at (nullable — middleware checks)',
                'inbox_enabled, timezone, branding fields (logo, accent_color, font, hero_image)',
            ]),
            ('Constraints', 'subscription_status IN (...). Slug regex enforced.'),
            ('RLS', 'Public read of selected columns (for branding). Service role for writes.'),
        ])

    api['add_data_sheet'](doc,
        title='user_roles',
        subtitle='RBAC link table — auth.users → tenant + role.',
        fields=[
            ('Tenancy', 'multi-tenant (composite PK includes tenant_id)'),
            ('Key columns', '(user_id, tenant_id) PK, role: admin|staff|driver, is_superadmin bool'),
            ('RLS', 'staff_or_admin_manage policy (is_staff_or_admin(auth.uid()))'),
            ('Notable', 'A user can have a role in multiple tenants (rare, but supported — e.g. '
                         'an operator who owns 2 brands).'),
        ])

    api['add_data_sheet'](doc,
        title='tenant_profile',
        subtitle='Rich metadata about each tenant (industry, goals, decision-maker).',
        fields=[
            ('Tenancy', 'multi-tenant (one row per tenant)'),
            ('Purpose', 'Used by superadmin /tenants/[id] snapshot and by onboarding flow.'),
            ('Key columns', 'industry, goals, decision_maker, acquisition_source, notes'),
        ])

    api['add_h2'](doc, '14.2  Booking pipeline (the heart)')

    api['add_data_sheet'](doc,
        title='bookings',
        subtitle='The central entity. Every transaction touches this.',
        fields=[
            ('Tenancy', 'multi-tenant (tenant_id NOT NULL, FK to tenants.id)'),
            ('Approx rows', '2000-5000 per tenant (depending on age)'),
            ('Status machine', [
                'pending_payment  →  confirmed (Stripe webhook)',
                'confirmed        →  delivered (driver marks all stops delivered)',
                'delivered        →  completed (admin marks, or 7 days post-event auto)',
                'any              →  cancelled (admin / customer / weather)',
            ]),
            ('Critical columns', [
                'id, tenant_id, customer_email, event_date, event_end_date',
                'product_id, product_name (snapshot for audit), surface_type, needs_power_supply',
                'booking_status, stripe_payment_status, stripe_payment_intent_id, hold_expires_at',
                'total_amount, coupon_code, discount_amount',
                'addons[] (jsonb), addons_total_cents',
                'damage_protection_purchased, damage_protection_cents',
                'gift_card_code, gift_card_amount_cents, tax_cents',
                'cancelled_due_to_weather, customer_confirmed_at',
                'delivery_checked_at, delivery_checked_by',
                'customer_phone_sms_consent_at (SMS compliance audit)',
            ]),
            ('Constraints', [
                'booking_status IN (pending_payment, confirmed, delivered, completed, cancelled)',
                'stripe_payment_status IN (pending, paid, refunded, failed)',
                'total_amount >= 0',
            ]),
            ('Indexes', 'tenant_id, customer_email, product_id, event_date, booking_status, created_at DESC'),
            ('RLS', 'tenant_isolation, staff_or_admin_manage, driver_or_above_read, service_role_all'),
            ('Trigger', 'bookings_updated_at (BEFORE UPDATE → set_updated_at())'),
        ])

    api['add_data_sheet'](doc,
        title='booking_expenses / booking_damages / booking_proofs / booking_waivers / booking_extensions / coi_requests',
        subtitle='Children of bookings. Inherit tenancy via FK.',
        fields=[
            ('Tenancy', 'CHILD-SCOPED — no tenant_id. Parent\'s RLS protects them.'),
            ('booking_expenses', 'Per-booking cost line items. Categories: gas, payroll, tolls, '
                                  'consumables, damage_repair, permit_fee, other. driver_hours + driver_email.'),
            ('booking_damages', 'Damage records. severity: minor|moderate|major. covered_by_protection '
                                 'flag for insurance claim drive.'),
            ('booking_proofs', 'Photos + signatures per booking phase. phase: delivery|pickup. '
                                'customer_signature_url, photos[] (jsonb), condition_notes.'),
            ('booking_waivers', 'Signed liability waivers. waiver_title_snapshot, waiver_text_snapshot '
                                 '(immutable — even if tenant later changes the waiver text, this row preserves '
                                 'the exact text the customer signed).'),
            ('booking_extensions', 'Rental extensions. original_end_date, new_end_date, additional_days, '
                                    'additional_amount_cents, stripe_payment_* (Stripe PI per extension).'),
            ('coi_requests', 'Certificate of insurance tracking. Status: requested→uploaded→delivered_to_venue.'),
        ])

    api['add_data_sheet'](doc,
        title='booking_inspections',
        subtitle='ERPNext-style checklists at delivery / pickup / spot-check.',
        fields=[
            ('Tenancy', 'multi-tenant'),
            ('Purpose', 'Capture pass/fail/skip + notes + photos per item on a template checklist.'),
            ('Key columns', [
                'tenant_id, booking_id, template_id (nullable — ad-hoc allowed)',
                'type: delivery | pickup | spot_check',
                'template_snapshot[] (jsonb — frozen at inspection time)',
                'items_result[] (jsonb — pass/fail/skip, notes, photo_urls per item)',
                'overall_status: pending | passed | failed | passed_with_issues',
            ]),
            ('Notable', 'template_snapshot is critical — operators can edit templates over time, '
                         'but each inspection retains the exact items checked.'),
        ])

    api['add_data_sheet'](doc,
        title='booking_internal_messages',
        subtitle='Team chat per booking (admin/staff/driver/system).',
        fields=[
            ('Tenancy', 'multi-tenant'),
            ('Key columns', [
                'tenant_id, booking_id, author_user_id, author_name (snapshot)',
                'author_role: admin | staff | driver | system',
                'body (1-4000 chars)',
                'mention_user_ids[] (array — @-mentions for notifications)',
                'deleted_at, edited_at (soft-delete + edit history)',
            ]),
            ('Notable', 'Drivers see only threads on bookings on their assigned routes (RLS).'),
        ])

    api['add_data_sheet'](doc,
        title='quotes',
        subtitle='Negotiable estimate. Convertible to booking.',
        fields=[
            ('Tenancy', 'multi-tenant'),
            ('Status machine', 'draft → sent → viewed → approved | declined → converted | expires after 14d'),
            ('Key columns', [
                'quote_number (unique per tenant — auto-incremented via next_quote_number())',
                'token (unique random — public link path)',
                'customer_*, event_date, event_end_date',
                'line_items[] (jsonb: [{product_id, name, qty, price_cents}])',
                'subtotal_cents, discount_cents, tax_cents, total_cents',
                'damage_protection_offered + cents + accepted',
                'waiver_required + signed_name + signed_at',
                'converted_booking_id (set when customer accepts)',
                'expires_at (default +14 days)',
                'created_by (uuid)',
            ]),
            ('Public access', 'Via token — no tenant context required (the token IS the auth).'),
        ])

    api['add_h2'](doc, '14.3  Customer + loyalty')

    api['add_data_sheet'](doc,
        title='customer_profiles',
        subtitle='Customer-account metadata. Auto-created on first booking.',
        fields=[
            ('Tenancy', 'multi-tenant (one row per customer per tenant)'),
            ('Key columns', [
                'user_id (PK — references auth.users)',
                'tenant_id (PK)',
                'referral_code (unique per tenant — generated via generate_referral_code())',
                'referred_by_user_id (nullable — chain of referrals)',
                'loyalty_points',
                'commission_pending_cents, commission_paid_cents',
                'w9_url, w9_tax_year, w9_uploaded_at',
            ]),
            ('Created via', 'ensure_customer_profile() function — idempotent. Called on first paid booking.'),
            ('RLS', 'admin_manage, tenant_isolation, customer_portal_self (customer sees own row only)'),
        ])

    api['add_data_sheet'](doc,
        title='customer_reviews',
        subtitle='Aggregated testimonials from Google + Facebook + manual.',
        fields=[
            ('Tenancy', 'multi-tenant'),
            ('Sources', 'google | facebook | yelp | instagram | email | manual'),
            ('Key columns', [
                'tenant_id, source, source_id (Google review id, etc.)',
                'customer_name, location, rating (1-5)',
                'review_text, photo_url',
                'reviewed_at',
                'is_active, is_featured (pinned), sort_order',
            ]),
            ('RLS', 'public_read_active, staff_or_admin_manage'),
        ])

    api['add_data_sheet'](doc,
        title='loyalty_transactions',
        subtitle='Immutable points + commission ledger.',
        fields=[
            ('Tenancy', 'multi-tenant'),
            ('type values', [
                'booking_points (awarded on payment)',
                'referral_commission (awarded when referred user pays)',
                'points_redeemed (customer used points in checkout)',
                'commission_payout (paid out via /admin/loyalty)',
                'admin_adjustment (manual operator correction)',
            ]),
            ('Notable', 'Never delete — append-only ledger. Audit trail for both customer (points) '
                         'and 1099 reporting (commissions paid).'),
        ])

    api['add_h2'](doc, '14.4  Catalog')

    api['add_data_sheet'](doc,
        title='products',
        subtitle='What the tenant rents out.',
        fields=[
            ('Tenancy', 'multi-tenant'),
            ('Approx rows', '50-500 per tenant'),
            ('Critical columns', [
                'id, tenant_id, slug (unique per tenant), name',
                'category (FK → categories.slug)',
                'price_per_day, weekend_price_per_day, cost_cents',
                'stock (concurrent units available)',
                'is_addon, tax_exempt, is_active, is_featured',
                'setup_area, actual_size, outlets_required, age_group',
                'description, image_url',
            ]),
            ('Important note', 'cost_cents is acquisition cost — NEVER exposed to public. Used only '
                                'in admin reports (P&L, margin analysis).'),
            ('RLS', 'public_read_active (is_active=true), tenant_isolation, staff_or_admin_manage'),
        ])

    api['add_data_sheet'](doc,
        title='categories / packages / setup_surfaces',
        subtitle='Catalog taxonomy + bundle SKUs.',
        fields=[
            ('categories', 'Product taxonomy. (tenant_id, slug) unique. is_active controls visibility.'),
            ('packages', 'Curated bundles. items[] jsonb: [{product_id, product_name, quantity}].'),
            ('setup_surfaces', 'Allowed setup locations (Grass, Concrete, Indoors). Per-tenant.'),
        ])

    api['add_data_sheet'](doc,
        title='product_inventory_requirements',
        subtitle='Links products → required inventory items.',
        fields=[
            ('Tenancy', 'CHILD-SCOPED (inherits via product FK)'),
            ('Purpose', 'When a product is dispatched, what support inventory must come along?'),
            ('Key columns', [
                'product_id, inventory_item_id, quantity',
                'surface_types[] (only required for certain surfaces)',
                'only_when_needs_power (skip if customer has power)',
                'per_day (if true: qty *= rental_days — for consumables like propane)',
            ]),
        ])

    api['add_h2'](doc, '14.5  Inventory & fleet')

    api['add_data_sheet'](doc,
        title='inventory_items / inventory_units / inventory_unit_movements',
        subtitle='Support material catalog with optional per-unit tracking.',
        fields=[
            ('inventory_items', [
                'name, category, quantity_owned, quantity_in_use',
                'tracks_units (bool — turns on per-unit tracking)',
                'unit_tag_prefix (e.g. "BLOWER" → BLOWER001..)',
                'condition: good | needs_repair | broken | retired',
                'low_stock_threshold, low_stock_alerted_at',
                'purchase_cost_cents, purchase_date, last_maintenance_date',
            ]),
            ('inventory_units', [
                'When tracks_units = true, individual units tracked',
                'tag (unique per item), serial_number',
                'current_state: warehouse | loading | on_truck | at_customer | returning | maintenance | retired',
                'current_booking_id, state_changed_at',
                'acquired_date, retired_at',
            ]),
            ('inventory_unit_movements', [
                'Immutable audit log for state changes',
                'inventory_unit_id, from_state, to_state',
                'booking_id, route_id (context)',
                'performed_by_user_id, performed_by_name (snapshot)',
                'occurred_at, notes',
            ]),
        ])

    api['add_data_sheet'](doc,
        title='vehicles / trailers',
        subtitle='Dispatch fleet.',
        fields=[
            ('Tenancy', 'multi-tenant'),
            ('Key columns', [
                'name, vehicle_type: truck | van | pickup | other',
                'vin, license_tag, capacity_notes',
                'compatible_inventory_item_ids[] (which inventory items fit this vehicle)',
                'assigned_driver_id (auth.users — drives the driver app RLS)',
            ]),
        ])

    api['add_h2'](doc, '14.6  Dispatch')

    api['add_data_sheet'](doc,
        title='dispatch_routes / dispatch_stops / dispatch_route_units',
        subtitle='Daily delivery + pickup routes.',
        fields=[
            ('dispatch_routes', [
                'route_date, vehicle_id, trailer_id',
                'route_type: delivery | pickup',
                'driver_name (snapshot)',
                'status: planned | loaded | out | completed | cancelled',
                'notes',
            ]),
            ('dispatch_stops', [
                'route_id, booking_id, stop_order',
                'delivered_at, notes',
                'tenant_id (denormalized — for direct RLS without join)',
            ]),
            ('dispatch_route_units', [
                'Tracks which inventory_units went on which route',
                'returned_at, return_condition: good | needs_repair | broken',
                'return_note',
            ]),
        ])

    api['add_h2'](doc, '14.7  Configuration tables (12)')

    api['add_p'](doc,
        'These are key-value or templated config stores per tenant:')

    api['add_kv_table'](doc,
        ['Table', 'Purpose'],
        [
            ('site_settings', 'Generic key/value config (tax_rate, lead_time, timezone, '
                               'damage_protection_enabled, sms_*, points_*, business_hours, '
                               'require_admin_mfa added 2026-06-17, etc.)'),
            ('email_templates', 'Per-tenant transactional email + SMS template overrides. Falls back to '
                                 'hardcoded defaults. Variables substituted at send time.'),
            ('home_banners', 'Hero image rotation on public home page.'),
            ('faqs', 'Public FAQ list. display_order, is_active.'),
            ('coupons', 'Discount codes. discount_type: percent|fixed|overnight_free. max_uses, '
                         'current_uses, expires_at, referrer_user_id (referral attribution).'),
            ('tenant_api_keys', 'rfk_* programmatic v1 keys. key_hash bcrypt, scopes[], last_used_*, '
                                 'expires_at, revoked_at + revoked_reason.'),
            ('tenant_webhooks', 'Outbound webhook registrations. events[], secret (for HMAC), '
                                 'last_delivery_*, total_deliveries, failed_deliveries.'),
            ('google_business_connections', 'OAuth2 token store for Google Business Profile per tenant. '
                                              'access_token + refresh_token encrypted.'),
            ('tenant_goals', 'KPI targets — bookings/month, revenue, etc.'),
            ('tenant_home_sections', 'Configurable home-page layout (hero, featured_products, testimonials, '
                                       'faq, etc.). is_enabled toggle per section.'),
            ('tenant_onboarding_checklist', 'Setup progress tracking. item_key + is_completed + completed_at.'),
            ('tenant_operator_notes', 'Internal CRM-lite for Ludmila — notes about each tenant for '
                                        'follow-ups, observed issues, upsell.'),
            ('admin_audit_log', 'Immutable log of admin actions. Indexed by user_email, action, '
                                  'entity_type+id.'),
            ('custom_reports', 'User-defined reports — definition jsonb, is_favorite, last_viewed_at.'),
        ],
        col_widths=[2.0, 5.1])

    api['add_h2'](doc, '14.8  Superadmin tables')

    api['add_kv_table'](doc,
        ['Table', 'Purpose'],
        [
            ('support_tickets', 'AI-assisted triage. ai_category, ai_priority, ai_suggested_article_id, '
                                  'ai_suggested_response, ai_confidence.'),
            ('kb_articles', 'Knowledge base (slug, title, body_md). view_count, helpful_count, '
                              'unhelpful_count, ai_resolved_count.'),
            ('email_accounts', 'IMAP/SMTP credentials for the unified inbox. encrypted_password, '
                                'last_sync_*, consecutive_failures.'),
            ('email_threads / email_messages / email_folders', 'IMAP-backed inbox storage.'),
            ('email_rules', 'Per-account auto-actions on incoming mail (label, archive, mark read).'),
        ],
        col_widths=[2.5, 4.6])

    api['add_h2'](doc, '14.9  Utility tables')

    api['add_kv_table'](doc,
        ['Table', 'Purpose'],
        [
            ('google_places_cache', 'Per-tenant cache of Google Places API response. place_id, reviews '
                                      'jsonb, last_synced_at.'),
            ('portal_otp_codes', 'One-time codes for customer portal login (replaces Supabase magic '
                                   'links). code_hash, expires_at, attempts.'),
            ('booking_emails_sent', 'Idempotency ledger for transactional emails. (booking_id, '
                                       'email_type) UNIQUE.'),
            ('webhook_deliveries', 'Outbound webhook attempt log. attempt_count, succeeded, '
                                      'next_retry_at, response_status, response_body.'),
            ('blocked_dates', 'Blackouts per product. blocked_date, reason, created_by.'),
        ],
        col_widths=[2.5, 4.6])

    api['add_h2'](doc, '14.10  SQL helper functions (selected)')

    api['add_kv_table'](doc,
        ['Function', 'Returns', 'Used for'],
        [
            ('is_admin(uid)',           'bool', 'Admin-only RLS gates'),
            ('is_staff_or_admin(uid)',  'bool', 'Standard admin policy'),
            ('is_driver_or_above(uid)', 'bool', 'Dispatch + inspections + driver app'),
            ('is_superadmin(uid)',      'bool', 'Platform-wide bypass (Ludmila)'),
            ('current_tenant_id()',     'uuid', 'coalesce(user_roles.tenant_id, header x-tenant-id)'),
            ('generate_referral_code()', 'text', 'Unique alphanumeric referral code'),
            ('generate_gift_card_code()', 'text', 'GC-XXXXX pattern'),
            ('generate_inventory_units(item_id, count, prefix)', 'void',
             'Bulk-create N inventory_units rows with sequential tags'),
            ('next_quote_number(tenant_id)', 'int', 'Per-tenant quote number sequencer'),
            ('new_quote_token()',        'text', 'Random base64 token for public quote links'),
            ('ensure_customer_profile(uid, tenant_id)', 'void', 'Idempotent — call on first booking'),
            ('seed_default_email_templates(tenant_id)', 'void', 'Tenant signup hook'),
            ('seed_default_site_settings(tenant_id)', 'void', 'Tenant signup hook'),
        ],
        col_widths=[2.5, 0.8, 3.8])
