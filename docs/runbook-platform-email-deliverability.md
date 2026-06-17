# Runbook — Platform emails (info@getrentalflow.com) landing in spam

When emails sent FROM `info@getrentalflow.com` via the platform (beta
lifecycle, dunning, onboarding nudges, weekly-backup link, beta feedback
notifications) land in the recipient's spam folder.

## Why it happens

Two independent reasons:

1. **Resend isn't authorized to send for `getrentalflow.com`.** The
   recipient's mail server checks SPF (sender IP allowed?) and DKIM
   (signature matches domain?). If `getrentalflow.com` doesn't have DNS
   records pointing at Resend's sending infrastructure, both checks fail
   → straight to spam.

2. **The SMTP path (info@ via stackmail.com) isn't enabled yet.** Even
   though the `email_accounts` row exists and IMAP sync works, outbound
   SMTP only fires when `SAAS_OWNER_PREFER_SMTP=true` in Vercel. Default
   is Resend.

## Two paths to fix

### Path A — verify `getrentalflow.com` in Resend (recommended right now)

This makes the existing Resend code path land in inbox instead of spam.

1. Log into <https://resend.com/domains>
2. Click **Add domain**
3. Enter `getrentalflow.com`
4. Resend shows 3 DNS records to add (an SPF TXT record, 1-2 DKIM CNAME
   records, optionally a DMARC TXT record).
5. Add those records at your DNS provider (Vercel DNS if the domain is
   on Vercel; otherwise wherever the nameservers point).
6. Back in Resend, click **Verify**.
7. Wait 10-60 minutes for DNS propagation if it doesn't verify immediately.
8. Once verified, the next platform email goes to inbox, not spam. Send
   a test by manually triggering `/api/cron/onboarding-nudge` or
   re-running a beta signup.

That's it. No code changes needed.

### Path B — switch the platform to SMTP via the info@ mailbox

This routes platform emails through StackMail (the actual mailbox host),
which already has SPF/DKIM correctly set up for the domain (otherwise
inbound wouldn't work).

1. In Vercel: Project Settings → Environment Variables (Production scope)
2. Add `SAAS_OWNER_PREFER_SMTP = true`
3. Redeploy
4. Send a test email by triggering a cron OR signing up a new beta tenant
5. Watch `/superadmin/diagnostics` and Sentry for SMTP errors. If any:
   - The error is captured with tags `area: saas-owner-smtp` and the
     stackmail.com host/port/error in `extra`.
   - The email still goes out via Resend fallback, so nothing is lost.
6. If the path is silent for a week (no SMTP errors in Sentry), you can
   leave SMTP on permanently. If errors persist, set
   `SAAS_OWNER_PREFER_SMTP=false` and rely on Path A above.

## You can do both

Path A + Path B are not mutually exclusive. Doing both means:
- Primary: SMTP from the real mailbox (cleanest deliverability, replies
  land where they came from, Ludmila sees sent copies in her IMAP client).
- Fallback: Resend (if SMTP throws — happens occasionally with overloaded
  StackMail servers).

Doing both is the production-grade setup.

## What "platform → operator email" means

Don't confuse with **tenant → customer emails** (booking confirmations,
reminders, etc.) — those still go via Resend with per-tenant From + Reply-To
configured via `getTenantEmailConfig(tenantId)`. The two surfaces are
intentionally separate. See `reference_tenant_apex_separation.md`.

## Verifying it worked

Send yourself (or a test mailbox) one of each:
```bash
# Welcome email (beta signup)
# Sign up at https://getrentalflow.com/signup with a real test email
# Wait ~30 seconds, check inbox

# Manually trigger onboarding-nudge cron
curl https://getrentalflow.com/api/cron/onboarding-nudge \
  -H "Authorization: Bearer $CRON_SECRET"

# Manually trigger weekly-backup (sends the backup link to ADMIN_ALERT_EMAIL)
curl https://getrentalflow.com/api/cron/weekly-backup \
  -H "Authorization: Bearer $CRON_SECRET"
```

Then check:
- Recipient's inbox (not spam folder)
- Gmail / Outlook "show original" → SPF=pass, DKIM=pass
- Sentry breadcrumbs for `saas-owner-smtp` tag (only present if errors)

## Related

- Sending module: `lib/email/saas-owner-send.ts`
- 5 callers: `lib/email/beta-lifecycle.ts`, `lib/beta-feedback.ts`,
  `app/api/cron/onboarding-nudge/route.ts`,
  `app/api/cron/dunning/route.ts`,
  `app/api/cron/weekly-backup/route.ts`
- Tenant → customer emails use a different path entirely:
  `lib/email/scheduled-emails.ts` + `lib/email/tenant-email.ts`.
- Reference: `reference_tenant_apex_separation.md`
