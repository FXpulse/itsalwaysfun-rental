"""Build a comprehensive RentalFlow technical audit Word document.

Run: python scripts/build_audit_doc.py
Outputs: ./RentalFlow_Technical_Audit.docx
"""

from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from datetime import date

NAVY = RGBColor(0x1A, 0x1A, 0x6E)
GOLD = RGBColor(0xFF, 0xD7, 0x00)
GRAY = RGBColor(0x4B, 0x4B, 0x4B)
GREEN = RGBColor(0x0E, 0x7C, 0x4A)
AMBER = RGBColor(0xB4, 0x73, 0x0C)
RED   = RGBColor(0xB3, 0x26, 0x1A)


def set_style(doc):
    style = doc.styles['Normal']
    style.font.name = 'Calibri'
    style.font.size = Pt(11)
    style.font.color.rgb = GRAY

    for h, size in (('Heading 1', 22), ('Heading 2', 16), ('Heading 3', 13)):
        s = doc.styles[h]
        s.font.name = 'Calibri'
        s.font.color.rgb = NAVY
        s.font.size = Pt(size)
        s.font.bold = True


def add_cover(doc):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run('\n\n\n\nRentalFlow / It\'s Always Fun')
    r.font.size = Pt(36)
    r.font.bold = True
    r.font.color.rgb = NAVY

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run('Technical Audit & Architecture Review')
    r.font.size = Pt(22)
    r.font.color.rgb = GRAY

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run('\n\nMulti-tenant SaaS for Rental Management')
    r.font.size = Pt(14)
    r.italic = True
    r.font.color.rgb = GRAY

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run('\n\n\n\n\nPrepared ' + date.today().strftime('%B %d, %Y'))
    r.font.size = Pt(12)
    r.font.color.rgb = GRAY

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run('\nScope: Full system audit — features, architecture, data, integrations, security, operational concerns, technical debt, recommendations.')
    r.font.size = Pt(11)
    r.italic = True
    r.font.color.rgb = GRAY

    doc.add_page_break()


def add_h1(doc, text):
    h = doc.add_heading(text, level=1)
    return h


def add_h2(doc, text):
    h = doc.add_heading(text, level=2)
    return h


def add_h3(doc, text):
    h = doc.add_heading(text, level=3)
    return h


def add_p(doc, text, bold=False, italic=False, color=None, size=None):
    p = doc.add_paragraph()
    r = p.add_run(text)
    if bold: r.bold = True
    if italic: r.italic = True
    if color: r.font.color.rgb = color
    if size: r.font.size = Pt(size)
    return p


def add_bullet(doc, text, level=0):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.left_indent = Inches(0.25 + (level * 0.25))
    if isinstance(text, list):
        # text = [(plain, bold?), ...] tuples
        for chunk, is_bold in text:
            r = p.add_run(chunk)
            r.bold = is_bold
    else:
        p.add_run(text)
    return p


def add_table(doc, headers, rows, col_widths=None):
    tbl = doc.add_table(rows=1, cols=len(headers))
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.style = 'Light Grid Accent 1'
    hdr = tbl.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = ''
        p = hdr[i].paragraphs[0]
        r = p.add_run(h)
        r.bold = True
        r.font.color.rgb = NAVY
        r.font.size = Pt(10)
    for row in rows:
        row_cells = tbl.add_row().cells
        for i, val in enumerate(row):
            row_cells[i].text = ''
            p = row_cells[i].paragraphs[0]
            r = p.add_run(str(val))
            r.font.size = Pt(10)
    if col_widths:
        for row in tbl.rows:
            for i, w in enumerate(col_widths):
                row.cells[i].width = Inches(w)
    return tbl


def add_callout(doc, kind, text):
    """Add a styled callout box (info/warn/risk)."""
    color = {'info': NAVY, 'warn': AMBER, 'risk': RED, 'good': GREEN}.get(kind, GRAY)
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(0.2)
    label = {'info': '[i]', 'warn': '[!]', 'risk': '[X]', 'good': '[OK]'}.get(kind, '[>]')
    r = p.add_run(f'{label} ')
    r.bold = True
    r.font.color.rgb = color
    p.add_run(text)
    return p


def build_doc():
    doc = Document()
    set_style(doc)

    # ============ COVER ============
    add_cover(doc)

    # ============ TABLE OF CONTENTS ============
    add_h1(doc, 'Table of Contents')
    toc_entries = [
        '1. Executive Summary',
        '2. System Overview',
        '3. Technology Stack',
        '4. Multi-Tenant Architecture',
        '5. Public Surface — Marketing & Booking',
        '6. Customer Portal',
        '7. Admin Panel (per-tenant)',
        '8. Superadmin Platform',
        '9. Driver App',
        '10. API Layer',
        '11. Background Jobs (Cron)',
        '12. Data Layer & Schema',
        '13. Integrations',
        '14. Security Audit',
        '15. Multi-Tenant Audit',
        '16. Operational Concerns',
        '17. Technical Debt',
        '18. Prioritized Recommendations',
        '19. Appendix — File Inventory',
    ]
    for entry in toc_entries:
        add_bullet(doc, entry)

    doc.add_page_break()

    # ============ 1. EXECUTIVE SUMMARY ============
    add_h1(doc, '1. Executive Summary')

    add_p(doc, 'RentalFlow is a mature, multi-tenant SaaS platform for rental businesses. The flagship customer — It\'s Always Fun, LLC (IAF) — operates an inflatable rental business in Jacksonville, FL using the platform at itsalwaysfun.com. The same codebase serves all other tenant subdomains at *.getrentalflow.com plus any custom domain mapped to the platform.')

    add_p(doc, 'This document is a full technical audit covering:')
    for item in [
        'Architecture and technology choices',
        'Every customer-facing, admin, superadmin, and driver surface',
        'API contract (public + admin + programmatic v1 + webhooks)',
        '13 scheduled background jobs',
        'Data layer of 138 SQL migrations + 56 multi-tenant tables',
        'Eight third-party integrations (Stripe, GHL, Twilio, Resend, Supabase, Sentry, AWS S3, Upstash)',
        'Security posture (RLS, auth, key management)',
        'Multi-tenant isolation model (proxy-based auto-scoping)',
        'Technical debt inventory and known TODOs',
        'Prioritized recommendations for the next quarter',
    ]:
        add_bullet(doc, item)

    add_h2(doc, '1.1 Headline assessment')
    add_callout(doc, 'good', 'Production-grade SaaS. Multi-tenant model is sound, integration count is high, and operational tooling (backups, error tracking, retries) is in place. The codebase is being actively developed — 135+ SQL migrations testify to that.')

    add_callout(doc, 'warn', 'Test coverage is light (~2.7% of source files have unit tests). End-to-end and integration tests are absent. For a system this complex, this is a meaningful gap that should be addressed before scaling beyond the current ~10 tenants.')

    add_callout(doc, 'info', 'Multi-tenant isolation is enforced both at the database layer (RLS) and at the application layer (scope.ts proxy). This belt-and-suspenders approach is appropriate for SaaS but requires discipline to maintain. New tables MUST be added to MULTI_TENANT_TABLES set or scoped via parent FK — otherwise data leaks across tenants.')

    add_h2(doc, '1.2 Top 5 strategic findings')
    findings = [
        ('Strength', 'Multi-tenant model is robust', 'Auto-scoping via lib/tenant/scope.ts proxy + RLS at DB level. Audit completed 2026-06-10 closed 3 critical + 2 high gaps.'),
        ('Strength', 'Integration depth is unusual', 'Stripe Connect, GHL CRM sync, Twilio SMS, Resend email, IMAP inbox sync, Google Business reviews. Most SaaS at this stage have 3-4 integrations max.'),
        ('Gap', 'Test coverage is minimal', '6 unit tests for ~225 source files. Core pricing + validation logic covered. No e2e tests. Critical for a payment-handling SaaS.'),
        ('Risk', 'Single repo serves both marketing site AND tenant app', 'Marketing failures could affect tenants and vice versa. Mitigated by middleware-based routing but architecturally coupled.'),
        ('Opportunity', '56 admin pages indicate broad surface', 'Tenant onboarding is potentially overwhelming. Onboarding wizard exists but a guided "first 10 days" flow + progressive disclosure would help retention.'),
    ]
    add_table(doc, ['Type', 'Finding', 'Detail'], findings, col_widths=[1.0, 1.8, 3.7])

    doc.add_page_break()

    # ============ 2. SYSTEM OVERVIEW ============
    add_h1(doc, '2. System Overview')

    add_h2(doc, '2.1 Business model')
    add_p(doc, 'RentalFlow is sold as a flat-rate SaaS subscription ($99/month) to rental businesses (inflatables, party rentals, equipment rentals). Each subscriber becomes a "tenant" with their own subdomain (e.g. brand.getrentalflow.com) or custom domain (e.g. itsalwaysfun.com). The platform owner, Ludmila, also operates a flagship tenant (IAF) which serves as both proof of concept and case study.')

    add_h2(doc, '2.2 Two products in one repository')
    rows = [
        ('Marketing site', 'getrentalflow.com', 'Lead capture, free tools (1099 tracker, etc.), pricing page, signup'),
        ('Tenant app', '*.getrentalflow.com + custom domains', 'The full rental management platform: booking, dispatch, inventory, accounting, marketing'),
        ('Superadmin', 'getrentalflow.com/superadmin', 'Platform-owner backoffice for Ludmila — tenant health, billing, support'),
        ('Customer portal', 'itsalwaysfun.com/portal etc.', 'Tenant customers log in to see their bookings, loyalty points, referrals'),
        ('Driver app', 'itsalwaysfun.com/driver etc.', 'Mobile-friendly route view for drivers'),
    ]
    add_table(doc, ['Surface', 'Lives at', 'Purpose'], rows, col_widths=[1.5, 2.5, 3.0])

    add_h2(doc, '2.3 Routing decision (one repo, multiple products)')
    add_p(doc, 'The middleware.ts file is the gatekeeper. On every request it inspects the hostname and decides whether to:')
    for item in [
        '(a) Serve the marketing site (apex getrentalflow.com)',
        '(b) Serve the tenant app (custom domain or *.getrentalflow.com subdomain)',
        '(c) Redirect/rewrite based on path (e.g. /admin/* on the apex → /superadmin/login)',
        '(d) Refresh the Supabase auth session',
        '(e) Gate /admin/* and /superadmin/* behind login',
    ]:
        add_bullet(doc, item)

    add_callout(doc, 'warn', 'A failure in middleware.ts affects ALL surfaces simultaneously. Monitoring and a robust health-check route (/api/health exists) are essential.')

    doc.add_page_break()

    # ============ 3. TECH STACK ============
    add_h1(doc, '3. Technology Stack')

    rows = [
        ('Framework', 'Next.js 14.2.35 (App Router, React Server Components, Server Actions)'),
        ('Runtime', 'Node.js (Vercel serverless functions)'),
        ('Hosting', 'Vercel (auto-deploy on push to main; preview deploys per branch)'),
        ('Database', 'Supabase Postgres (managed)'),
        ('Auth', 'Supabase Auth (session cookies, email/password + magic links)'),
        ('Data access', 'PostgREST via @supabase/supabase-js + custom multi-tenant scoping proxy'),
        ('Payments', 'Stripe + Stripe Connect (per-tenant payout accounts)'),
        ('Email transactional', 'Resend (REST API)'),
        ('Email account sync', 'IMAP/SMTP via imapflow + nodemailer (for superadmin unified inbox)'),
        ('SMS', 'Twilio (HTTP API; A2P 10DLC compliant)'),
        ('CRM', 'GoHighLevel (REST + webhooks; v2021-07-28 API)'),
        ('Error tracking', 'Sentry 8.40.0 (with cron monitor extension)'),
        ('Object storage', 'AWS S3 (backups, branding assets)'),
        ('Cache / rate limit', 'Upstash Redis + ratelimit'),
        ('PWA', 'next-pwa (offline support, installability)'),
        ('AI', 'Anthropic Claude API (admin assistant + email reply suggestions)'),
    ]
    add_table(doc, ['Layer', 'Choice'], rows, col_widths=[2.0, 5.0])

    add_h2(doc, '3.1 Rationale')
    add_p(doc, 'The stack is a well-balanced choice for a SaaS at this maturity. Notable decisions:')
    for item in [
        'Next.js App Router enables Server Components → smaller client bundle for admin-heavy pages',
        'Supabase replaces what would otherwise be three services: Postgres + auth + storage + realtime',
        'Vercel + Supabase + Stripe is the modern "SaaS in a weekend" baseline but extended substantially here',
        'Direct HTTP calls (no SDK) for SMS, email, GHL — easier debugging, no SDK version drift, smaller bundle',
        'IMAP via imapflow for the superadmin inbox is unusual — handles email-as-CRM without paying for Front/Help Scout',
    ]:
        add_bullet(doc, item)

    doc.add_page_break()

    # ============ 4. MULTI-TENANT ARCHITECTURE ============
    add_h1(doc, '4. Multi-Tenant Architecture')

    add_h2(doc, '4.1 Tenant identity')
    add_p(doc, 'Each tenant is a row in the `tenants` table with these key fields:')
    for item in [
        'id (UUID) — primary key referenced by every multi-tenant table\'s tenant_id column',
        'slug — URL-safe identifier used for subdomain (slug.getrentalflow.com)',
        'custom_domain — optional vanity domain (itsalwaysfun.com)',
        'stripe_connect_id — the tenant\'s Stripe Connect account for receiving payments',
        'branding fields (logo, colors, fonts) — overridden in middleware-injected context',
    ]:
        add_bullet(doc, item)

    add_h2(doc, '4.2 Resolution flow')
    add_p(doc, 'On every request:')
    for item in [
        '1. middleware.ts reads the Host header',
        '2. resolveTenantByHostname() queries `tenants` (custom_domain OR slug.getrentalflow.com → tenant row)',
        '3. tenant.id is injected as x-tenant-id header on the request',
        '4. Server Components + API routes read this via headers() from next/headers',
        '5. createAdminClient() in admin.ts wraps the Supabase client via scopeToTenant() proxy',
        '6. The proxy adds .eq("tenant_id", id) to all SELECT/UPDATE/DELETE and injects tenant_id on INSERT/UPSERT, but ONLY for tables in MULTI_TENANT_TABLES',
    ]:
        add_bullet(doc, item)

    add_h2(doc, '4.3 Multi-tenant tables (56)')
    add_p(doc, 'Tables in lib/tenant/scope.ts MULTI_TENANT_TABLES set are auto-scoped:')

    cats = [
        ('Customer + booking', ['bookings', 'customer_profiles', 'gift_cards', 'gift_card_purchases', 'gift_card_redemptions', 'quotes', 'payout_requests', 'contact_messages', 'customer_reviews', 'loyalty_transactions', 'dispatch_routes', 'dispatch_stops']),
        ('Catalog', ['products', 'categories', 'packages', 'setup_surfaces', 'inventory_items', 'inventory_units', 'inventory_categories', 'vehicles', 'trailers', 'coupons']),
        ('Accounting', ['overhead_costs', 'overhead_categories', 'driver_tax_profiles']),
        ('Configuration', ['site_settings', 'email_templates', 'home_banners', 'faqs', 'user_roles', 'customer_tags', 'campaigns', 'tenant_api_keys', 'tenant_webhooks', 'custom_reports', 'google_business_connections', 'tenant_goals', 'tenant_home_sections', 'tenant_onboarding_checklist', 'tenant_operator_notes', 'admin_audit_log']),
        ('Inspection & movement (recent)', ['inspection_templates', 'booking_inspections', 'inventory_unit_movements']),
    ]
    for cat, tables in cats:
        add_bullet(doc, f'{cat} ({len(tables)}): ' + ', '.join(tables))

    add_h2(doc, '4.4 Tables intentionally NOT auto-scoped')
    add_p(doc, 'These tables\'s tenancy is enforced via a FK to their parent — the parent IS multi-tenant and that constraint is sufficient. Adding them to scope would inject a tenant_id field that doesn\'t exist on the table, causing PostgREST errors.')
    not_scoped = ['booking_expenses', 'booking_damages', 'booking_proofs', 'booking_waivers', 'booking_extensions', 'coi_requests', 'booking_expense_categories', 'product_inventory_requirements', 'product_images', 'contact_message_replies', 'campaign_recipients']
    add_bullet(doc, ', '.join(not_scoped))

    add_h2(doc, '4.5 RLS policies — defense in depth')
    add_p(doc, 'Even if scope.ts were bypassed (e.g., a developer using the raw service-role client), Supabase Row-Level Security policies on every multi-tenant table would prevent cross-tenant reads/writes. Common patterns observed:')
    for item in [
        '`tenant_id = current_setting(\'request.jwt.claims\', true)::json->>\'tenant_id\'::uuid`',
        'Role-based check via is_staff_or_admin(auth.uid()) helper',
        'Driver-role policies filter by dispatch_stops assignment',
        'Customer portal policies filter by customer_email match',
    ]:
        add_bullet(doc, item)

    add_callout(doc, 'info', 'A 2026-06-10 audit closed 3 critical + 2 high + 6 medium gaps in multi-tenant scope coverage. One observation (OBS-1: auto-derive MULTI_TENANT_TABLES from schema introspection) remains open.')

    doc.add_page_break()

    # ============ 5. PUBLIC SURFACE ============
    add_h1(doc, '5. Public Surface — Marketing & Booking')

    add_h2(doc, '5.1 Marketing site (getrentalflow.com apex)')
    rows = [
        ('/marketing', 'Landing page with hero + product pitch + pricing tier preview'),
        ('/marketing/free-tools/*', 'Lead magnet pages (1099 tracker for drivers, etc.) — capture email → GHL contact'),
        ('/marketing/pricing', 'Plan comparison'),
        ('/signup', 'Tenant signup flow with payment'),
    ]
    add_table(doc, ['Path', 'Purpose'], rows, col_widths=[2.2, 4.8])

    add_h2(doc, '5.2 Tenant public site (itsalwaysfun.com etc.)')
    rows = [
        ('/', 'Tenant home page (hero, featured products, testimonials, FAQs)'),
        ('/rentals', 'Full product catalog'),
        ('/category/[category]', 'Category-filtered catalog'),
        ('/items/[slug]', 'Product detail (gallery, description, calendar, pricing, add-to-cart)'),
        ('/packages', 'Bundle offers'),
        ('/order-by-date', 'Multi-step booking wizard — pick date, product, add-ons, customer info, payment'),
        ('/gift-cards', 'Purchase gift cards'),
        ('/reviews', 'Aggregated public testimonials (synced from Google Business + customer_reviews)'),
        ('/contact', 'Contact form → contact_messages + GHL contact + admin notification'),
        ('/info/terms-of-service', 'Legal'),
    ]
    add_table(doc, ['Path', 'Purpose'], rows, col_widths=[2.2, 4.8])

    add_h2(doc, '5.3 Booking flow detail')
    add_p(doc, 'The /order-by-date wizard (BookingWizard.tsx) is the highest-stakes customer flow. Steps:')
    for item in [
        '1. Date picker (consults /api/availability — applies blackout dates, min lead time, weekend pricing flags)',
        '2. Product selection',
        '3. Add-ons (damage protection, power supply, package upgrades)',
        '4. Customer info (with SMS opt-in checkbox — 2026-06-10 Twilio compliance fix)',
        '5. Coupon / gift card application',
        '6. Stripe Elements payment with PaymentIntent created server-side (metadata.tenant_id + booking_id)',
        '7. POST /api/bookings/check-and-hold creates the booking row in pending_payment state with a 10-min hold',
        '8. payment_intent.succeeded webhook flips state to confirmed + sends confirmation email + syncs to GHL + awards loyalty',
    ]:
        add_bullet(doc, item)

    add_callout(doc, 'good', 'The race condition between client-side mark-as-paid and the Stripe webhook was fixed on 2026-06-15 via defense-in-depth in the webhook handler. Quote-converted bookings now reliably receive their confirmation email.')

    doc.add_page_break()

    # ============ 6. CUSTOMER PORTAL ============
    add_h1(doc, '6. Customer Portal (logged-in customer)')

    add_p(doc, 'A customer who has booked once gets an account in customer_profiles + Supabase auth.users. They can log in via OTP email and see:')

    rows = [
        ('/portal', 'Account home'),
        ('/portal/bookings', 'Past and upcoming bookings'),
        ('/portal/bookings/[id]', 'Booking detail — reschedule (48h cutoff), weather cancellation, extend rental'),
        ('/portal/profile', 'Profile editor'),
        ('/portal/points', 'Loyalty points + tier progression'),
        ('/portal/referrals', 'Referral code (admin-driven currently — customer-driven flow is a gap)'),
    ]
    add_table(doc, ['Path', 'Purpose'], rows, col_widths=[2.5, 4.5])

    add_h2(doc, '6.1 Auth model')
    add_p(doc, 'Custom OTP login via Resend (bypassing Supabase email) was shipped 2026-06-01. The Supabase magic-link flow had high deliverability variance, so the team owns the OTP email rendering and SMTP path. Token validation still goes through Supabase Auth.')

    doc.add_page_break()

    # ============ 7. ADMIN PANEL ============
    add_h1(doc, '7. Admin Panel (per-tenant)')

    add_p(doc, 'The admin panel is the largest surface — 56 directories under app/admin/. Below is grouped inventory.')

    groups = [
        ('Operations', [
            ('/admin/dashboard', 'Home — key metrics, onboarding checklist, daily booking summary'),
            ('/admin/bookings', 'Booking list + detail (proofs, damages, expenses, inspections, extensions)'),
            ('/admin/bookings/new', 'Manual booking entry'),
            ('/admin/calendar', 'Visual booking calendar'),
            ('/admin/availability', 'Blackout dates + maintenance windows + bulk availability rules'),
            ('/admin/dispatch', 'Daily dispatch view'),
            ('/admin/dispatch/[date]', 'Route planner for a date — unit-to-vehicle assignment'),
            ('/admin/quotes', 'Quote list + builder + bulk editor + email send'),
            ('/admin/inbox', 'Inbound customer email thread management (GMail/IMAP forwarded)'),
        ]),
        ('Catalog', [
            ('/admin/products', 'Product CRUD (pricing, cost, images, inventory requirements)'),
            ('/admin/categories', 'Category management + surface types'),
            ('/admin/packages', 'Bundle offers'),
            ('/admin/inspections', 'Inspection templates (delivery / pickup / spot-check checklists)'),
            ('/admin/coupons', 'Discount code management + bulk assign + referrer picker'),
            ('/admin/gift-cards', 'Gift card lifecycle + sales toggle'),
        ]),
        ('Inventory & Fleet', [
            ('/admin/inventory', 'Inventory item list (per-product stock + per-day requirements)'),
            ('/admin/inventory/[id]', 'Item detail (units panel + maintenance log)'),
            ('/admin/inventory/units', 'Fleet-at-a-glance view of every tracked unit with state machine'),
            ('/admin/fleet', 'Vehicles + trailers'),
            ('/admin/bulk-upload', 'CSV import for products / inventory'),
        ]),
        ('Financial', [
            ('/admin/reports', 'P&L by period, cash flow projection, drivers report, customer LTV, custom exports'),
            ('/admin/reports/1099-nec', '1099-NEC tax form generation for drivers'),
            ('/admin/overhead', 'Business expenses + categories'),
            ('/admin/settings/payments', 'Stripe Connect onboarding + status'),
        ]),
        ('Marketing & Customer', [
            ('/admin/customers', 'Customer search + LTV + tags + loyalty'),
            ('/admin/loyalty', 'Per-customer loyalty management + payout requests'),
            ('/admin/reviews', 'Customer review moderation'),
            ('/admin/campaigns', 'Email campaign builder + scheduled sends'),
            ('/admin/email-templates', 'Transactional email + SMS body editor (booking_confirmation, reminder, etc.)'),
            ('/admin/banners', 'Home page hero rotation'),
            ('/admin/faqs', 'Public FAQ editor'),
        ]),
        ('Configuration', [
            ('/admin/site', 'Business info + branding + appearance'),
            ('/admin/settings', 'Tax, lead time, timezone, damage protection, billing'),
            ('/admin/onboarding', 'Multi-step setup wizard for new tenants'),
            ('/admin/waiver', 'Liability waiver PDF template'),
            ('/admin/coi', 'COI request tracking + insurance compliance'),
            ('/admin/webhooks', 'Outbound webhook log + replay'),
            ('/admin/api-keys', 'Tenant API key generation (read / write scopes)'),
        ]),
        ('Operations support', [
            ('/admin/support', 'Internal support tickets + KB editor'),
            ('/admin/help', 'KB article viewer (also feeds AI assistant context)'),
            ('/admin/diagnostics', 'Health checks (Google Places, DB, integrations)'),
            ('/admin/users', 'Staff roles (admin/staff/driver) + W-9 collection'),
            ('/admin/audit-log', 'Admin action history'),
            ('/admin/goals', 'Business KPIs + targets'),
        ]),
    ]

    for title, items in groups:
        add_h2(doc, '7.' + str(groups.index((title, items)) + 1) + ' ' + title)
        add_table(doc, ['Path', 'Purpose'], items, col_widths=[2.5, 4.5])

    doc.add_page_break()

    # ============ 8. SUPERADMIN ============
    add_h1(doc, '8. Superadmin Platform (for Ludmila)')

    add_p(doc, 'Mounted at getrentalflow.com/superadmin (no tenant context). Used by the SaaS owner to manage all tenants from one place.')

    rows = [
        ('/superadmin/dashboard', 'Cross-tenant health overview'),
        ('/superadmin/tenants', 'Tenant list — search, suspend, impersonate, view brief'),
        ('/superadmin/tenants/[id]', 'Per-tenant snapshot (bookings, revenue, support tickets)'),
        ('/superadmin/billing', 'Stripe subscription + usage across all tenants'),
        ('/superadmin/revenue', 'MRR, churn, growth metrics'),
        ('/superadmin/email', 'Unified IMAP inbox across multiple accounts (with AI reply suggestion)'),
        ('/superadmin/email/[threadId]', 'Thread detail with Claude-powered reply suggestion'),
        ('/superadmin/email/send', 'Bulk email to leads'),
        ('/superadmin/activity', 'Platform-wide audit log export'),
        ('/superadmin/health', 'Supabase storage + auth usage, cron health'),
        ('/superadmin/support', 'Cross-tenant support tickets + KB management'),
        ('/superadmin/kb', 'Knowledge base for support'),
        ('/superadmin/goals', 'Platform goals + tenant KPIs aggregate'),
        ('/superadmin/onboarding', 'Tenant onboarding funnel tracking'),
        ('/superadmin/onboarding-playbook', 'Standard operating procedure docs'),
        ('/superadmin/setup', 'Initial platform configuration'),
        ('/superadmin/team', 'Superadmin user management (just Ludmila currently)'),
    ]
    add_table(doc, ['Path', 'Purpose'], rows, col_widths=[2.7, 4.3])

    add_h2(doc, '8.1 Notable: Unified email inbox')
    add_p(doc, 'Superadmin /email is unusual — it\'s not just transactional logs, it\'s a full IMAP-backed inbox. Ludmila connects external email accounts (Gmail forwarding, 20i StackMail, etc.) and emails get synced every 5 min via cron. Replies are sent via SMTP. Claude API suggests reply drafts. This replaces Front/Help Scout for the platform owner.')

    add_callout(doc, 'info', 'This was shipped 2026-06-XX (per memory: "/superadmin email LIVE"). Critical Node 22 ESM gotchas were resolved: mailparser replaced, isomorphic-dompurify lazy, imapflow SEARCH+FETCH pattern.')

    doc.add_page_break()

    # ============ 9. DRIVER APP ============
    add_h1(doc, '9. Driver App')

    add_p(doc, 'Mounted at <tenant>/driver. Mobile-first (next-pwa enables installability). Drivers see their daily route + stops with status tracking.')

    add_h2(doc, '9.1 Surface')
    for item in [
        '/driver — home page showing today + tomorrow routes assigned to the driver\'s vehicle',
        'Each stop has: customer name, address, time window, product, status (planned → loaded → out → completed → cancelled)',
        'Status update buttons (drivers can mark loaded/out/delivered)',
        'Proof-of-delivery capture via ProofCapture component (photo upload)',
        'Damage reporting flow',
    ]:
        add_bullet(doc, item)

    add_h2(doc, '9.2 Permission model')
    add_p(doc, 'A user with role=driver in user_roles table can see only the routes where they are assigned. RLS policies on dispatch_stops + dispatch_routes filter by current_user_role = driver AND vehicle.assigned_driver_id = auth.uid().')

    add_callout(doc, 'warn', 'Driver mobile UX is a known area for improvement. The /driver page is currently a single page (no sub-routes). Per-stop interaction is via inline expansions. A dedicated mobile-optimized flow (think "Uber driver" UX) would meaningfully improve operational efficiency.')

    doc.add_page_break()

    # ============ 10. API LAYER ============
    add_h1(doc, '10. API Layer')

    add_h2(doc, '10.1 Public / customer-facing')
    rows = [
        ('GET /api/availability', 'Check product availability on dates (used by booking wizard + iCal feed)'),
        ('GET /api/products', 'Catalog with filtering'),
        ('GET /api/products/[slug]', 'Product detail (cached)'),
        ('POST /api/contact', 'Contact form submission'),
        ('POST /api/bookings/check-and-hold', 'Reserve booking slot (10-min hold) + create PaymentIntent'),
        ('POST /api/bookings/release-hold', 'Customer abandoned cart — release hold'),
        ('POST /api/bookings/extend', 'Extend rental dates'),
        ('POST /api/bookings/abandoned-cart', 'Abandoned cart email trigger'),
        ('POST /api/coupons/validate', 'Coupon code validation'),
        ('POST /api/gift-cards/validate', 'Gift card balance check'),
        ('POST /api/gift-cards/purchase', 'Purchase a gift card'),
        ('GET /api/calendar/[token]', 'iCal feed (tenant-scoped, token-based)'),
        ('POST /api/chat/public', 'Public chatbot (lead capture, AI-assisted)'),
    ]
    add_table(doc, ['Route', 'Purpose'], rows, col_widths=[3.0, 4.0])

    add_h2(doc, '10.2 Admin endpoints')
    rows = [
        ('POST /api/bookings/notify-ghl', 'Push booking to GHL pipeline'),
        ('POST /api/admin/backup', 'On-demand database export'),
        ('POST /api/admin/export/[entity]', 'Bulk export (CSV/JSON)'),
        ('POST /api/admin/support', 'Support ticket creation'),
        ('POST /api/admin/diagnose-places', 'Test Google Places integration'),
        ('POST /api/admin/reports/custom/[id]/export', 'Custom report data export'),
        ('POST /api/admin/assistant', 'Claude AI admin assistant (tenant-scoped context window)'),
        ('POST /api/chat/saas', 'Admin chatbot — tenant-scoped Claude API call'),
        ('GET /api/templates/[entity]', 'Render email template preview'),
    ]
    add_table(doc, ['Route', 'Purpose'], rows, col_widths=[3.0, 4.0])

    add_h2(doc, '10.3 Programmatic API (v1)')
    rows = [
        ('GET/POST /api/v1/products', 'Catalog API for third-party integrations'),
        ('GET/POST /api/v1/bookings', 'Booking API'),
        ('GET /api/v1/customers', 'Customer API'),
        ('GET /api/v1/availability', 'Availability API'),
    ]
    add_table(doc, ['Route', 'Purpose'], rows, col_widths=[3.0, 4.0])
    add_p(doc, 'Authenticated via tenant_api_keys table. Read/write scopes per key. Rate-limited via Upstash.')

    add_h2(doc, '10.4 Webhooks (inbound)')
    rows = [
        ('POST /api/webhooks/stripe', 'payment_intent.succeeded / payment_intent.payment_failed → confirm booking, loyalty award, email send, GHL sync, coupon increment'),
        ('POST /api/webhooks/ghl', 'GHL contact + opportunity events (currently underused)'),
        ('POST /api/email/inbound', 'Inbound email → contact_messages (via Cloudflare Worker forwarding)'),
    ]
    add_table(doc, ['Route', 'Purpose'], rows, col_widths=[2.5, 4.5])

    add_h2(doc, '10.5 Health & misc')
    add_bullet(doc, 'GET /api/health — readiness probe (DB + env check)')
    add_bullet(doc, 'POST /api/free-tools/1099-tracker/submit — 1099 income tracker form (lead capture marketing tool)')

    doc.add_page_break()

    # ============ 11. CRON JOBS ============
    add_h1(doc, '11. Background Jobs (Cron)')

    add_p(doc, 'All scheduled via vercel.json with bearer-token verification (CRON_SECRET). Each is wrapped with Sentry monitor for SLA tracking.')

    rows = [
        ('booking-emails', '0 14 * * *', 'Send scheduled lifecycle emails (confirmation, 3d reminder, 1d-after review request, 90d re-engagement)'),
        ('quote-followup', '0 16 * * *', 'Follow-up emails for pending quotes'),
        ('quote-hold-reminder', '0 * * * *', 'Hourly — remind customers about expiring 24-hr quote holds'),
        ('low-stock-alert', '0 13 * * *', 'Daily inventory low-stock check + email to admin'),
        ('weekly-backup', '0 3 * * 0', 'Sunday 3 AM — S3 backup of DB + file storage'),
        ('lead-magnet-resync', '15 4 * * *', 'Daily 4:15 AM — resync lead magnet signups to GHL'),
        ('email-sync', '*/5 * * * *', 'Every 5 min — IMAP sync for superadmin inbox'),
        ('dunning', '0 11 * * *', 'Daily 11 AM — retry failed payment collection'),
        ('onboarding-nudge', '0 15 * * *', 'Daily 3 PM — email nudge to tenants with incomplete onboarding'),
        ('weekly-report', '0 12 * * 1', 'Monday 12 PM — weekly admin KPI summary'),
        ('webhook-retry', '*/5 * * * *', 'Every 5 min — retry failed outbound webhook deliveries'),
        ('campaign-sender', '*/5 * * * *', 'Every 5 min — send queued marketing campaign emails'),
        ('google-places-sync', '0 10 * * *', 'Daily 10 AM — sync Google Business reviews'),
    ]
    add_table(doc, ['Job', 'Schedule (UTC)', 'Purpose'], rows, col_widths=[1.8, 1.5, 3.7])

    add_callout(doc, 'good', 'Auth pattern is consistent: every cron route verifies the Bearer token from CRON_SECRET env before doing work. Sentry monitors flag SLA breaches.')

    doc.add_page_break()

    # ============ 12. DATA LAYER ============
    add_h1(doc, '12. Data Layer & Schema')

    add_h2(doc, '12.1 Migrations')
    add_p(doc, 'The supabase/ directory contains 138 SQL files representing the evolutionary schema. Notable patterns:')
    for item in [
        'No timestamp-prefixed migrations (unlike standard Supabase pattern) — files are named by feature',
        'All migrations are idempotent (IF NOT EXISTS, DO blocks for constraints, DROP-then-CREATE for policies)',
        'ALL_MIGRATIONS.sql concatenates everything in dependency order for fresh setup',
        'Migrations applied via supabase CLI (`supabase db query --linked --yes`) — not auto-applied via push',
    ]:
        add_bullet(doc, item)

    add_h2(doc, '12.2 Core entity model')
    add_p(doc, 'The booking is the central entity. Around it:')
    for item in [
        'bookings ← customer_profiles (by email)',
        'bookings ← products (primary product)',
        'bookings ← booking_addons (jsonb array)',
        'bookings → booking_expenses (per-booking cost items)',
        'bookings → booking_damages (damage records)',
        'bookings → booking_proofs (photo evidence)',
        'bookings → booking_waivers (signed liability waivers)',
        'bookings → booking_extensions (rental extensions)',
        'bookings → booking_inspections (NEW — delivery/pickup checklists)',
        'bookings → dispatch_stops (delivery route assignment)',
        'bookings → loyalty_transactions (points earned)',
    ]:
        add_bullet(doc, item)

    add_h2(doc, '12.3 Drop-default-tenant-id migration (OBS-2)')
    add_p(doc, 'Originally, every multi-tenant table had `tenant_id DEFAULT \'11111111-...\'::uuid` (the IAF tenant UUID). This was a transitional safety net — but it meant any code path that forgot to set tenant_id would silently write to IAF. The 2026-06-10 audit applied drop_default_tenant_id.sql which removes the DEFAULT and converts those silent-writes into loud NOT NULL violations. This is the load-bearing change of the audit.')

    add_callout(doc, 'good', 'This pattern (default → drop default once transition complete) is the correct way to handle multi-tenant migrations. The team got it right.')

    add_h2(doc, '12.4 RLS policy patterns')
    add_p(doc, 'Recurring policy idioms observed:')
    for item in [
        'staff_or_admin manage X — most admin tables, uses is_staff_or_admin(auth.uid())',
        'driver_or_above manage X — adds driver role to staff/admin (for dispatch + inspections + movements)',
        'public read X — for public-readable tables (products, categories, faqs, home_banners, customer_reviews)',
        'customer own X — customer portal sees only their own data (booking_id IN (SELECT id FROM bookings WHERE customer_email = ...))',
        'realtime publication subscription — tables in supabase_realtime publication get live pubsub for the admin dashboard',
    ]:
        add_bullet(doc, item)

    doc.add_page_break()

    # ============ 13. INTEGRATIONS ============
    add_h1(doc, '13. Integrations')

    integrations = [
        ('Stripe + Stripe Connect', 'Payment processing + tenant-managed payouts. Webhook handles payment_intent events. Stripe Tax integration. PaymentIntents include tenant_id metadata for routing in the webhook.', 'STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
        ('GoHighLevel (GHL)', 'CRM sync + outbound automation. Contact upsert on every booking + contact form. Opportunity creation per booking. GHL workflows handle email/SMS sequences for cart abandonment, upsells, etc. Outbound prospecting is delegated to GHL.', 'GHL_API_KEY (pit-*), GHL_LOCATION_ID, GHL_WEBHOOK_SECRET'),
        ('Twilio SMS', 'A2P 10DLC compliant SMS sender. Used in booking lifecycle (confirmation, reminder, review request, COI ready, cancellation). Requires explicit per-customer opt-in (customer_phone_sms_consent_at timestamp).', 'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER'),
        ('Resend (email)', 'Transactional email + marketing campaigns. Per-tenant sender domain (multi-tenant-email-pattern with getTenantEmailConfig).', 'RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO'),
        ('Supabase', 'Postgres + Auth + Storage + Realtime. Service-role key for server-side scoped access. Anon key for client. Bucket storage for tenant branding + proof photos.', 'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY'),
        ('Sentry', 'Error tracking + cron monitor (SLA on every scheduled job). Performance monitoring enabled.', 'SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN'),
        ('AWS S3', 'Weekly database backups + tenant branding assets (logos, custom fonts).', 'AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME'),
        ('Upstash Redis', 'Rate limiting (API + booking flow) + transient caching.', 'UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN'),
        ('Anthropic Claude API', 'AI admin assistant + email reply suggestions in superadmin inbox.', 'ANTHROPIC_API_KEY'),
        ('Google Places / Business', 'Polled daily for Google Business reviews. Synced to customer_reviews table.', 'GOOGLE_PLACES_API_KEY'),
        ('IMAP/SMTP (mailparser, imapflow, nodemailer)', 'Superadmin unified inbox. Connects to external email accounts (Gmail forwarding, 20i StackMail). Synced every 5 min.', 'Credentials stored encrypted in email_accounts table'),
    ]
    for name, desc, envs in integrations:
        add_h2(doc, '13.' + str(integrations.index((name, desc, envs)) + 1) + ' ' + name)
        add_p(doc, desc)
        add_p(doc, 'Env vars: ' + envs, italic=True)

    doc.add_page_break()

    # ============ 14. SECURITY AUDIT ============
    add_h1(doc, '14. Security Audit')

    add_h2(doc, '14.1 Authentication')
    for item in [
        'Supabase Auth (JWT-based session cookies)',
        'Custom OTP login via Resend for customer portal (replaces Supabase magic links)',
        'Middleware enforces /admin and /superadmin gates',
        'No password complexity rules visible in code (relies on Supabase defaults)',
        'No 2FA / MFA support',
    ]:
        add_bullet(doc, item)

    add_h2(doc, '14.2 Authorization')
    for item in [
        'Role-based: admin / staff / driver / customer (via user_roles table)',
        'Database-level RLS as defense-in-depth — every multi-tenant table has policies',
        'Helper SQL functions: is_staff_or_admin(uuid), is_admin(uuid)',
        'Customer portal scoped by email match on bookings',
    ]:
        add_bullet(doc, item)

    add_h2(doc, '14.3 Secret management')
    for item in [
        'All secrets in Vercel env vars (production + preview environments separate)',
        'CRON_SECRET as bearer token for cron route verification — non-default-shaped',
        'Webhook signing secrets verified for Stripe + GHL',
        'SUPABASE_SERVICE_ROLE_KEY only used server-side (never sent to client)',
        'No secrets in repo (.gitignore + standard practice)',
    ]:
        add_bullet(doc, item)

    add_h2(doc, '14.4 Input validation')
    for item in [
        'Zod schemas on every server action (TenmplateInputSchema, InspectionInputSchema, ApproveInputSchema, etc.)',
        'Server-side re-validation even when client validated',
        'PostgREST/Supabase handles SQL injection at the driver level',
        'Custom slugify in template editor prevents key collisions',
    ]:
        add_bullet(doc, item)

    add_h2(doc, '14.5 Known security mitigations')
    for item in [
        'SMS opt-in compliance for Twilio 10DLC — 2026-06-10 fix',
        'Stripe Connect rather than direct Stripe — tenants own their funds',
        'Audit log on every admin action via admin_audit_log table',
        '/superadmin completely separate from /admin (no overlap)',
        'XSS escape audit in 2026-06-XX security hardening commit',
        'SVG upload removed from inbox in same commit',
        'Rate limits on /api/contact and booking endpoints via Upstash',
    ]:
        add_bullet(doc, item)

    add_h2(doc, '14.6 Open security findings')
    add_callout(doc, 'warn', 'No password complexity rules — relies on Supabase Auth defaults. Consider adding a minimum length + breach-check via HIBP.')
    add_callout(doc, 'warn', 'No MFA option for admins — high-value tenants should have 2FA available.')
    add_callout(doc, 'warn', 'CSP headers not visible in middleware — review recommended.')
    add_callout(doc, 'warn', 'API rate limits per-tenant_api_key visible. Public endpoints (/api/availability, etc.) may need per-IP limits review.')

    doc.add_page_break()

    # ============ 15. MULTI-TENANT AUDIT ============
    add_h1(doc, '15. Multi-Tenant Audit')

    add_h2(doc, '15.1 Scope coverage')
    add_p(doc, 'Per the 2026-06-10 internal audit (project_rentalflow_scope_audit_pending.md):')
    for item in [
        '3 CRITICAL gaps closed (specific table inserts that wrote to default tenant)',
        '2 HIGH-severity gaps closed (queries that read across tenants)',
        '6 MEDIUM gaps closed',
        'OBS-2 (drop default tenant_id) implemented — silent leaks now throw NOT NULL violations',
        'OBS-1 (auto-derive MULTI_TENANT_TABLES from schema) — OPEN',
    ]:
        add_bullet(doc, item)

    add_h2(doc, '15.2 Audit recommendation: automate scope derivation')
    add_p(doc, 'The current process requires developers to manually add new tables to MULTI_TENANT_TABLES in lib/tenant/scope.ts. Failure modes:')
    for item in [
        'Forget to add → inserts pass through the scoped wrapper without tenant_id injection → NOT NULL violation at insert time (loud failure — good, but a footgun)',
        'Add a child table that doesn\'t have tenant_id column → PostgREST rejects insert with "unknown field" — confusing error',
        'Add table with tenant_id but RLS not configured → defense-in-depth gap (silent risk)',
    ]:
        add_bullet(doc, item)

    add_callout(doc, 'warn', 'Recommended: a CI check that introspects the live schema and asserts: every table with `tenant_id` column is in MULTI_TENANT_TABLES; every multi-tenant table has at least one tenant-scoped RLS policy.')

    doc.add_page_break()

    # ============ 16. OPERATIONAL CONCERNS ============
    add_h1(doc, '16. Operational Concerns')

    add_h2(doc, '16.1 Deployment')
    for item in [
        'Auto-deploy on push to main via Vercel git integration',
        'Preview deployments per branch — useful for PR review',
        'Build runs `next build` + Supabase env var injection',
        'Cron jobs registered via vercel.json — Vercel runs the schedule',
        'Custom domains managed via Vercel domain settings',
        'getrentalflow.com DNS managed at 20i (per memory) — registrar is Tucows via reseller',
    ]:
        add_bullet(doc, item)

    add_h2(doc, '16.2 Monitoring')
    for item in [
        'Sentry for errors (client + server + edge)',
        'Sentry cron monitors for each scheduled job — alerts on missed runs',
        'Vercel native logging + metrics dashboard',
        'No external uptime monitor visible (recommend adding one for /api/health)',
        'Supabase dashboard for DB performance + slow queries',
    ]:
        add_bullet(doc, item)

    add_h2(doc, '16.3 Backups')
    for item in [
        'Weekly S3 backup via api/cron/weekly-backup',
        'Supabase managed daily backups (default Supabase pro plan feature)',
        'No tested restore drill documented — recommend annual restore exercise',
    ]:
        add_bullet(doc, item)

    add_h2(doc, '16.4 Incident response')
    add_p(doc, 'Lessons from past incidents documented in memory:')
    for item in [
        '2026-06-15 getrentalflow.com clientHold — domain DNS pulled by registrar due to ICANN email verification expiration. Resolved by user clicking the verification email.',
        '2026-06-15 Stripe webhook race condition with quote-converted bookings — defense-in-depth fix shipped.',
        '2026-05-29 Subagent dispatch incident — package.json mutation accidentally committed by subagent. Workflow guardrails added.',
    ]:
        add_bullet(doc, item)

    doc.add_page_break()

    # ============ 17. TECHNICAL DEBT ============
    add_h1(doc, '17. Technical Debt')

    add_h2(doc, '17.1 Code-level TODOs')
    for item in [
        'lib/superadmin/health-data.ts:70 — last_admin_activity_at not wired (still returns null)',
        'app/admin/inventory/unit-movement-actions.ts:143 — utilization metrics incomplete (TODO returns warehouse-scoped subset)',
    ]:
        add_bullet(doc, item)

    add_h2(doc, '17.2 Architectural debt')
    for item in [
        'Single repo / single deployment serves marketing + tenant app + superadmin. A failed deploy affects all surfaces. Splitting marketing → standalone Next.js project would improve isolation.',
        'No CI on PRs — type-check + unit tests are local-only. Vercel build catches type errors but lint, test, security checks should run in GitHub Actions.',
        '138 SQL migration files without timestamp prefixes — re-ordering would require an `ALL_MIGRATIONS.sql` regeneration. The team manually concatenates in dependency order.',
        'No formal database migration tool (sqlfluff, atlas, sqitch). Pure SQL files applied manually via `supabase db query --linked`.',
        'Multi-tenant scope is a runtime proxy (lib/tenant/scope.ts). Could be a typed query builder for compile-time safety (e.g., kysely with codegen).',
    ]:
        add_bullet(doc, item)

    add_h2(doc, '17.3 Test debt')
    for item in [
        '6 unit tests covering pricing, validation, CSV, waiver, tenant resolution — these are the right tests for criticality, but coverage is ~2.7% of source',
        'No integration tests (no DB-backed tests)',
        'No e2e tests (no Playwright / Cypress)',
        'No visual regression tests (snapshots, Chromatic, etc.)',
    ]:
        add_bullet(doc, item)

    add_callout(doc, 'warn', 'For a payment-processing SaaS handling tenant funds, the recommended floor is: 10+ integration tests covering booking flow, payment webhook, and dispatch state machine. 3-5 e2e tests covering happy-path booking + admin login + driver flow.')

    add_h2(doc, '17.4 Documentation debt')
    for item in [
        'No CLAUDE.md or developer onboarding doc in repo (per session memory it exists in another location)',
        'Per-feature playbooks exist as memory entries (e.g., getrentalflow-ghl-playbook.md) but not in-repo for new contributors',
        'API v1 has routes but no OpenAPI / swagger doc',
        'No runbook for common ops tasks (restore from backup, suspend tenant, rotate webhook secret)',
    ]:
        add_bullet(doc, item)

    doc.add_page_break()

    # ============ 18. RECOMMENDATIONS ============
    add_h1(doc, '18. Prioritized Recommendations')

    add_h2(doc, '18.1 Top 5 — next 30 days')
    recs = [
        ('1', 'Add CI on PR (GitHub Actions)', 'type-check + unit tests + lint on every PR. ~2h setup.', 'High'),
        ('2', 'Add 5-10 integration tests for booking flow + payment webhook', 'Catches regressions in the most critical path. ~1 day work.', 'High'),
        ('3', 'Automate MULTI_TENANT_TABLES check', 'CI step that compares the set against the live schema. Closes OBS-1. ~3h.', 'Medium'),
        ('4', 'Annual restore drill from S3 backup', 'Test the recovery path. Document the runbook. ~half day.', 'Medium'),
        ('5', 'Open security hardening: CSP headers, MFA option for admins', 'Defensive layers. ~1 day each.', 'Medium'),
    ]
    add_table(doc, ['#', 'Recommendation', 'Why + effort', 'Impact'], recs, col_widths=[0.4, 2.0, 3.5, 1.1])

    add_h2(doc, '18.2 Top 5 — next 90 days')
    recs90 = [
        ('1', 'Mobile-optimized driver UX (Uber-style flow)', 'Separate /driver experience with one-stop-at-a-time. Major productivity win for tenant operations.', 'High'),
        ('2', 'Customer-driven referral signup flow in portal', 'Existing ReferrerPicker is admin-side. Growth lever.', 'High'),
        ('3', 'Per-booking team chat thread (admin/staff/driver)', 'Schema applied 2026-06-16. UI component pending. Massive operational coordination win.', 'Medium'),
        ('4', 'Approval workflow for high-ticket bookings', 'Tenant rule: if total > $X, require admin approval. Prevents staff mistakes.', 'Medium'),
        ('5', 'Public OpenAPI doc for v1 API', 'Required if onboarding integration partners.', 'Low-Med'),
    ]
    add_table(doc, ['#', 'Recommendation', 'Why', 'Impact'], recs90, col_widths=[0.4, 2.0, 3.5, 1.1])

    add_h2(doc, '18.3 Longer term — next 180 days')
    for item in [
        'Split marketing site into its own Next.js project (isolate failures)',
        'Migrate to atlas or sqitch for SQL migrations (timestamp ordering, dependency graph)',
        'Codegen types from schema (kysely + supabase-cli, or zapatos) for compile-time tenant safety',
        'E2E suite with Playwright (happy-path: book + admin confirm + driver deliver)',
        'PDF invoice designer per-tenant (Jinja-style template editor)',
    ]:
        add_bullet(doc, item)

    doc.add_page_break()

    # ============ 19. APPENDIX ============
    add_h1(doc, '19. Appendix — File Inventory')

    add_h2(doc, '19.1 Repository structure')
    for item in [
        'app/ — Next.js App Router pages (~225 .ts/.tsx files)',
        'app/admin/ — 56 directories of admin pages',
        'app/superadmin/ — 17 directories of platform-owner pages',
        'app/api/ — REST endpoints + cron + webhooks (13 cron jobs)',
        'app/(public)/ — public marketing + catalog pages',
        'app/portal/ — customer portal',
        'app/driver/ — driver mobile app',
        'lib/ — shared utilities (tenant scope, auth, email, sms, stripe, etc.)',
        'components/ — reusable UI components',
        'supabase/ — 138 SQL migration files',
        'tests/unit/ — 6 unit test files',
        'scripts/ — operational scripts (this audit doc builder included)',
        'public/ — static assets',
    ]:
        add_bullet(doc, item)

    add_h2(doc, '19.2 Notable files')
    for item in [
        'middleware.ts — tenant resolution, auth gating, .net→.com migration',
        'lib/tenant/scope.ts — auto-scoping proxy + MULTI_TENANT_TABLES set',
        'lib/supabase/admin.ts — createAdminClient() with optional unscoped opt-out',
        'lib/email/scheduled-emails.ts — booking lifecycle email senders (confirmation, reminder, review request)',
        'lib/ghl/client.ts — GoHighLevel API wrapper',
        'app/api/webhooks/stripe/route.ts — payment webhook (the most critical handler)',
        'app/api/bookings/check-and-hold/route.ts — booking creation + Stripe PaymentIntent',
        'lib/email/tenant-email.ts — per-tenant sender domain resolution',
        'supabase/multi_tenant_foundation.sql — initial tenancy migration',
        'supabase/drop_default_tenant_id.sql — the OBS-2 fix (load-bearing)',
    ]:
        add_bullet(doc, item)

    add_h2(doc, '19.3 Memory snapshot references')
    add_p(doc, 'For future maintainers, the following session memories carry institutional context:')
    for item in [
        'project_rentalflow_scope_audit_pending.md — multi-tenant audit findings',
        'reference_multi_tenant_email_pattern.md — getTenantEmailConfig usage',
        'reference_twilio_optin_pattern.md — SMS compliance pattern',
        'project_superadmin_email_live.md — Node 22 ESM gotchas',
        'reference_getrentalflow_ghl.md — GHL playbook',
        'project_iaf_domain_migration_complete.md — .net→.com architecture',
        'project_rentalflow_vision_autopilot.md — product north star',
    ]:
        add_bullet(doc, item)

    # ============ SAVE ============
    out_path = './RentalFlow_Technical_Audit.docx'
    doc.save(out_path)
    print(f'Saved: {out_path}')
    return out_path


if __name__ == '__main__':
    build_doc()
