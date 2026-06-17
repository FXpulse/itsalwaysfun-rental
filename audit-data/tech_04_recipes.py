"""Tech 4 — Common Recipes. How to do the 10 things you'll do most often."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 4, 'Common Recipes',
        'The 10 things you\'ll do most often. Each one: where to look + what to change + what to test.',
        audience_tags=['New Engineer'])

    api['add_callout'](doc, 'info',
        'These recipes describe HOW the codebase wants you to do common tasks. Diverging is '
        'fine for good reasons, but the convention buys you free safety nets (auth checks, '
        'tenant scoping, revalidate logic) and onboarding clarity for the next person.')

    api['add_h2'](doc, '4.1  Add a new admin page')

    api['add_data_sheet'](doc,
        title='Add a new admin page',
        subtitle='Example: /admin/sales-reports',
        fields=[
            ('Create folder',
             'mkdir -p app/admin/sales-reports'),
            ('page.tsx',
             'Server component. Use requireStaffOrAdmin() from lib/auth/roles. Read data via '
             'createAdminClient() (auto-tenant-scoped). Render client components if needed.'),
            ('actions.ts (optional)',
             '"use server" at top. Each action: requireStaffOrAdmin → Zod validate → Supabase '
             'mutation → revalidatePath → return ok/error. Pattern matches existing actions.ts files.'),
            ('Layout',
             'Inherits app/admin/layout.tsx automatically — header, sidebar, role gate.'),
            ('Nav entry',
             'Edit app/admin/AdminNavClient.tsx (or wherever the sidebar lives) to add the new link.'),
            ('Help page',
             'Update app/admin/help/HelpClient.tsx with a short description (per memory: every '
             'new tenant-facing feature gets a Help entry).'),
            ('Test',
             'Visit /admin/sales-reports as admin (should work) and as customer (should redirect). '
             'Add a unit test for any non-trivial server action.'),
        ])

    api['add_h2'](doc, '4.2  Add a new email template')

    api['add_data_sheet'](doc,
        title='Add a new transactional email',
        subtitle='Example: booking_review_request_followup',
        fields=[
            ('Seed the template',
             'Add to supabase/<feature>_email_templates.sql. INSERT into email_templates with '
             'key, label, subject, email_title, body_html, body_text, sms_body (optional), '
             'available_vars[], is_active=true. Also update seed_default_email_templates() function.'),
            ('Apply migration',
             'supabase db query --linked --yes -f supabase/<feature>_email_templates.sql'),
            ('Wire the trigger',
             'Where does this fire? Stripe webhook? Cron? Manual button? Use sendTemplated(key, vars) '
             'from lib/email/send-template.ts. Read getTenantEmailConfig(tenantId) for the From/Reply-To.'),
            ('Idempotency',
             'If it could fire twice (cron, webhook retry, etc.), call recordSend(booking_id, '
             'email_type) and check before send. Pattern matches lib/email/scheduled-emails.ts.'),
            ('Render preview',
             'Add to /admin/email-templates UI so the operator can preview + override the template.'),
            ('Test',
             'Add a case to tests/unit/email-templates if non-trivial. Manual: trigger the path '
             '+ check Resend dashboard for delivery.'),
        ])

    api['add_h2'](doc, '4.3  Add a new cron job')

    api['add_data_sheet'](doc,
        title='Add a new scheduled job',
        subtitle='Example: weekly_inventory_report',
        fields=[
            ('Route file',
             'mkdir -p app/api/cron/weekly-inventory-report && create route.ts.'),
            ('Auth boilerplate',
             'First line: check Authorization === `Bearer ${process.env.CRON_SECRET}`. If not, '
             'return 401. Copy from any existing cron route.'),
            ('Sentry wrapper',
             'Wrap the handler body with withCronMonitor("weekly-inventory-report") from '
             'lib/sentry-cron.ts. Pass the schedule. Sentry will SLA-monitor it.'),
            ('Logic',
             'Use createAdminClient({ unscoped: true }) for cross-tenant queries; createAdminClient() '
             'for tenant-specific. Idempotency: write a check-and-skip pattern using a ledger if '
             'the job could be re-run.'),
            ('Schedule in vercel.json',
             'Add { "path": "/api/cron/weekly-inventory-report", "schedule": "<CRON>" } to '
             'vercel.json. Use UTC. Verify with crontab.guru.'),
            ('Deploy + manually trigger',
             'After deploy: curl https://<host>/api/cron/<name> -H "Authorization: Bearer $CRON_SECRET". '
             'Verify Sentry monitor shows up.'),
        ])

    api['add_h2'](doc, '4.4  Add a new database column')

    api['add_data_sheet'](doc,
        title='Add a column to an existing table',
        subtitle='Example: bookings.customer_dietary_notes text',
        fields=[
            ('Write migration',
             'supabase/add_dietary_notes.sql with ALTER TABLE bookings ADD COLUMN IF NOT EXISTS '
             'customer_dietary_notes text. Idempotent.'),
            ('Append to ALL_MIGRATIONS.sql',
             'In dependency order.'),
            ('Apply locally',
             'supabase db query --linked --yes -f supabase/add_dietary_notes.sql'),
            ('Regenerate types',
             'npm run supabase:types updates types/database.ts.'),
            ('Update UI',
             'Wherever bookings are read/written. Type-check is your friend here.'),
            ('Update SCHEMA_BASELINE.sql',
             'pg_dump --schema-only > supabase/SCHEMA_BASELINE.sql (after migration applied).'),
        ])

    api['add_h2'](doc, '4.5  Add a new tenant-scoped table')

    api['add_data_sheet'](doc,
        title='Add a new tenant-scoped table',
        subtitle='Example: tenant_certifications',
        fields=[
            ('Migration',
             'CREATE TABLE tenant_certifications (id uuid PK, tenant_id uuid NOT NULL REFERENCES tenants(id), ...). '
             'Idempotent. Add CREATE INDEX on tenant_id. Add RLS policy + ENABLE ROW LEVEL SECURITY.'),
            ('lib/tenant/scope.ts',
             'Add "tenant_certifications" to MULTI_TENANT_TABLES.'),
            ('npm run check:scope',
             'Verifies the new table is recognized. Must pass.'),
            ('UI / actions',
             'Standard pattern: createAdminClient() — proxy handles tenant_id injection automatically.'),
            ('Test',
             'Add an integration test asserting cross-tenant isolation. Pattern matches '
             'tests/integration/multi-tenant-isolation.test.ts.'),
        ])

    api['add_callout'](doc, 'warn',
        'If the new table has CHILD-only data (no tenant_id, only parent FK), instead add it '
        'to INTENTIONALLY_NOT_SCOPED in scope.ts and verify the parent has tenant_id.')

    api['add_h2'](doc, '4.6  Add a Stripe webhook handler')

    api['add_p'](doc,
        'You usually don\'t. The webhook is one big switch over event.type — extend it '
        'rather than add a parallel handler. Pattern:')

    api['add_mono_block'](doc, """
   // app/api/webhooks/stripe/route.ts (excerpt)
   switch (event.type) {
     case 'payment_intent.succeeded': {
       const pi = event.data.object as Stripe.PaymentIntent
       const type = pi.metadata?.type || 'booking'  // discriminate by metadata
       if (type === 'booking')        await handleBookingPaid(pi)
       else if (type === 'extension') await handleExtensionPaid(pi)
       else if (type === 'gift_card') await handleGiftCardPaid(pi)
       break
     }
     case 'charge.refunded': { ... }
     // add your new case here
   }
""")

    api['add_callout'](doc, 'warn',
        'CRITICAL: every handler must be idempotent. Check state BEFORE updating. Stripe '
        'retries for up to 3 days. Read the existing handleBookingPaid as the reference.')

    api['add_h2'](doc, '4.7  Add a programmatic v1 API endpoint')

    api['add_data_sheet'](doc,
        title='Add an endpoint to /api/v1/*',
        subtitle='Example: GET /api/v1/quotes',
        fields=[
            ('Route file',
             'mkdir -p app/api/v1/quotes && create route.ts.'),
            ('Auth boilerplate',
             'Use authenticateApiKey({ scope: \'quotes:read\' }) from lib/api/auth. Returns '
             'tenant_id or 401/403.'),
            ('Rate limit (recommended)',
             'rateLimit(`v1:${tenant_id}`, { max: 60, windowSeconds: 60 }) from lib/rate-limit.'),
            ('Query + response shape',
             'Match conventions of existing v1 endpoints. { items: [...], count, next_cursor } '
             'shape. Map cents to cents (don\'t convert dollars in API).'),
            ('Document',
             'Add the endpoint to the OpenAPI spec at app/api/v1/docs/* (when that ships per '
             'recommendation REC-DOC-2).'),
        ])

    api['add_h2'](doc, '4.8  Add a new outbound webhook event')

    api['add_data_sheet'](doc,
        title='Fire a new event to tenant_webhooks subscribers',
        subtitle='Example: booking.completed',
        fields=[
            ('Where to fire',
             'Find the code path that completes the action (e.g. when booking_status flips to '
             '"completed"). Call dispatchWebhook(tenant_id, "booking.completed", payload) from '
             'lib/webhooks/dispatch.ts.'),
            ('Payload shape',
             'Keep it consistent with other events. id + key fields. Avoid sensitive data. '
             'The receiver should reconstruct context from the id via API.'),
            ('Tenant opt-in',
             'tenant_webhooks.events[] must include "booking.completed" for any registered '
             'webhook to receive the event. Operator manages this in /admin/webhooks.'),
            ('Retry behavior',
             'Built in. cron webhook-retry handles failed deliveries with exponential backoff.'),
        ])

    api['add_h2'](doc, '4.9  Add a Sentry breadcrumb / capture')

    api['add_p'](doc, 'For an unexpected error that should NOT throw user-facing:')

    api['add_mono_block'](doc, """
   import * as Sentry from '@sentry/nextjs'

   try {
     await riskyOperation()
   } catch (e) {
     Sentry.captureException(e, {
       tags: { area: 'ghl-sync' },
       extra: { tenant_id, booking_id },
     })
     // Continue — this is best-effort
   }
""")

    api['add_callout'](doc, 'info',
        'PII (customer names, emails, phone numbers) is scrubbed by lib/sentry/scrub-pii.ts '
        'before leaving the server. Safe to pass full booking objects in `extra`.')

    api['add_h2'](doc, '4.10  Onboard a new tenant')

    api['add_p'](doc, 'This is operational, not code, but you should understand it:')

    api['add_numbered'](doc, 'Tenant signs up via /signup → tenants row created.')
    api['add_numbered'](doc, 'On signup: seed_default_email_templates(tenant_id) + '
                              'seed_default_site_settings(tenant_id) populate baseline config.')
    api['add_numbered'](doc, 'Tenant chooses subdomain OR maps custom domain in /admin/site.')
    api['add_numbered'](doc, 'Custom domain: Vercel domain config + DNS records (CNAME). Ludmila '
                              'handles this side via Vercel UI.')
    api['add_numbered'](doc, 'Stripe Connect onboarding via /admin/settings/payments → tenant '
                              'completes KYC at Stripe.')
    api['add_numbered'](doc, 'Tenant adds products via /admin/products. Bulk import via /admin/bulk-upload.')
    api['add_numbered'](doc, 'Onboarding checklist in /admin/onboarding nudges remaining setup.')
    api['add_numbered'](doc, 'After 7 days: cron onboarding-nudge fires reminders for incomplete steps.')

    api['add_callout'](doc, 'info',
        'For the comprehensive onboarding playbook + GHL workflows: see '
        'C:\\Users\\chemm\\getrentalflow-ghl-playbook.md (operator documentation outside repo).')
