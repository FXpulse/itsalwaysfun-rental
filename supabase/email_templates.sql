-- Editable email templates.
--
-- Each template has a unique 'key' (e.g. 'quote_sent') referenced from code.
-- Variables are interpolated using {{varName}} and conditionals using
-- {{#if varName}}...{{/if}} (simple non-nested only).
--
-- Hardcoded fallbacks in lib/email/templates.ts are used if a template
-- isn't in DB or fails to load.

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,                       -- 'quote_sent', etc.
  label text not null,                            -- 'Quote sent to customer'
  description text,                               -- when this fires
  subject text not null,                          -- can use {{vars}}
  email_title text not null,                      -- big heading in email banner
  body_html text not null,                        -- inner body HTML
  body_text text not null,                        -- plain-text fallback
  available_vars text[] not null default '{}',    -- for the editor UI
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_templates_key_idx on public.email_templates(key);

create or replace function public.touch_email_templates_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists email_templates_set_updated_at on public.email_templates;
create trigger email_templates_set_updated_at
  before update on public.email_templates
  for each row execute function public.touch_email_templates_updated_at();

alter table public.email_templates enable row level security;
drop policy if exists "admin manage templates" on public.email_templates;
create policy "admin manage templates"
  on public.email_templates
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Seed with the 4 templates currently in lib/email/templates.ts
insert into public.email_templates (key, label, description, subject, email_title, body_html, body_text, available_vars) values

-- 1) QUOTE SENT
('quote_sent',
 'Quote sent to customer',
 'Fires when admin clicks "Send to customer" on a quote in /admin/quotes',
 'Your quote {{quoteNumber}} from It''s Always Fun',
 'Your Quote is Ready',
 '<p>Hi {{firstName}},</p>
<p>Your quote is ready to review!</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;">
  <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Quote number</td><td style="padding:4px 0;text-align:right;font-family:monospace;font-weight:bold;">{{quoteNumber}}</td></tr>
  <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Event date</td><td style="padding:4px 0;text-align:right;font-weight:bold;">{{eventDate}}</td></tr>
  <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Total</td><td style="padding:4px 0;text-align:right;color:#1a1a6e;font-size:20px;font-weight:bold;">${{totalDollars}}</td></tr>
</table>
{{#if message}}
<div style="background:#fffbea;border-left:3px solid #FFD700;padding:12px 16px;margin:16px 0;font-style:italic;color:#451a03;">"{{message}}"</div>
{{/if}}
<p>Click below to review and approve. You can also decline or ask questions before approving.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;"><tr><td style="background:#1a1a6e;border-radius:6px;"><a href="{{quoteUrl}}" style="display:inline-block;color:#ffffff;font-weight:bold;font-size:15px;padding:12px 28px;text-decoration:none;">Review &amp; approve quote →</a></td></tr></table>
{{#if expiresAtFormatted}}<p style="font-size:13px;color:#64748b;">This quote is valid until <strong>{{expiresAtFormatted}}</strong>.</p>{{/if}}
<p style="margin-top:24px;">Questions? Reply to this email or call us at (904) 584-3047.</p>
<p>— The It''s Always Fun team</p>',
 'Hi {{firstName}},

Your quote {{quoteNumber}} is ready to review.

Event: {{eventDate}}
Total: ${{totalDollars}}
{{#if message}}
Message from us: "{{message}}"
{{/if}}
Review and approve: {{quoteUrl}}
{{#if expiresAtFormatted}}Valid until {{expiresAtFormatted}}.{{/if}}

Questions? Reply or call (904) 584-3047.

— The It''s Always Fun team',
 ARRAY['firstName','quoteNumber','eventDate','eventEndDate','totalDollars','message','quoteUrl','expiresAtFormatted']),

-- 2) REFERRAL COMMISSION
('referral_commission',
 'Referrer earned commission',
 'Fires when a referred customer pays their first booking — sends to the referrer',
 '🎉 You earned ${{commissionDollars}} from a referral!',
 'You Earned Commission!',
 '<p>Hi {{firstName}},</p>
<p>Great news! Your friend <strong>{{referredCustomerEmail}}</strong> just booked their first rental with us.</p>
<div style="background:linear-gradient(135deg,#1a1a6e 0%,#1a1a6e 100%);color:#ffffff;border-radius:12px;padding:24px;margin:20px 0;text-align:center;">
  <div style="font-size:13px;color:#FFD700;text-transform:uppercase;letter-spacing:2px;font-weight:bold;">You earned</div>
  <div style="font-size:36px;font-weight:bold;color:#FFD700;margin:6px 0;">${{commissionDollars}}</div>
  <div style="font-size:13px;color:rgba(255,255,255,0.8);">Total pending: ${{totalPendingDollars}}</div>
</div>
{{#if readyForPayout}}<div style="background:#d1fae5;border:1px solid #10b981;border-radius:6px;padding:12px 16px;color:#065f46;margin:16px 0;"><strong>💰 You''ve reached the payout threshold!</strong> We''ll be in touch shortly to send your payment.</div>{{/if}}
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;"><tr><td style="background:#1a1a6e;border-radius:6px;"><a href="{{portalUrl}}" style="display:inline-block;color:#ffffff;font-weight:bold;font-size:15px;padding:12px 28px;text-decoration:none;">View your referrals →</a></td></tr></table>
<p>Keep sharing your link to earn more — every friend who books pays you back!</p>
<p style="margin-top:24px;">— The It''s Always Fun team</p>',
 'Hi {{firstName}},

Your friend {{referredCustomerEmail}} just booked their first rental with us.

You earned: ${{commissionDollars}}
Total pending: ${{totalPendingDollars}}
{{#if readyForPayout}}
You''ve reached the payout threshold! We''ll be in touch.
{{/if}}
View your referrals: {{portalUrl}}

— The It''s Always Fun team',
 ARRAY['firstName','commissionDollars','referredCustomerEmail','totalPendingDollars','portalUrl','readyForPayout']),

-- 3) ADMIN PAYOUT ALERT
('admin_payout_alert',
 'Admin alert: payout ready',
 'Fires when a referrer''s pending commission crosses the payout threshold',
 '🔔 Payout ready: {{customerName}} — ${{totalPendingDollars}}',
 'Payout Ready',
 '<p><strong>{{customerName}}</strong> has reached the commission payout threshold.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#fffbea;border-radius:8px;padding:16px;margin:16px 0;">
  <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Customer</td><td style="padding:4px 0;text-align:right;font-weight:bold;">{{customerName}}</td></tr>
  <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Email</td><td style="padding:4px 0;text-align:right;">{{customerEmail}}</td></tr>
  {{#if customerPhone}}<tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Phone</td><td style="padding:4px 0;text-align:right;">{{customerPhone}}</td></tr>{{/if}}
  <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Pending</td><td style="padding:4px 0;text-align:right;color:#1a1a6e;font-size:18px;font-weight:bold;">${{totalPendingDollars}}</td></tr>
</table>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;"><tr><td style="background:#1a1a6e;border-radius:6px;"><a href="{{adminPanelUrl}}" style="display:inline-block;color:#ffffff;font-weight:bold;font-size:15px;padding:12px 28px;text-decoration:none;">Open admin loyalty panel →</a></td></tr></table>
<p style="font-size:13px;color:#64748b;">Pay them outside the system (Venmo / Zelle / cash) then click "Record commission payout" to clear the pending balance.</p>',
 '{{customerName}} has reached the commission payout threshold.

Customer: {{customerName}}
Email: {{customerEmail}}
{{#if customerPhone}}Phone: {{customerPhone}}
{{/if}}Pending: ${{totalPendingDollars}}

Admin panel: {{adminPanelUrl}}',
 ARRAY['customerName','customerEmail','customerPhone','totalPendingDollars','adminPanelUrl']),

-- 4) ABANDONED CART
('abandoned_cart',
 'Abandoned cart recovery',
 'Fires when a customer enters email + product info but doesn''t complete booking within 30 min',
 '{{firstName}}, your {{productName}} rental is waiting',
 'Almost there!',
 '<p>Hi {{firstName}},</p>
<p>You were so close to booking the <strong>{{productName}}</strong> for <strong>{{eventDate}}</strong>!</p>
<p>Your spot isn''t reserved yet — but we held the details so you can finish in 1 minute.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;">
  <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Rental</td><td style="padding:4px 0;text-align:right;font-weight:bold;">{{productName}}</td></tr>
  <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Event date</td><td style="padding:4px 0;text-align:right;font-weight:bold;">{{eventDate}}</td></tr>
  <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Total</td><td style="padding:4px 0;text-align:right;color:#1a1a6e;font-size:18px;font-weight:bold;">${{totalDollars}}</td></tr>
</table>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;"><tr><td style="background:#1a1a6e;border-radius:6px;"><a href="{{resumeUrl}}" style="display:inline-block;color:#ffffff;font-weight:bold;font-size:15px;padding:12px 28px;text-decoration:none;">Finish my booking →</a></td></tr></table>
<p>Got questions or need to change a detail? Just reply to this email or call us at (904) 584-3047.</p>
<p>— The It''s Always Fun team</p>',
 'Hi {{firstName}},

You were so close to booking the {{productName}} for {{eventDate}}!

Total: ${{totalDollars}}

Finish your booking: {{resumeUrl}}

Questions? Reply or call (904) 584-3047.

— The It''s Always Fun team',
 ARRAY['firstName','productName','eventDate','totalDollars','resumeUrl'])

on conflict (key) do nothing;
