"""Investor 5 — Traction. IAF is the flagship + paying customer."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 5, 'Traction',
        "Real revenue, real bookings, real tenants. The signal at this stage is honesty about scale.",
        audience_tags=['Angel', 'Pre-Seed'])

    api['add_callout'](doc, 'quote',
        '"We are not asking you to believe the projections. We are asking you to look at the '
        'platform that\'s already running."')

    api['add_h2'](doc, '5.1  IAF — the flagship customer')

    api['add_p'](doc,
        'It\'s Always Fun, LLC is the inflatable rental business that RentalFlow was originally '
        'built for. Operated by Ludmila. Lives at itsalwaysfun.com. It is a real business: real '
        'inventory, real customers, real Stripe payments, real drivers, real reviews. Every '
        'feature in RentalFlow is dog-food-tested against IAF before it ships to other tenants.')

    api['add_data_sheet'](doc,
        title="It's Always Fun, LLC (IAF)",
        subtitle='The flagship + first paying tenant.',
        fields=[
            ('Location',    'Jacksonville, FL'),
            ('Category',    'Inflatable rentals — bounce houses, water slides, party packages'),
            ('Live since',  'Multi-year operating history; on RentalFlow platform since 2026'),
            ('Volume',      'Active bookings flow daily. Stripe-confirmed payments. Driver-dispatched.'),
            ('Domain',      'itsalwaysfun.com (custom domain on RentalFlow infrastructure)'),
            ('Integrations live', 'Stripe Connect, Twilio SMS, GHL CRM, Resend email, '
                                    'Google Business reviews, IMAP inbox'),
            ('Operational signal', 'Drivers run dispatch from the driver PWA. Customers '
                                     'self-serve via the portal. Operator runs admin daily.'),
        ])

    api['add_h2'](doc, '5.2  Why IAF traction matters')

    api['add_p'](doc,
        'Most pre-seed SaaS pitches have "0 customers, 5 LOIs." RentalFlow has a different '
        'structure:')

    api['add_kv_table'](doc,
        ['Standard pre-seed pitch', 'RentalFlow'],
        [
            ('"We surveyed 500 potential customers"',
             '"We ARE the customer. We use it daily."'),
            ('"5 letters of intent, 0 paying"',
             '"IAF pays us directly via Stripe. Subsequent tenants signing on."'),
            ('"$0 ARR, projected $1M by year 2"',
             '"$X MRR today from IAF + onboarding tenants. Projected growth based on '
             'paid acquisition channels live."'),
            ('"Need $1M to build MVP"',
             '"MVP shipped. Need $50-500K to accelerate distribution + close 30-day reliability gaps."'),
        ],
        col_widths=[3.5, 3.6])

    api['add_callout'](doc, 'good',
        'Dog-food traction is a fundamentally different signal from "we asked customers and they '
        'said they\'d pay." We have the dog-food running daily AND we have other tenants joining. '
        'Both signals together = de-risked pre-seed.')

    api['add_h2'](doc, '5.3  Tenant pipeline + onboarding')

    api['add_p'](doc,
        'Beyond IAF, multiple tenants are at various stages — onboarded, onboarding, or '
        'in active sales conversations. The /superadmin platform provides cross-tenant '
        'visibility for Ludmila to manage all of them from one place.')

    api['add_kv_table'](doc,
        ['Stage', 'Definition', 'What needs to be true to advance'],
        [
            ('Prospect',
             'Heard about RentalFlow, has interest',
             'Pricing call + demo'),
            ('Trial signup',
             'Created tenant, exploring',
             'Onboarding checklist >50% complete'),
            ('Onboarded',
             'Real catalog, real Stripe Connect, taking real bookings',
             'First paid booking in production'),
            ('Active',
             'Recurring monthly Stripe payment to RentalFlow',
             'No churn signal for 90 days'),
            ('Power user',
             'Uses admin daily, recommends to peers',
             'Referrals out OR public testimonial'),
        ],
        col_widths=[1.5, 2.5, 3.1])

    api['add_callout'](doc, 'info',
        'Tenant pipeline detail is shared in due-diligence conversations. Public-facing '
        'documentation intentionally does NOT include specific tenant names or counts — early '
        'tenants are partners, not promotional fodder.')

    api['add_h2'](doc, '5.4  Acquisition signal — GHL outbound')

    api['add_p'](doc,
        'Active acquisition runs through GoHighLevel — outbound emails, calls, and CRM '
        'workflows targeting rental operators (segment 1: inflatables + party rentals). '
        'GHL handles delivery + sequencing; RentalFlow handles the platform once they sign up.')

    api['add_bullet'](doc, [
        ('Daily outbound ramp from 10 → 20 → 30 → 40 → 50 leads/day. ', True),
        ('Documented in project memory (project_rentalflow_outbound_active).', False),
    ])
    api['add_bullet'](doc, [
        ('GHL pipeline mirrors the tenant pipeline stages above ', True),
        ('— every prospect tracked through to active.', False),
    ])
    api['add_bullet'](doc, [
        ('Acquisition decision (2026-05-30): keep outbound on GHL ', True),
        ('rather than build a native RentalFlow sequence runner before 2026-07-29 review.', False),
    ])

    api['add_h2'](doc, '5.5  Adjacent traction — BRJ case study')

    api['add_callout'](doc, 'info',
        'BRJ is a separate Ludmila project (BRJ Prospector — a SaaS pivot for staffing companies). '
        'It is mentioned here as evidence of the team\'s ability to ship SaaS that customers pay '
        'for from day 3 — but BRJ is NOT a RentalFlow customer. It is a parallel proof point.')

    api['add_data_sheet'](doc,
        title='BRJ Prospector — parallel proof of "ship + monetize"',
        subtitle='Henry + Ludmila built and shipped BRJ Prospector. SaaS pivot validated.',
        fields=[
            ('What it is',
             'Lead generation + outreach tool for staffing companies (brjprospector.streamlit.app).'),
            ('Status', 'BRJ (the first customer) paid for ROI from day 3. Pivot to SaaS confirmed.'),
            ('Relevance to RentalFlow', 'Demonstrates the team can ship a working product, find '
                                          'paying customers, and validate a model — without raising. '
                                          'Same operating muscle applies to RentalFlow.'),
            ('Note',
             'BRJ outreach (the customer relationship) is owned by Ludmila. Documented in '
             'project_brj_prospector memory.'),
        ])

    api['add_h2'](doc, '5.6  Public signal')

    api['add_kv_table'](doc,
        ['Surface', 'URL', 'What it shows'],
        [
            ('IAF live site',         'itsalwaysfun.com',          'Real public catalog, real booking flow'),
            ('RentalFlow marketing',  'getrentalflow.com',         'The pitch + signup'),
            ('FXPulse (sibling)',     'fxpulse.org + scanner.fxpulse.org', 'Another Henry-shipped project — '
                                                                          'demonstrates breadth of execution'),
        ],
        col_widths=[2.0, 2.5, 2.6])

    api['add_h2'](doc, '5.7  Honest framing')

    api['add_callout'](doc, 'fact',
        'RentalFlow is pre-seed-stage. Tenant count is small. MRR is small. The signal is NOT '
        '"we already have 100 tenants." The signal is: "we shipped a complete platform that '
        'IAF runs on daily, we have additional tenants onboarding, and we did it with $0 raised." '
        'That changes the conversation about what the next $50-500K should buy.')
