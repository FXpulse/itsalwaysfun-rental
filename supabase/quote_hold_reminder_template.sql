-- Seed the editable email template for the 24h hold reminder.
-- Idempotent: only inserts if the key isn't already present, so re-running
-- doesn't overwrite tenant customizations.

insert into public.email_templates (key, label, description, subject, email_title, body_html, body_text, available_vars)
select
  'quote_hold_reminder',
  'Quote hold reminder (24h)',
  'Fires from /api/cron/quote-hold-reminder ~6h before an approved quote''s 24h hold expires when payment hasn''t completed.',
  'Your reservation expires in {{hoursLeft}}h — complete payment to lock it in',
  'Heads up — your hold is about to expire',
  '<p>Hi {{firstName}},</p>
<p>Friendly reminder — you approved your quote with {{brandName}} and your reservation is on hold, but the payment hasn''t gone through yet.</p>
<p>Your hold expires <strong>{{expiryLabel}}</strong> (about {{hoursLeft}} hour{{#if hoursLeftPlural}}s{{/if}} from now). If we don''t receive payment by then, we can''t guarantee your booking — the date becomes available to other customers.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;">
  <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Quote number</td><td style="padding:4px 0;text-align:right;font-family:monospace;font-weight:bold;">{{quoteNumber}}</td></tr>
  <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Total due</td><td style="padding:4px 0;text-align:right;color:#1a1a6e;font-size:20px;font-weight:bold;">${{totalDollars}}</td></tr>
  <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Hold expires</td><td style="padding:4px 0;text-align:right;color:#b45309;font-weight:bold;">{{expiryLabel}}</td></tr>
</table>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;"><tr><td style="background:#1a1a6e;border-radius:6px;"><a href="{{quoteUrl}}" style="display:inline-block;color:#ffffff;font-weight:bold;font-size:15px;padding:12px 28px;text-decoration:none;">Complete payment →</a></td></tr></table>
<p style="font-size:13px;color:#64748b;">Already paid? Ignore this email — it can take a few minutes to confirm. Need to reschedule or have questions? Just reply to this message.</p>
<p>— The {{brandName}} team</p>',
  'Hi {{firstName}},

Reminder: your reservation with {{brandName}} is on hold but payment hasn''t completed yet.
Your hold expires {{expiryLabel}} (about {{hoursLeft}}h from now).
If we don''t receive payment, we can''t guarantee your booking.

Quote #{{quoteNumber}}
Total due: ${{totalDollars}}

Complete payment: {{quoteUrl}}

Already paid? Ignore this email — can take a few minutes to confirm.
— {{brandName}}',
  ARRAY['firstName','brandName','quoteNumber','totalDollars','quoteUrl','expiryLabel','hoursLeft','hoursLeftPlural']
where not exists (select 1 from public.email_templates where key = 'quote_hold_reminder');
