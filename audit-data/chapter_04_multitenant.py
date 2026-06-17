"""Chapter 4 — Multi-tenant architecture. The single most important design topic."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 4, 'Multi-Tenant Architecture',
        'How one codebase serves 10+ businesses without ever leaking data between them.',
        audience_tags=['Engineer', 'Acquirer', 'Security'])

    api['add_callout'](doc, 'fact',
        'Multi-tenancy is the single most important architectural commitment. Every other '
        'design decision — from middleware to RLS to the scope.ts proxy — flows from it. The '
        '2026-06-10 internal audit closed 3 critical + 2 high + 6 medium gaps and removed the '
        'DEFAULT tenant_id safety net, converting silent leaks into loud NOT NULL violations.')

    api['add_h2'](doc, '4.1  Tenant identity')

    api['add_p'](doc,
        'Each customer of the platform is a row in the tenants table. Every row has both a '
        'subdomain slug and (optionally) a custom domain. Tenant identity is the foundation '
        'on which everything else builds — branding, billing, access control, data isolation.')

    api['add_kv_table'](doc,
        ['Field', 'Type', 'Purpose'],
        [
            ('id', 'uuid PK', 'Referenced by every multi-tenant table\'s tenant_id column'),
            ('slug', 'text unique', 'URL-safe identifier. Used for subdomain: slug.getrentalflow.com'),
            ('business_name', 'text', 'Display name (email From headers, header logo alt, etc.)'),
            ('custom_domain', 'text nullable', 'Optional vanity domain (itsalwaysfun.com)'),
            ('stripe_customer_id', 'text', 'Tenant\'s subscription billing identifier on the platform'),
            ('stripe_account_id', 'text', 'Stripe Connect account that receives end-customer payments'),
            ('subscription_status', 'enum', 'trialing / active / past_due / canceled / unpaid / paused'),
            ('timezone', 'text', 'Tenant time zone (date calculations, cron windowing)'),
            ('owner_email', 'text', 'Primary contact; fallback Reply-To when inbox not configured'),
            ('notification_email', 'text', 'Where booking + system alerts go'),
            ('inbox_enabled', 'bool', 'Switches email From to bookings@custom_domain'),
            ('branding fields', 'various', 'Logo URL, accent color, font, hero image, social links'),
        ],
        col_widths=[1.8, 1.5, 3.8])

    api['add_h2'](doc, '4.2  Resolution: hostname → tenant_id')

    api['add_mono_block'](doc, """
   Browser request:  https://itsalwaysfun.com/admin/dashboard
                                │
                                ▼
   middleware.ts (Vercel Edge — runs first on every request)
                                │
                                ▼
   resolveTenantByHostname('itsalwaysfun.com')
                                │
                                ▼
   SELECT id, slug, business_name, ...
   FROM   tenants
   WHERE  custom_domain = 'itsalwaysfun.com'
      OR  slug = 'itsalwaysfun'
   LIMIT  1
                                │
                                ▼  (cached in middleware-local LRU for ~30s)
   tenant.id   = '11111111-1111-...'   ──┐
   tenant.slug = 'iaf'                   ├── injected as request headers:
   tenant.resolved_via = 'custom_domain' ─┘    x-tenant-id
                                              x-tenant-slug
                                              x-tenant-via
                                │
                                ▼
   Downstream (Server Component / Server Action / API Route)
                                │
                                ▼
   import { headers } from 'next/headers'
   const tid = headers().get('x-tenant-id')
                                │
                                ▼
   createAdminClient()  ─►  Supabase client + scopeToTenant(tid) PROXY
""", title='From hostname to tenant-scoped database client in 6 hops')

    api['add_h2'](doc, '4.3  The scope.ts proxy — auto-scoping in one place')

    api['add_p'](doc,
        'The proxy wraps the Supabase client. On every query against a table in '
        'MULTI_TENANT_TABLES, it transparently:')

    api['add_bullet'](doc, 'adds .eq("tenant_id", current_tenant_id) to SELECT, UPDATE, DELETE')
    api['add_bullet'](doc, 'injects tenant_id on INSERT and UPSERT')
    api['add_bullet'](doc, 'leaves child tables alone — they inherit tenancy via parent FK')
    api['add_bullet'](doc, 'allows explicit opt-out via createAdminClient({ unscoped: true }) for '
                            'superadmin platform-wide operations')

    api['add_callout'](doc, 'info',
        'The proxy is implemented in lib/tenant/scope.ts — about 200 lines of TypeScript. It is '
        'the single piece of code that absolutely must not break. The 2026-06-10 audit '
        'recommends a CI step (check:scope) that introspects the live schema and asserts every '
        'table with a tenant_id column is in MULTI_TENANT_TABLES.')

    api['add_h2'](doc, '4.4  The MULTI_TENANT_TABLES set (43 tables, auto-scoped)')

    cats = [
        ('Customer + booking lifecycle (16)',
         ['bookings', 'dispatch_routes', 'dispatch_stops', 'customer_profiles', 'gift_cards',
          'gift_card_purchases', 'gift_card_redemptions', 'quotes', 'payout_requests',
          'contact_messages', 'customer_reviews', 'loyalty_transactions',
          'booking_inspections', 'booking_internal_messages', 'inspection_templates', 'portal_otp_codes']),
        ('Catalog + inventory (10)',
         ['products', 'categories', 'packages', 'setup_surfaces', 'inventory_items',
          'inventory_categories', 'inventory_unit_movements', 'vehicles', 'trailers', 'coupons']),
        ('Accounting (3)',
         ['overhead_costs', 'overhead_categories', 'driver_tax_profiles']),
        ('Configuration (12)',
         ['site_settings', 'email_templates', 'home_banners', 'faqs', 'user_roles',
          'customer_tags', 'campaigns', 'tenant_api_keys', 'tenant_webhooks', 'custom_reports',
          'google_business_connections', 'tenant_goals']),
        ('Operator state (5)',
         ['tenant_home_sections', 'tenant_onboarding_checklist', 'tenant_operator_notes',
          'admin_audit_log', 'support_tickets']),
        ('Cache (2)',
         ['google_places_cache', 'tenant_profile']),
    ]
    for title, tables in cats:
        api['add_h4'](doc, title)
        api['add_p'](doc, ', '.join(tables), color=P['INK'], size=10)

    api['add_h2'](doc, '4.5  Intentionally NOT scoped — INHERIT via parent FK (14 tables)')

    api['add_p'](doc,
        'These tables inherit tenancy from their parent. They have no tenant_id column. '
        'The proxy is explicitly told not to scope them — otherwise PostgREST would reject '
        'the insert with "unknown field tenant_id".')

    api['add_kv_table'](doc,
        ['Child table', 'Inherits from', 'Why no tenant_id'],
        [
            ('booking_expenses', 'bookings', 'Cost items per booking — parent owns tenancy'),
            ('booking_damages', 'bookings', 'Damage records per booking'),
            ('booking_proofs', 'bookings', 'Photos + signatures per booking phase'),
            ('booking_waivers', 'bookings', 'Signed liability waivers'),
            ('booking_extensions', 'bookings', 'Rental extensions'),
            ('coi_requests', 'bookings', 'Certificate of insurance requests'),
            ('booking_expense_categories', 'tenant via FK chain', 'Lookup table for expenses'),
            ('product_inventory_requirements', 'products', 'Links product → inventory item'),
            ('product_images', 'products', 'Photo gallery per product'),
            ('inventory_units', 'inventory_items', 'Individual tracked units (BLOWER001..)'),
            ('contact_message_replies', 'contact_messages', 'Admin reply thread'),
            ('campaign_recipients', 'campaigns', 'Per-recipient delivery records'),
            ('google_business_reviews', 'placeholder', 'Not yet used'),
            ('google_business_posts', 'placeholder', 'Not yet used'),
        ],
        col_widths=[2.0, 1.8, 3.3])

    api['add_h2'](doc, '4.6  RLS — the second wall')

    api['add_p'](doc,
        'Even if scope.ts were bypassed (e.g. service-role key used incorrectly), Supabase Row-'
        'Level Security policies on every multi-tenant table prevent cross-tenant access. There '
        'are 197 policies live, grouped into 5 recurring idioms:')

    api['add_kv_table'](doc,
        ['Pattern', 'Count', 'SQL shape'],
        [
            ('tenant_isolation', '~80',
             'USING (tenant_id = current_tenant_id() OR is_superadmin(auth.uid()))'),
            ('staff_or_admin_manage', '~40',
             'USING (is_staff_or_admin(auth.uid()))'),
            ('driver_or_above_read_update', '~15',
             'USING (is_driver_or_above(auth.uid()))'),
            ('public_read_active', '~10',
             'USING (is_active = true)  -- for products, categories, faqs, reviews, banners'),
            ('service_role_all', '~10',
             'USING (true)  -- server-only operations bypass'),
        ],
        col_widths=[2.3, 0.7, 4.1])

    api['add_h2'](doc, '4.7  OBS-2 — the load-bearing migration')

    api['add_callout'](doc, 'good',
        'Originally, every multi-tenant table had tenant_id DEFAULT \'11111111-...\' (the IAF UUID). '
        'This was a transitional safety net. The 2026-06-10 audit shipped drop_default_tenant_id.sql '
        'which removes the DEFAULT — any code path that forgets to set tenant_id now throws a '
        'NOT NULL violation immediately. Loud failure is the right design.')

    api['add_h2'](doc, '4.8  Open: OBS-1 (auto-derive from schema)')

    api['add_callout'](doc, 'warn',
        'The current process requires a developer to manually add new tables to MULTI_TENANT_TABLES '
        'in lib/tenant/scope.ts. The recommended fix is a CI step (scripts/check-tenant-scope.ts) '
        'that compares the set against the live schema. The script already exists; wiring it into '
        'GitHub Actions is on the 30-day recommendation list (Chapter 19).')

    api['add_h2'](doc, '4.9  Authorization helpers')

    api['add_kv_table'](doc,
        ['SQL function', 'Returns', 'Used in'],
        [
            ('is_admin(uid)', 'bool', 'Admin-only RLS policies (settings, billing, payments)'),
            ('is_staff_or_admin(uid)', 'bool', 'Most admin-panel policies'),
            ('is_driver_or_above(uid)', 'bool', 'Dispatch + inspections + driver app'),
            ('is_superadmin(uid)', 'bool', 'Platform-wide bypass (Ludmila only)'),
            ('current_tenant_id()', 'uuid',
             'coalesce(user_roles.tenant_id, request.header.x-tenant-id)'),
        ],
        col_widths=[2.4, 0.8, 4.0])

    api['add_p'](doc, 'These SQL functions are the single source of truth for "who can do what". '
                       'They are referenced from 130+ RLS policies and from every server action that '
                       'calls requireXxx() helpers in lib/auth/roles.ts.')
