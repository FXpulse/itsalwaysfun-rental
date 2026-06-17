"""Chapter 13 — Background jobs. 13 scheduled handlers that run the lifecycle."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 13, 'Background Jobs',
        '13 cron jobs orchestrating booking lifecycle, dunning, email sync, backups, and more.',
        audience_tags=['Engineer', 'Operations'])

    api['add_callout'](doc, 'fact',
        'Scheduled via vercel.json — 14 jobs as of 2026-06-17. Every job verifies CRON_SECRET as '
        'Bearer token. 8 of 14 are wrapped with Sentry.withMonitor() for SLA tracking — alerts '
        'trigger on missed runs or execution errors. Schedules in UTC; Ludmila is on '
        'America/New_York (EST/EDT).')

    api['add_h2'](doc, '13.1  Schedule overview')

    api['add_kv_table'](doc,
        ['Job', 'Schedule (UTC)', 'In EST', 'Frequency'],
        [
            ('booking-emails',       '0 14 * * *',  '9am',          'Daily'),
            ('quote-followup',       '0 16 * * *',  '11am',         'Daily'),
            ('quote-hold-reminder',  '0 * * * *',   'top of hour',  'Hourly'),
            ('low-stock-alert',      '0 13 * * *',  '8am',          'Daily'),
            ('weekly-backup',        '0 3 * * 0',   'Sat 10pm',     'Weekly Sunday 3am UTC'),
            ('lead-magnet-resync',   '15 4 * * *',  '11:15pm prev', 'Daily'),
            ('email-sync',           '*/5 * * * *', 'every 5 min',  'Every 5 minutes'),
            ('dunning',              '0 11 * * *',  '6am',          'Daily'),
            ('onboarding-nudge',     '0 15 * * *',  '10am',         'Daily'),
            ('weekly-report',        '0 12 * * 1',  'Mon 7am',      'Weekly Monday'),
            ('webhook-retry',        '*/5 * * * *', 'every 5 min',  'Every 5 minutes'),
            ('campaign-sender',      '*/5 * * * *', 'every 5 min',  'Every 5 minutes'),
            ('google-places-sync',   '0 10 * * *',  '5am',          'Daily'),
            ('cleanup-old-rows',     '0 5 * * *',   'midnight',     'Daily (new 2026-06-17)'),
        ],
        col_widths=[2.2, 1.4, 1.8, 1.7])

    api['add_h2'](doc, '13.2  Cron job data sheets')

    # booking-emails
    api['add_data_sheet'](doc,
        title='booking-emails (daily 9am EST)',
        subtitle='The retention engine. Sends all transactional lifecycle emails.',
        fields=[
            ('Path', '/api/cron/booking-emails'),
            ('What it does', [
                'Scans bookings table for emails due to send today (uses date math)',
                '3 days before event_date → booking_reminder_3d (email + SMS if consent)',
                '1 day after event_date → booking_review_request (email + SMS, marked MARKETING)',
                '90 days after event_date → booking_reengagement_90d (email)',
                '365 days after created_at → booking_anniversary_1y (email)',
                'For each due booking: render template, sendEmail, sendSms if consent',
                'INSERT booking_emails_sent ledger row (unique constraint prevents duplicates)',
            ]),
            ('Tables read', 'bookings, customer_profiles, site_settings, email_templates'),
            ('Tables written', 'booking_emails_sent'),
            ('External effects', 'Resend (email) + Twilio (SMS) per due row'),
            ('Sentry', 'Wrapped with withMonitor("booking-emails")'),
            ('Notable', 'Idempotent: booking_emails_sent (booking_id, email_type) UNIQUE prevents '
                         'duplicate sends if cron runs twice or retries.'),
        ])

    # email-sync
    api['add_data_sheet'](doc,
        title='email-sync (every 5 min)',
        subtitle='The superadmin inbox heartbeat.',
        fields=[
            ('Path', '/api/cron/email-sync'),
            ('What it does', [
                'SELECT email_accounts WHERE is_active = true (typically: Ludmila\'s Gmail + 20i StackMail)',
                'For each account: imap.connect() → list folders → fetch UID > last_synced_uid',
                'Parse RFC822 via mailparser → store in email_messages',
                'Dedupe by Message-ID; match to existing thread by In-Reply-To/References',
                'Run "email rules" (label, mark_read, archive) per account',
                'Update last_synced_uid_per_folder JSONB',
            ]),
            ('Tables read', 'email_accounts, email_folders, email_messages, email_threads, email_rules'),
            ('Tables written', 'email_messages (INSERT), email_threads (UPSERT), email_accounts (UPDATE last_sync_*)'),
            ('External effects', 'IMAP per account. Failures captured to Sentry.'),
            ('Sentry', 'Wrapped with withMonitor("email-sync"). Captures consecutive_failures column.'),
            ('Critical patterns', [
                'UID watermark (last_synced_uid) prevents re-fetching old messages',
                'Single IMAP connection per account per run (avoid Gmail rate-limit)',
                'Empty folder messageset caught explicitly (treated as 0 messages, not fatal)',
                'Encrypted password decrypted at runtime via EMAIL_ENCRYPTION_KEY',
            ]),
        ])

    # dunning
    api['add_data_sheet'](doc,
        title='dunning (daily 6am EST)',
        subtitle='Tenant subscription past-due recovery sequence.',
        fields=[
            ('Path', '/api/cron/dunning'),
            ('What it does', [
                'SELECT tenants WHERE subscription_status = \'past_due\'',
                'For each: compute days since past_due_at',
                'Send day 1 / day 3 / day 7 dunning emails to tenant.owner_email',
                'Day 8: cancel Stripe subscription + flip tenant.subscription_status = \'canceled\' + '
                'set suspended_at (middleware blocks access)',
            ]),
            ('Tables read', 'tenants'),
            ('Tables written', 'tenants (status updates), admin_audit_log'),
            ('External effects', 'Resend emails (×3), Stripe Subscriptions API (cancel), '
                                  'Sentry breadcrumbs for each step'),
            ('Notable', '8-day window matches Stripe\'s default retry pattern + 1 grace day. After '
                         'cancellation, tenant data is preserved (suspended != deleted).'),
        ])

    # weekly-backup
    api['add_data_sheet'](doc,
        title='weekly-backup (Sunday 3am UTC = Saturday 10pm EST)',
        subtitle='Dual-target database export with auto-pruning at both ends.',
        fields=[
            ('Path', '/api/cron/weekly-backup'),
            ('What it does', [
                'For each tenant: SELECT bookings, products, customer_profiles, etc.',
                'Format as CSV files (per entity) + a master JSON dump',
                'Upload to Supabase Storage (backups/ bucket)',
                'Upload same to Cloudflare R2 (rentalflow-backups bucket) for redundancy',
                'Prune Supabase Storage > 84 days old (existing)',
                'Prune R2 > 84 days old via pruneOldBackupsFromR2 (NEW 2026-06-17)',
                'Email link to OPERATOR_REPORT_EMAIL',
            ]),
            ('Tables read', 'Every multi-tenant table'),
            ('Tables written', 'None'),
            ('External effects', 'Supabase Storage + Cloudflare R2 + Resend (link email)'),
            ('Sentry', 'Wrapped with withMonitor("weekly-backup")'),
            ('Retention', '84 days at both targets — only deletes files matching the '
                            'backup-YYYY-MM-DD.json pattern (never blind deletes by lastModified)'),
            ('Notable', [
                'Restore drill: documented in docs/runbook-restore.md (last test 2026-06-16)',
                'See runbook-restore-findings-2026-06-16.md for known restore gotchas',
            ]),
        ])

    # cleanup-old-rows
    api['add_data_sheet'](doc,
        title='cleanup-old-rows (daily 5am UTC = midnight EST)  — NEW 2026-06-17',
        subtitle='Daily archival cron for unbounded-growth tables.',
        fields=[
            ('Path', '/api/cron/cleanup-old-rows'),
            ('What it does', [
                'webhook_deliveries succeeded=true AND created_at < now − 30d → DELETE',
                'webhook_deliveries succeeded=false AND created_at < now − 90d → DELETE '
                '(max_attempts=4 exhausts in ~3 hours, so 90d is plenty for debugging)',
                'portal_otp_codes consumed_at IS NOT NULL OR expires_at < now − 7d → DELETE',
                'Returns row counts + retention config in JSON for visibility',
            ]),
            ('Explicit allowlist of tables that stay forever', [
                'booking_emails_sent (idempotency ledger)',
                'admin_audit_log (compliance trail)',
                'loyalty_transactions (financial audit)',
                'inventory_unit_movements (state machine history)',
                'contact_messages (CRM)',
                'email_messages (superadmin inbox archive)',
            ]),
            ('Sentry', 'Wrapped with withMonitor("cleanup-old-rows")'),
            ('Why this cron exists', [
                'webhook_deliveries grew unbounded — caused /admin/webhooks query latency drift',
                'portal_otp_codes are zero-value once consumed/expired; ~1 week audit is plenty',
                'Listed as an open recommendation in earlier audit drafts; closed 2026-06-17',
            ]),
        ])

    # webhook-retry
    api['add_data_sheet'](doc,
        title='webhook-retry (every 5 min)',
        subtitle='Exponential backoff for failed outbound webhooks.',
        fields=[
            ('Path', '/api/cron/webhook-retry'),
            ('What it does', [
                'SELECT webhook_deliveries WHERE succeeded = false AND next_retry_at <= now() AND attempt_count < 4',
                'For each: re-send POST to tenant_webhooks.url with HMAC-SHA256 X-RentalFlow-Signature',
                'Backoff schedule: immediate, +5m, +30m, +2h. After 4 attempts, give up.',
                'Update webhook_deliveries with response_status, response_body, succeeded, next_retry_at',
            ]),
            ('Tables read', 'webhook_deliveries, tenant_webhooks'),
            ('Tables written', 'webhook_deliveries (UPDATE)'),
            ('External effects', 'HTTP POST to each tenant\'s webhook URL'),
            ('Notable', 'webhook_deliveries grows unboundedly (no archival yet — open recommendation).'),
        ])

    # campaign-sender
    api['add_data_sheet'](doc,
        title='campaign-sender (every 5 min)',
        subtitle='Marketing campaign delivery loop.',
        fields=[
            ('Path', '/api/cron/campaign-sender'),
            ('What it does', [
                'SELECT campaigns WHERE status IN (\'scheduled\', \'sending\') AND scheduled_at <= now()',
                'For each: SELECT campaign_recipients WHERE succeeded IS NULL',
                'Send Resend email per recipient',
                'Update campaign_recipients (succeeded, resend_id, sent_at, error_message)',
                'When all recipients processed: campaigns.status = \'sent\'',
            ]),
            ('External effects', 'Resend (potentially thousands of emails per run)'),
            ('Notable', 'No throttle today — relies on Resend\'s account-level rate limit. Could '
                         'trip reputation if a tenant sends a 10k-recipient campaign in one burst.'),
        ])

    # google-places-sync
    api['add_data_sheet'](doc,
        title='google-places-sync (daily 5am EST)',
        subtitle='Aggregate Google reviews into customer_reviews.',
        fields=[
            ('Path', '/api/cron/google-places-sync'),
            ('What it does', [
                'SELECT tenants WHERE google_places_cache exists (place_id resolved)',
                'For each: Google Places API → fetch reviews + rating + photos',
                'Upsert customer_reviews from new Google reviews',
                'Update google_places_cache (last_synced_at, reviews JSONB)',
                'If new negative review (≤ 3 stars): alert tenant owner via Resend',
            ]),
            ('External effects', 'Google Places API + Resend (alert on negative)'),
            ('Notable', 'Place ID resolution is brittle (Google URL formats change). Cached lookups '
                         'are refreshed daily but the place_id rarely needs to change.'),
        ])

    # quote-followup + quote-hold-reminder
    api['add_data_sheet'](doc,
        title='quote-followup (daily 11am EST) + quote-hold-reminder (hourly)',
        subtitle='Quote lifecycle nudges.',
        fields=[
            ('quote-followup', [
                '/api/cron/quote-followup',
                'SELECT quotes WHERE status IN (\'sent\', \'viewed\') AND sent_at < now - 3 days',
                'Send "Your quote is waiting" reminder email',
            ]),
            ('quote-hold-reminder', [
                '/api/cron/quote-hold-reminder',
                'SELECT quotes WHERE expires_at BETWEEN now() AND now() + 6 hours',
                'Send "Your quote expires in 6 hours" email',
            ]),
        ])

    # low-stock-alert
    api['add_data_sheet'](doc,
        title='low-stock-alert (daily 8am EST)',
        subtitle='Inventory low-stock email to operator.',
        fields=[
            ('Path', '/api/cron/low-stock-alert'),
            ('What it does', [
                'For each tenant: SELECT inventory_items WHERE quantity_owned - quantity_in_use < low_stock_threshold',
                'AND low_stock_alerted_at IS NULL OR < now - 7 days (rate-limit to weekly)',
                'Send single email to tenant.notification_email listing low items',
                'Update inventory_items.low_stock_alerted_at',
            ]),
            ('Notable', 'Rate-limited to weekly per item to prevent email fatigue.'),
        ])

    # lead-magnet-resync, onboarding-nudge, weekly-report
    api['add_data_sheet'](doc,
        title='lead-magnet-resync + onboarding-nudge + weekly-report',
        subtitle='Marketing + growth-loop crons.',
        fields=[
            ('lead-magnet-resync (daily 11:15pm EST)', [
                '/api/cron/lead-magnet-resync',
                'Resync lead magnet downloads (1099 tracker, etc.) → GHL contacts/tags',
            ]),
            ('onboarding-nudge (daily 10am EST)', [
                '/api/cron/onboarding-nudge',
                'For tenants < 7 days old with incomplete onboarding_checklist → send nudge email',
            ]),
            ('weekly-report (Monday 7am EST)', [
                '/api/cron/weekly-report',
                'Per tenant: aggregate previous week (revenue, bookings, top product, etc.)',
                'Send digest email to tenant.notification_email',
            ]),
        ])

    api['add_h2'](doc, '13.3  CRON_SECRET pattern')

    api['add_p'](doc,
        'Every cron route opens with the same guard:')

    api['add_mono_block'](doc, """
   export async function GET(req: Request) {
     const auth = req.headers.get('authorization')
     if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
       return new Response('unauthorized', { status: 401 })
     }
     ...
   }
""")

    api['add_callout'](doc, 'good',
        'CRON_SECRET is a non-default-shaped token rotated whenever a new secret is needed. '
        'Vercel auto-passes it via Authorization header to every scheduled invocation. Manual '
        'invocations require setting the header explicitly — preventing accidental browser-based '
        'cron execution.')
