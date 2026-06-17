"""Chapter 15 — Integrations. 11 third-party services, deeply."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 15, 'Integrations',
        '11 third-party services orchestrating payments, communication, observability, and AI.',
        audience_tags=['Engineer', 'Acquirer'])

    api['add_callout'](doc, 'fact',
        '11 integrations live. Each wraps via a thin client in lib/. No SDK except for Stripe + '
        'Supabase + Sentry — everything else uses direct HTTP calls for transparency.')

    api['add_h2'](doc, '15.1  Integration grid')

    api['add_kv_table'](doc,
        ['Service', 'Used for', 'Wrapper'],
        [
            ('Stripe + Stripe Connect',  'Payments + Connect payouts',  'lib/stripe/server.ts, billing.ts, connect.ts'),
            ('GoHighLevel',              'CRM + automation + GHL forms', 'lib/ghl/client.ts'),
            ('Twilio',                   'SMS lifecycle + 10DLC',        'lib/sms/send.ts'),
            ('Resend',                   'Transactional + marketing email', 'lib/email/send.ts, send-template.ts'),
            ('Supabase',                 'Postgres + Auth + Storage + Realtime', 'lib/supabase/*'),
            ('Sentry',                   'Error tracking + cron monitors', 'lib/sentry-cron.ts, scrub-pii.ts'),
            ('Google Places API',        'Reviews aggregation',          'lib/google-places/*'),
            ('IMAP (imapflow)',          'Superadmin inbox inbound',     'lib/email/imap-client.ts'),
            ('SMTP (nodemailer)',        'Superadmin inbox outbound',    'lib/email/smtp-client.ts'),
            ('AWS S3 + Cloudflare R2',   'Weekly backups (dual target)', 'lib/backup-r2.ts'),
            ('Upstash Redis',            'Rate limiting',                'lib/rate-limit.ts'),
            ('Anthropic Claude + OpenAI', 'Admin assistant + public chat', 'lib/ai/* (inline in API routes)'),
        ],
        col_widths=[2.0, 2.6, 2.5])

    api['add_h2'](doc, '15.2  Stripe + Stripe Connect')

    api['add_data_sheet'](doc,
        title='Stripe + Stripe Connect',
        subtitle='Payments + tenant-owned payouts.',
        fields=[
            ('Wrapper files', 'lib/stripe/server.ts, lib/stripe/billing.ts, lib/stripe/connect.ts'),
            ('Auth', 'STRIPE_SECRET_KEY env. API version 2024-09-30.acacia pinned in code.'),
            ('Used by', [
                '/admin/settings/payments (Connect onboarding, dashboard link)',
                '/admin/settings/billing (tenant subscription portal)',
                '/api/webhooks/stripe (payment, refund, subscription events)',
                '/api/bookings/check-and-hold (PaymentIntent creation)',
                '/api/gift-cards/purchase (gift card PaymentIntent)',
                '/api/cron/dunning (subscription cancellation)',
            ]),
            ('Key flows', [
                'Booking: check-and-hold → PaymentIntent (transfer_data.destination = tenant Connect acct) '
                '→ customer pays → webhook → confirmed',
                'Tenant signup: createSubscriptionCheckout → Stripe-hosted checkout → webhook → tenant active',
                'Connect onboarding: createConnectAccount → createOnboardingLink → tenant completes KYC '
                '→ getConnectStatus polled',
                'Refund: stripe.refunds.create → webhook charge.refunded → booking cancelled + coupon counter -1',
            ]),
            ('Idempotency', 'CRITICAL. Webhook conditional update (only flip status if pending_payment). '
                             'Late retries up to 3 days. Email send idempotent via booking_emails_sent ledger.'),
            ('Risks', [
                'Late retries could reprocess manually cancelled bookings — mitigated by status check',
                'GHL upsert in webhook is fire-and-forget — failures invisible without log inspection',
                'Connect account token refresh not explicitly handled (long-lived account ID)',
            ]),
        ])

    api['add_h2'](doc, '15.3  GoHighLevel (GHL)')

    api['add_data_sheet'](doc,
        title='GoHighLevel v2 API',
        subtitle='CRM + outbound automation + inbound forms.',
        fields=[
            ('Wrapper file', 'lib/ghl/client.ts'),
            ('Auth', 'GHL_API_KEY (pit-* Bearer) + GHL_LOCATION_ID. Versioned 2021-07-28.'),
            ('Bidirectional', [
                'OUTBOUND: Stripe webhook → upsertContact + addContactNote + addContactTags',
                'INBOUND: GHL form submission → /api/webhooks/ghl → create booking + Stripe PI',
                'LOOKUP: Admin email search → lookupContactByEmail (read-only)',
            ]),
            ('Field mapping (outbound)', [
                'contact.firstName ← booking.customer_first_name',
                'contact.lastName ← booking.customer_last_name',
                'contact.email ← booking.customer_email',
                'contact.phone ← booking.customer_phone (E.164)',
                'contact.address1 ← booking.customer_address',
                'tags ← ["customer", "booking_confirmed"]',
                'note ← "Booking #{id} for {product_name} on {event_date}. Amount: ${total}. Status: confirmed."',
            ]),
            ('Field mapping (inbound)', [
                'custom_fields.event_date → bookings.event_date',
                'custom_fields.start_time → bookings.start_time',
                'custom_fields.end_time → bookings.end_time',
                'custom_fields.product_slug → resolved via products.slug lookup',
                'opportunity_id → bookings.ghl_opportunity_id (stored for stage sync)',
            ]),
            ('Risks', [
                'addContactNote + addContactTags are NOT idempotent — duplicates on webhook retry',
                'Token has no expiry (long-lived) — rotation requires admin action',
                'x-ghl-secret validation uses simple string equality (timing-attack vulnerable)',
                'Custom field names are hard-coded — GHL field renames break silently',
            ]),
        ])

    api['add_h2'](doc, '15.4  Twilio SMS')

    api['add_data_sheet'](doc,
        title='Twilio Programmable Messaging',
        subtitle='A2P 10DLC-compliant SMS.',
        fields=[
            ('Wrapper file', 'lib/sms/send.ts'),
            ('Auth', 'TWILIO_ACCOUNT_SID (AC*) + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER (E.164). '
                     'Basic auth (base64 SID:TOKEN).'),
            ('Compliance', [
                'A2P 10DLC registered — required for US transactional SMS',
                'Explicit per-customer opt-in: customer_phone_sms_consent_at stamped on booking row',
                'Default-unchecked SMS consent checkbox on /order-by-date',
                'MARKETING messages clearly tagged (review_request)',
                'STOP / HELP keywords automatically handled by Twilio',
            ]),
            ('Templates', [
                'booking_confirmation — sent from Stripe webhook (customer + admin)',
                'booking_reminder_3d — daily cron',
                'booking_review_request — daily cron (MARKETING)',
            ]),
            ('Risks', [
                'No retry on failure — failed SMS just logged',
                'Phone normalization US-only (+1) — international fails silently',
                '10DLC daily caps not handled by code — relies on Twilio account-level',
            ]),
        ])

    api['add_h2'](doc, '15.5  Resend (transactional + marketing email)')

    api['add_data_sheet'](doc,
        title='Resend',
        subtitle='Outbound transactional + campaign emails.',
        fields=[
            ('Wrapper files', 'lib/email/send.ts (low-level), lib/email/send-template.ts (template '
                               'rendering), lib/email/scheduled-emails.ts (lifecycle)'),
            ('Auth', 'RESEND_API_KEY Bearer. EMAIL_FROM + EMAIL_REPLY_TO env (override per-tenant).'),
            ('Per-tenant sender — getTenantEmailConfig', [
                'Mode 1 (custom domain + inbox_enabled): From = "Brand <bookings@custom_domain>", '
                'Reply-To = bookings@custom_domain. Requires Resend domain verification (SPF/DKIM).',
                'Mode 2 (default): From = "Brand <noreply@email.getrentalflow.com>", '
                'Reply-To = tenant.notification_email. Zero setup, shared reputation domain.',
                'Brand name sanitized for header injection ([<>"] stripped)',
            ]),
            ('Lifecycle templates (7)', [
                'booking_confirmation — Stripe webhook, on payment success',
                'booking_reminder_3d — daily cron, 3d before event',
                'booking_review_request — daily cron, 1d after event',
                'booking_reengagement_90d — daily cron, 90d after event',
                'booking_anniversary_1y — daily cron, 365d after booking created',
                'gift_card_purchase — Stripe webhook on gift card PI success',
                'quote_sent — manual from /admin/quotes/new',
            ]),
            ('Idempotency', 'booking_emails_sent ledger: UNIQUE (booking_id, email_type). Cron-safe.'),
            ('Risks', [
                'Template render uses {{{var}}} triple-brace — XSS if caller passes unsanitized HTML',
                'Multi-tenant From: requires Resend domain verification — misconfig = spam folder',
                'Mode 2 shares reputation across all tenants — one spammy tenant damages all',
            ]),
        ])

    api['add_h2'](doc, '15.6  Supabase')

    api['add_data_sheet'](doc,
        title='Supabase (DB + Auth + Storage + Realtime)',
        subtitle='The platform spine.',
        fields=[
            ('Wrapper files', 'lib/supabase/server.ts (RSC + actions), lib/supabase/admin.ts '
                               '(service-role + scope proxy), lib/supabase/client.ts (browser)'),
            ('Env vars', 'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (browser-safe), '
                          'SUPABASE_SERVICE_ROLE_KEY (server-only, bypasses RLS)'),
            ('Critical pattern', 'createAdminClient({ unscoped: true }) explicitly bypasses the '
                                  'tenant-scoping proxy — used for superadmin cross-tenant operations. '
                                  'Every call site is reviewed.'),
            ('Realtime', 'tables in supabase_realtime publication broadcast change events; admin '
                          'dashboard uses for live updates'),
            ('Storage', 'Buckets: site-assets (logos, hero), proofs (delivery photos), backups '
                          '(weekly export), w9-forms (driver tax docs — signed URLs only)'),
            ('Risks', [
                'Admin client bypasses all RLS — misconfigured policies leak tenant data',
                'Service role key is the highest-value secret — Vercel env protected',
                'Session refresh only in middleware — long server actions may expire mid-flight',
                'Signed URLs default 1-hour TTL (W9 view 403s after)',
            ]),
        ])

    api['add_h2'](doc, '15.7  Sentry')

    api['add_data_sheet'](doc,
        title='Sentry (errors + cron monitors)',
        subtitle='Production observability.',
        fields=[
            ('Wrapper files', 'lib/sentry-cron.ts (withMonitor helper), lib/sentry/scrub-pii.ts'),
            ('Env vars', 'NEXT_PUBLIC_SENTRY_DSN (browser), SENTRY_DSN (server), SENTRY_ORG, '
                          'SENTRY_PROJECT, SENTRY_AUTH_TOKEN (releases)'),
            ('Cron monitors', '7 of 13 jobs wrapped with withMonitor: booking-emails, quote-followup, '
                                'quote-hold-reminder, low-stock-alert, email-sync, lead-magnet-resync, weekly-backup'),
            ('PII scrubbing', 'scrub-pii.ts redacts customer names, emails, phone numbers before '
                                'breadcrumbs/errors leave the server'),
            ('Risks', [
                'Cron schedule in Sentry must match vercel.json — drift = false alerts',
                'PII regex is best-effort — edge formats may leak',
                'Sentry DSN exposed in browser — attackers can spam quota',
            ]),
        ])

    api['add_h2'](doc, '15.8  Google Places API')

    api['add_data_sheet'](doc,
        title='Google Places API (New)',
        subtitle='Aggregate Google Business reviews per tenant.',
        fields=[
            ('Wrapper files', 'lib/google-places/client.ts, lib/google-places/sync.ts'),
            ('Auth', 'GOOGLE_PLACES_API_KEY (Places API New scope)'),
            ('Cron', '/api/cron/google-places-sync daily 10am UTC'),
            ('Flow', [
                '/admin/site → admin pastes GBP URL',
                'syncPlaceDataForTenant(tenantId, url) → extractPlaceIdentifier()',
                'Try URL → place_id direct, then text search with location bias, then CID lookup',
                'On match: getPlaceDetails() → upsert google_places_cache',
                'Display: /reviews page reads google_places_cache.reviews JSONB',
            ]),
            ('Notable', 'URL parsing is brittle (Google changes URL formats). Cache marked '
                         'pending_index if resolution fails. IAF GBP is known not-yet-indexed on the '
                         'public Maps search (project_iaf_google_places_indexing memory).'),
        ])

    api['add_h2'](doc, '15.9  IMAP + SMTP (superadmin inbox)')

    api['add_data_sheet'](doc,
        title='IMAP (inbound) + SMTP (outbound) via imapflow + nodemailer',
        subtitle='Per-tenant external email integration for the superadmin unified inbox.',
        fields=[
            ('Wrapper files', 'lib/email/imap-client.ts, lib/email/smtp-client.ts'),
            ('Auth', 'Per-account credentials stored encrypted in email_accounts table (AES via '
                     'EMAIL_ENCRYPTION_KEY). Decrypted at runtime only.'),
            ('Cron', '/api/cron/email-sync every 5 min'),
            ('Patterns', [
                'IMAP fetch with UID watermark (last_synced_uid per folder)',
                'Single connection per account per run',
                'Empty folder messageset caught explicitly',
                'Sent folder: after smtpSend, AppendToFolder(Sent, rfc822) so tenant\'s Gmail sees the thread',
            ]),
            ('Risks', [
                'Credentials encrypted — leak of EMAIL_ENCRYPTION_KEY = all tenant emails compromised',
                'IMAP 5-min polling — 5-15 min latency before email appears in inbox',
                'RFC822 reconstruction simplified — Sent folder copy may not perfectly match what was sent',
                'Gmail often needs app-specific password — tenant confusion point',
            ]),
        ])

    api['add_h2'](doc, '15.10  Storage: S3 + Cloudflare R2 + Upstash')

    api['add_data_sheet'](doc,
        title='AWS S3 + Cloudflare R2 + Upstash Redis',
        subtitle='Backups (dual) + rate limiting.',
        fields=[
            ('AWS S3', '@aws-sdk/client-s3. Weekly DB backup destination. Env: AWS_ACCESS_KEY_ID, '
                        'AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME.'),
            ('Cloudflare R2', 'S3-compatible (lib/backup-r2.ts). Second backup target for redundancy. '
                                'Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.'),
            ('Upstash Redis', 'KV REST API. Sliding-window rate limits + ephemeral caching. Env: '
                                'KV_REST_API_URL, KV_REST_API_TOKEN. Fail-open if unreachable.'),
            ('Notable', 'Dual backup target means a single bucket loss doesn\'t lose the data. '
                         'No retention policy yet — backups accumulate. Open recommendation.'),
        ])

    api['add_h2'](doc, '15.11  AI: Claude + OpenAI')

    api['add_data_sheet'](doc,
        title='Anthropic Claude API + OpenAI (gpt-4o-mini)',
        subtitle='Admin assistant + public chat + email reply suggestion.',
        fields=[
            ('Where used', [
                '/api/admin/assistant — Claude. Tenant-scoped. Tools: get_bookings_for_range, '
                'revenue_summary, customer_stats, product_performance. Max 6 tool rounds, temp 0.3.',
                '/api/chat/public — gpt-4o-mini. Public. Tools: get_products, check_availability, '
                'search_faqs (READ-ONLY). Max 6 rounds, temp 0.4. Rate-limited 10/5min/IP.',
                '/superadmin/email/[threadId] — Claude. Suggests reply drafts based on KB articles.',
                '/superadmin/support — Claude. AI triage on incoming tickets (ai_category, ai_priority, '
                'ai_suggested_article_id, ai_confidence).',
            ]),
            ('Tools pattern', 'Read-only — AI never mutates state. Catalog and bookings can be read; '
                                'no email/SMS/booking creation via AI.'),
            ('Cost control', 'Public chat: in-memory per-process rate limit + max 6 tool rounds. '
                              'Admin assistant: no public surface, only authenticated.'),
        ])

    api['add_h2'](doc, '15.12  Audit logging pattern')

    api['add_p'](doc,
        'lib/audit.ts → logAuditEvent({ userEmail, userRole, action, entityType, entityId, details }). '
        'Writes to admin_audit_log with IP from x-forwarded-for, User-Agent from request header. '
        'Failures swallow silently — audit should never break the action. Visibility: '
        '/admin/audit-log page (RLS-filtered per tenant).')

    api['add_kv_table'](doc,
        ['Action logged', 'Where it fires'],
        [
            ('booking.marked_as_paid',       '/admin/bookings/[id] manual confirm'),
            ('booking.refunded',             '/admin/bookings/[id] refund button'),
            ('booking.cancelled',            '/admin/bookings/[id] cancel button'),
            ('gift_card.redeemed',           'webhook on use + admin manual mark-redeemed'),
            ('gift_card.deactivated',        '/admin/gift-cards admin action'),
            ('user.role_changed',            '/admin/users role dropdown'),
            ('coi.requested / coi.cancelled', '/admin/coi'),
            ('damage.recorded',              '/admin/bookings/[id] damage panel'),
            ('coupon.applied',               'Stripe webhook on payment success'),
            ('expense.added',                '/admin/bookings/[id] expense form'),
            ('payout_request.approved/denied/processed', '/admin/loyalty'),
        ],
        col_widths=[2.5, 4.6])

    api['add_h2'](doc, '15.13  Outbound webhook system')

    api['add_data_sheet'](doc,
        title='Outbound webhooks',
        subtitle='Tenant-registered URLs that get pinged on platform events.',
        fields=[
            ('Tables', 'tenant_webhooks (registrations), webhook_deliveries (attempt log)'),
            ('Events', 'booking.created, booking.confirmed, booking.cancelled, booking.paid, '
                        'customer.created, quote.sent, quote.approved'),
            ('Signature', 'X-RentalFlow-Signature header. Value = sha256=hex(hmac_sha256(secret, JSON body)). '
                           'Tenant uses constant-time compare to validate.'),
            ('Retry', 'Exponential backoff: immediate, +5m, +30m, +2h. Max 4 attempts. '
                       'cron /api/cron/webhook-retry every 5 min processes due retries.'),
            ('Risks', [
                'webhook_deliveries grows unboundedly — no archival policy (open recommendation)',
                'Receiver can\'t signal "permanent failure" — 400-class responses still retry',
                'Many failed deliveries without alert visibility — admin must check the table',
            ]),
        ])
