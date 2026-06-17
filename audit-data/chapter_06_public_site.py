"""Chapter 6 — Public Tenant Site. 14 customer-facing pages, page-by-page."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 6, 'Public Tenant Site',
        'Every page a paying customer can hit on itsalwaysfun.com (or any tenant subdomain).',
        audience_tags=['Owner', 'Operations', 'Engineer'])

    api['add_callout'](doc, 'fact',
        '14 public pages — catalog browse + product detail + 5-step booking wizard + '
        'gift cards + reviews + contact + legal info pages. None require auth. All are '
        'tenant-scoped by hostname.')

    api['add_h2'](doc, '6.1  The public surface at a glance')

    api['add_kv_table'](doc,
        ['Path', 'Purpose', 'Auth'],
        [
            ('/',                       'Tenant home page (hero, featured products, testimonials, FAQ)', 'none'),
            ('/rentals',                'Full product catalog grid + category filter', 'none'),
            ('/category/[category]',    'Catalog filtered to one category', 'none'),
            ('/items/[slug]',           'Product detail page (gallery, calendar, add-to-cart)', 'none'),
            ('/packages',               'Curated multi-product bundle offers', 'none'),
            ('/order-by-date',          '5-step booking wizard (the hot path)', 'none'),
            ('/gift-cards',             'Purchase gift cards', 'none'),
            ('/reviews',                'Aggregated testimonials (Google + Facebook + manual)', 'none'),
            ('/contact',                'Contact form → 3-redundant submission', 'none'),
            ('/info',                   'Hub of legal / policy pages', 'none'),
            ('/info/faqs',              'Public FAQ list', 'none'),
            ('/info/policies',          'Rental policies', 'none'),
            ('/info/waiver',            'Liability waiver text', 'none'),
            ('/info/privacy-policy',    'Privacy policy', 'none'),
            ('/info/terms-of-service',  'Terms of service', 'none'),
            ('/app',                    'Driver PWA install promo (cross-functional)', 'none'),
        ],
        col_widths=[2.2, 4.0, 0.8])

    api['add_h2'](doc, '6.2  Page data sheets')

    api['add_data_sheet'](doc,
        title='/  — Tenant home page',
        subtitle='First impression — branded landing with hero, featured products, social proof.',
        fields=[
            ('Purpose', 'Hero + value prop + featured-product grid + testimonials + FAQ + booking CTA.'),
            ('UI elements', [
                'Configurable hero (image, headline, CTA from tenant_home_sections)',
                'Featured products grid (admin-pinned via products.is_featured)',
                'Recent testimonials (top 3-6 from customer_reviews where is_featured=true)',
                'FAQ accordion (rendered from faqs table)',
                'Footer with business contact info (from site_settings)',
            ]),
            ('Data tables', 'tenants, tenant_home_sections, products, customer_reviews, faqs, site_settings'),
            ('External effects', 'None — read-only landing page.'),
            ('Notable', 'Sections individually toggleable via tenant_home_sections.is_enabled. '
                         'Operator chooses layout in /admin/site.'),
        ])

    api['add_data_sheet'](doc,
        title='/rentals  — Full catalog',
        subtitle='The "what do you have?" page. Filterable, sortable, no auth needed.',
        fields=[
            ('Purpose', 'Browse every active, non-addon product. Filterable by category tabs.'),
            ('UI elements', [
                'Category pill tabs (All + each active category)',
                'Product card grid (image, name, short description, price/day)',
                'Each card links to /items/[slug] (product detail)',
            ]),
            ('Data tables', 'products WHERE is_active=true AND is_addon=false, categories'),
            ('Notable', 'Sort order: products.display_order ASC, then name. No paywall on stock — '
                         'shows even when low/out (the wizard surfaces unavailability).'),
        ])

    api['add_data_sheet'](doc,
        title='/category/[category]',
        subtitle='Category-filtered catalog landing.',
        fields=[
            ('Purpose', 'SEO-friendly per-category landing.'),
            ('UI elements', 'Category hero (name + description), filtered product grid, "Back to all rentals" link.'),
            ('Data tables', 'categories (by slug), products (joined by category_slug)'),
            ('Business rules', 'Returns 404 if category not found OR is_active=false.'),
            ('Notable', 'If categories.is_active=false the slug is unreachable — admin can hide a '
                         'category without deleting it.'),
        ])

    api['add_data_sheet'](doc,
        title='/items/[slug]  — Product detail',
        subtitle='Hero of every category. Customer decides here.',
        fields=[
            ('Purpose', 'Photo gallery + description + availability calendar + price + "Book now" CTA.'),
            ('UI elements', [
                'Image gallery carousel (product_images)',
                'Description, dimensions, age group, surface requirements',
                'Per-product availability calendar (unavailable dates dim/blocked)',
                '"Book now" → /order-by-date with product prefilled',
                'Related products at bottom (same category)',
            ]),
            ('Data tables', 'products, product_images, bookings (for unavailable dates)'),
            ('Business rules', [
                'Unavailable dates = paid bookings (confirmed/delivered) where stock fully consumed',
                'Pending_payment holds DO NOT block (they expire in 15 min)',
                'Returns 404 if product not active or wrong tenant',
            ]),
            ('API calls', 'GET /api/products/[slug] — returns unavailable_dates for next 90 days.'),
            ('Notable', 'Calendar pre-warms wizard data. Click "Book now" → /order-by-date prefilled.'),
        ])

    api['add_data_sheet'](doc,
        title='/packages',
        subtitle='Bundle offers — curated multi-product SKUs with savings.',
        fields=[
            ('Purpose', 'Sell pre-built combos (e.g. "Birthday Party Bundle" — bounce house + tables + chairs).'),
            ('UI elements', [
                'Package cards: image, name, items list with qty, total price, savings % vs à la carte',
                '"Call us for custom bundles" CTA if packages section disabled by tenant',
            ]),
            ('Data tables', 'packages WHERE is_active=true; items[] resolves into products for pricing.'),
            ('Notable', 'Operator builds packages in /admin/packages/new — saved as JSON items array.'),
        ])

    api['add_data_sheet'](doc,
        title='/gift-cards',
        subtitle='Self-serve gift card purchase — instant email delivery to recipient.',
        fields=[
            ('Purpose', 'Customer enters amount, recipient details, pays via Stripe → recipient gets code via email + SMS.'),
            ('UI elements', [
                'Hero + perks (any amount, instant delivery, never expires)',
                'Purchase form: amount, recipient name/email, optional message, optional delivery date',
                'Stripe PaymentElement embedded',
            ]),
            ('Business rules', [
                'Amount range: $10 - $10,000',
                'If Stripe not configured OR gift card sales disabled → form replaced with "Call us" message',
                'Optional scheduled delivery (delivered_at)',
            ]),
            ('API calls', [
                'POST /api/gift-cards/purchase → creates pending purchase + Stripe PaymentIntent',
                'Stripe webhook → marks paid → generates code → emails recipient + purchaser → SMS recipient',
            ]),
            ('External effects', 'Resend email × 2 (recipient + purchaser), Twilio SMS if recipient phone provided.'),
        ])

    api['add_data_sheet'](doc,
        title='/reviews',
        subtitle='Aggregated testimonials — public-facing social proof.',
        fields=[
            ('Purpose', 'Display all customer_reviews across sources (Google, Facebook, Yelp, Instagram, manual).'),
            ('UI elements', [
                'Average rating + total count at top',
                '"Leave a Google review" CTA (links to site_settings.google_review_url)',
                'Review cards: avatar, name, location, source icon, date, rating stars, text',
            ]),
            ('Data tables', 'customer_reviews WHERE is_active=true ORDER BY is_featured DESC, sort_order, reviewed_at DESC'),
            ('Business rules', 'Featured reviews pinned to top. Daily cron google-places-sync ingests new Google reviews.'),
            ('Notable', 'Google review URL configurable per tenant (each business has its own GBP listing).'),
        ])

    api['add_data_sheet'](doc,
        title='/contact',
        subtitle='Contact form + business info. Highest-conversion micro-page.',
        fields=[
            ('Purpose', 'Capture inbound non-booking inquiries.'),
            ('UI elements', [
                'Contact info cards (phone, email, service area, business hours)',
                'Form: first/last name, email, phone, message, subject',
            ]),
            ('API calls', 'POST /api/contact'),
            ('Business rules', 'Rate-limited 5 submissions per 5 minutes per IP via Upstash.'),
            ('External effects', [
                'INSERT into contact_messages (source of truth)',
                'Send Resend email to ADMIN_ALERT_EMAIL (or tenant.notification_email)',
                'Fire GHL webhook (non-blocking — failures stored in ghl_webhook_error column)',
            ]),
            ('Notable', 'Triple-redundant: DB row is canonical, email+GHL are alerts. /admin/inbox '
                         'is where the operator reads + replies (creates contact_message_replies row).'),
        ])

    api['add_data_sheet'](doc,
        title='/info/* — Legal and policy pages',
        subtitle='Required compliance disclosures, editable from /admin/site.',
        fields=[
            ('Pages', '/info (hub), /info/faqs, /info/policies, /info/waiver, /info/privacy-policy, /info/terms-of-service'),
            ('Data source', 'site_settings (per-key text), faqs table for /info/faqs.'),
            ('Business rules', 'Waiver text is the same shown in BookingWizard before e-signature.'),
            ('Notable', 'Plain-text editable in /admin/site. No rich-text editor — keeps audit trail '
                         'simple and prevents accidental HTML injection.'),
        ])

    api['add_data_sheet'](doc,
        title='/app  — Driver PWA install promotion',
        subtitle='Help drivers get the PWA installed on their phone.',
        fields=[
            ('Purpose', 'A landing page explaining the driver app, with install CTA.'),
            ('UI elements', [
                '6 feature cards (routes at a glance, works offline, faster than browser, '
                'capture proof+signature, tap to navigate, real-time updates)',
                'Install button triggers PWA install prompt (Android) or shows iOS instructions',
                '"Need help? Call us" fallback',
            ]),
            ('Notable', 'Cross-functional page — links from /admin/users when an operator invites a driver.'),
        ])

    api['add_h2'](doc, '6.3  Performance + caching observations')

    api['add_bullet'](doc, 'All public pages are React Server Components — almost no JS shipped to '
                            'browser. Average page weight: ~50KB gzipped excluding images.')
    api['add_bullet'](doc, 'GET /api/products/[slug] caches for 60s — repeat date-picker interactions '
                            'on the same product hit the cache.')
    api['add_bullet'](doc, 'Images served via Vercel image optimizer (next/image + sharp).')
    api['add_bullet'](doc, 'Tenant resolution caches ~30s in middleware-local LRU — repeat requests '
                            'from the same browser don\'t re-query the tenants table.')

    api['add_callout'](doc, 'info',
        'No CDN-level full-page cache today — every request hits the function. For a tenant '
        'with high catalog browsing traffic (>10 req/s sustained) this would become the next '
        'optimization. Worth measuring before adding complexity.')
