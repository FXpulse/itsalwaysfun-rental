"""Chapter 11 — Superadmin platform. The SaaS owner's backoffice."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 11, 'Superadmin Platform',
        'getrentalflow.com/superadmin — where the platform owner manages every tenant.',
        audience_tags=['Owner', 'Engineer'])

    api['add_callout'](doc, 'fact',
        '17 superadmin pages. Mounted on the apex (getrentalflow.com/superadmin). No tenant '
        'context — uses createAdminClient({ unscoped: true }) for cross-tenant queries. Access '
        'gated by user_roles.is_superadmin = true. Currently Ludmila is the only superadmin.')

    api['add_h2'](doc, '11.1  The surface')

    api['add_kv_table'](doc,
        ['Path', 'Purpose'],
        [
            ('/superadmin/login',           'Sign-in entry point'),
            ('/superadmin/dashboard',       'Cross-tenant health overview (MRR, active tenants, alerts)'),
            ('/superadmin/tenants',         'Tenant list — search, suspend, impersonate, view brief'),
            ('/superadmin/tenants/[id]',    'Per-tenant snapshot (bookings, revenue, support tickets, notes)'),
            ('/superadmin/billing',         'Stripe subscription + usage across all tenants'),
            ('/superadmin/revenue',         'MRR, churn, growth metrics, cohort analysis'),
            ('/superadmin/email',           'Unified IMAP inbox across multiple accounts (Ludmila\'s personal CRM)'),
            ('/superadmin/email/[threadId]','Thread detail with Claude-powered reply suggestion'),
            ('/superadmin/email/accounts',  'IMAP/SMTP account configuration with encrypted credentials'),
            ('/superadmin/email/send',      'Bulk email to leads (lead-magnet recipients)'),
            ('/superadmin/activity',        'Platform-wide audit log export'),
            ('/superadmin/health',          'Supabase storage + auth usage, cron health, DB usage'),
            ('/superadmin/support',         'Cross-tenant support tickets + KB management'),
            ('/superadmin/kb',              'Knowledge base for support'),
            ('/superadmin/goals',           'Platform goals + aggregate tenant KPIs'),
            ('/superadmin/onboarding',      'Tenant onboarding funnel tracking (per-stage drop-off)'),
            ('/superadmin/setup',           'Initial platform configuration (CSP, branding defaults, etc.)'),
            ('/superadmin/team',            'Superadmin user management'),
        ],
        col_widths=[2.4, 4.7])

    api['add_h2'](doc, '11.2  The notable feature — unified IMAP inbox')

    api['add_p'](doc,
        '/superadmin/email is not a transactional log. It is a full IMAP-backed inbox. Ludmila '
        'connects external email accounts (Gmail forwarding, 20i StackMail, etc.) via IMAP credentials. '
        'The cron /api/cron/email-sync runs every 5 minutes — per account it opens an IMAP connection, '
        'fetches messages since the last UID watermark, parses MIME, dedupes by Message-ID, and stores '
        'them in email_messages + email_threads.')

    api['add_p'](doc,
        'Replies are sent via the tenant\'s SMTP credentials (also stored encrypted). Outbound '
        'messages are also AppendToFolder\'d to the Sent IMAP folder so the tenant\'s own inbox view '
        '(Gmail web, etc.) shows the thread.')

    api['add_callout'](doc, 'good',
        'This replaces Front / Help Scout for the platform owner. Total cost: $0 / month (Ludmila '
        'pays only for the underlying email accounts). Trade-off: requires IMAP credential management '
        'and Node 22 ESM compatibility (which had to be solved — mailparser replaced, isomorphic-'
        'dompurify lazy-loaded, imapflow SEARCH+FETCH pattern).')

    api['add_h2'](doc, '11.3  Tenant management workflow')

    api['add_mono_block'](doc, """
   Ludmila navigates to /superadmin/tenants
              │
              ▼
   Searches by business name or owner_email
              │
              ▼
   Clicks tenant row → /superadmin/tenants/[id]
              │
              ▼
   Snapshot view:
     • Subscription status (Stripe)
     • Last 30 days revenue, bookings, growth
     • Open support tickets, recent complaints
     • Outstanding payouts to drivers
     • Operator notes (tenant_operator_notes)
              │
              ▼
   Possible actions:
     • Impersonate (set session as tenant admin) — for support
     • Suspend (sets tenants.suspended_at — middleware blocks)
     • Cancel Stripe subscription
     • Add operator note (tenant_operator_notes — internal CRM-lite)
""", title='Tenant operations from the superadmin view')

    api['add_h2'](doc, '11.4  Why a separate /superadmin namespace')

    api['add_bullet'](doc, 'Auth check is different — is_superadmin flag on user_roles, not '
                            'just role=\'admin\'.')
    api['add_bullet'](doc, 'Tenant context is intentionally absent — all queries use the unscoped '
                            'client.')
    api['add_bullet'](doc, 'Layout, navigation, and styling are visually distinct from /admin '
                            'to prevent accidental cross-context errors.')
    api['add_bullet'](doc, 'Lives only on the apex hostname — middleware redirects subdomain '
                            'attempts to /admin.')

    api['add_callout'](doc, 'info',
        'This separation is the right architecture for a multi-tenant SaaS. The temptation to '
        'add "view as tenant" inside /admin is real, but keeping superadmin separate prevents '
        'the entire class of "this query forgot to scope" bugs at the surface level.')
