"""Investor 4 — The Moat. Why a copycat would take 18 months to catch up."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 4, 'The Moat',
        'Why a well-funded copycat would take 18 months to reach where we already are.',
        audience_tags=['Angel', 'Pre-Seed'])

    api['add_callout'](doc, 'quote',
        '"Anyone can build a booking site. Building a booking site that knows about your inventory, '
        'pays your taxes, settles into your bank, dispatches your drivers, and emails your customers '
        'the right thing on the right day — that\'s 18 months of work even if you know what you\'re doing."')

    api['add_h2'](doc, '4.1  Five layers of moat')

    api['add_kv_table'](doc,
        ['Layer', 'Strength'],
        [
            ('1. Integration depth',
             'STRONG — each of 11 integrations took weeks to harden in production.'),
            ('2. Multi-tenant correctness',
             'STRONG — 197 RLS policies + auto-scoping proxy + audit closing 11 gaps.'),
            ('3. Vertical know-how',
             'STRONG — pricing rules, waiver flows, dispatch logic come from operating IAF.'),
            ('4. Built-in operator runtime',
             'MEDIUM-STRONG — cron lifecycle, audit logging, scope:check CI — hard to bolt on.'),
            ('5. Flat-pricing brand promise',
             'MEDIUM — easily copied as a price tag, hard to copy as a sustained position.'),
        ],
        col_widths=[2.4, 4.7])

    api['add_h2'](doc, '4.2  Layer 1 — Integration depth (the hardest moat to replicate)')

    api['add_p'](doc,
        'There is a meme that "AI makes building anything 10× faster." It does — for the first 80% '
        'of a feature. The last 20%, where the edge cases live, is where rental software actually '
        'lives or dies. Examples from RentalFlow\'s integration layer that would take a copycat months:')

    api['add_data_sheet'](doc,
        title='Stripe webhook idempotency',
        subtitle='Quietly handles 3-day retries without re-processing.',
        fields=[
            ('Naive implementation', 'Webhook flips booking_status. Done in 1 hour.'),
            ('Production reality', 'Stripe retries up to 3 days. Webhook must check status BEFORE '
                                    'updating. Email send must be idempotent (ledger). Coupon '
                                    'counter must NOT double-increment. Loyalty points must not '
                                    'double-credit. GHL upsert must handle existing contact.'),
            ('Where the time goes', 'A dozen edge cases discovered in production. Each one a '
                                     'bug-hunt + fix + test. ~3-4 weeks of cumulative debugging.'),
        ])

    api['add_data_sheet'](doc,
        title='Twilio 10DLC compliance',
        subtitle='SMS rejected outright if you mess this up.',
        fields=[
            ('Naive implementation', 'Send SMS via Twilio API. Done in 1 hour.'),
            ('Production reality', 'A2P 10DLC registration. Explicit opt-in checkbox on booking form. '
                                    'Stamp customer_phone_sms_consent_at column for audit. STOP/HELP '
                                    'keywords. MARKETING vs TRANSACTIONAL tagging. Carrier sender ID. '
                                    'Tenant-specific opt-out tracking. Phone number normalization (US only).'),
            ('Where the time goes', '2-3 weeks of registration paperwork + compliance fix shipping + '
                                     'edge case discovery. RentalFlow\'s 2026-06-10 compliance fix '
                                     'documented in code + audit memory.'),
        ])

    api['add_data_sheet'](doc,
        title='IMAP unified inbox',
        subtitle='What we built so Ludmila does not pay for FrontApp.',
        fields=[
            ('Naive implementation', 'Use IMAP library to fetch messages. Display them.'),
            ('Production reality', 'Node 22 ESM compatibility (mailparser replaced). UID watermark '
                                    'per folder (prevents re-fetching). MIME parsing edge cases. '
                                    'Message-ID deduplication. Thread reconstruction by In-Reply-To. '
                                    'Encrypted credentials per account. Rule engine for auto-actions. '
                                    'SMTP outbound + AppendToFolder(Sent) so the tenant\'s Gmail '
                                    'still shows the thread. AI reply suggestion via Claude.'),
            ('Where the time goes', 'Documented in project_superadmin_email_live memory — multiple '
                                     'weeks of "why does this hang" + "why is the encoding broken" + '
                                     '"why does Gmail not show my reply." 6+ weeks total.'),
        ])

    api['add_callout'](doc, 'fact',
        'Each of the 11 integrations has a similar story. The cumulative work is the moat. A '
        'copycat starts from zero on each one.')

    api['add_h2'](doc, '4.3  Layer 2 — Multi-tenant correctness')

    api['add_p'](doc,
        'Multi-tenant SaaS is "easy" until you discover the bugs. The interesting bugs are:')

    api['add_bullet'](doc, [
        ('Tenant A\'s cron job accidentally emails Tenant B\'s customers ', True),
        ('because the cron forgot to filter by tenant_id.', False),
    ])
    api['add_bullet'](doc, [
        ('Tenant A\'s admin can view Tenant B\'s booking ', True),
        ('because the booking ID is guessable and the RLS policy uses customer_email instead of tenant_id.', False),
    ])
    api['add_bullet'](doc, [
        ('Tenant A signs up and gets Tenant B\'s data ', True),
        ('because the default tenant_id was set to a sentinel UUID and the upsert path forgot to override.', False),
    ])

    api['add_callout'](doc, 'good',
        'RentalFlow\'s 2026-06-10 audit closed 3 critical + 2 high + 6 medium gaps in this layer '
        'and shipped OBS-2 (drop default tenant_id), converting silent leaks to NOT NULL violations. '
        'The check:scope script verifies the MULTI_TENANT_TABLES set against the live schema. '
        'This is hard-won infrastructure.')

    api['add_h2'](doc, '4.4  Layer 3 — Vertical know-how')

    api['add_p'](doc,
        'Henry built the platform for IAF. Every business rule comes from real operator pain:')

    api['add_kv_table'](doc,
        ['Rule', 'Why it exists'],
        [
            ('Day 1 full price, Day 2+ 30% surcharge',
             'IAF discovered customers booked 3-day rentals at single-day prices. Solved upstream.'),
            ('Weekend price override per product',
             'Saturday/Sunday demand is the real revenue. Some products price differently then.'),
            ('15-min hold + payment expiration',
             'Real-time inventory contention. Two customers can\'t pay for the same slot.'),
            ('Customer SMS opt-in stamp',
             'Twilio 10DLC compliance requires audit trail. RentalFlow stamps timestamp on row.'),
            ('Per-product surface_type setting',
             'IAF found bounce houses on concrete = damages. Surface requirements live in the catalog.'),
            ('Power supply add-on auto-trigger',
             'When customer answers "no, I don\'t have power" — add-on auto-added. Discovered after '
             'IAF shipped a customer\'s order without power 3 times.'),
            ('Driver app proof photos',
             'Insurance claim resolution requires evidence. IAF was losing damage disputes.'),
        ],
        col_widths=[2.4, 4.7])

    api['add_p'](doc,
        'A copycat without an operating partner reaches each of these rules by trial-and-error in '
        'production. Each one is a customer-pain incident before it becomes a feature.')

    api['add_h2'](doc, '4.5  Layer 4 — Operator runtime (the hidden one)')

    api['add_p'](doc,
        'Behind the obvious surfaces sits the infrastructure that keeps a SaaS alive at low cost:')

    api['add_bullet'](doc, '13 cron jobs orchestrating booking lifecycle, quote followup, '
                            'dunning, email-sync, backups, low-stock alerts, campaigns.')
    api['add_bullet'](doc, 'Idempotency ledgers (booking_emails_sent) preventing duplicate sends.')
    api['add_bullet'](doc, 'Outbound webhook retry system with exponential backoff (immediate, +5m, '
                            '+30m, +2h, give up).')
    api['add_bullet'](doc, 'Admin audit log on every mutation. /admin/audit-log queryable.')
    api['add_bullet'](doc, 'PII scrubbing in Sentry breadcrumbs before they leave the server.')
    api['add_bullet'](doc, 'Per-tenant email sender domain (getTenantEmailConfig with custom domain '
                            'mode + default mode).')
    api['add_bullet'](doc, 'Dual S3 + Cloudflare R2 backups for disaster recovery.')

    api['add_callout'](doc, 'info',
        'This is the layer that doesn\'t show up in a demo. It is the layer that keeps tenants '
        'paying without churning. Copycats demo as well as we do. Copycats RUN much worse.')

    api['add_h2'](doc, '4.6  Layer 5 — Flat-pricing positioning')

    api['add_p'](doc,
        'The least technical, but real: $99 flat is now the brand promise. Any competitor who '
        'adopts the same shape loses pricing power; any competitor who keeps per-booking fees '
        'loses the operator-friendly story. The positioning becomes hard to copy without '
        'eroding their own ARPU.')

    api['add_h2'](doc, '4.7  The composite moat')

    api['add_callout'](doc, 'value',
        'Individually, none of these layers is unique. Composed, they form a starting line that '
        'a well-funded copycat reaches in 18-24 months of dedicated work — assuming they have '
        'an operator inside their team. Most copycats don\'t.')
