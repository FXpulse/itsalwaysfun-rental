-- Append the {{#if importantTipsHtml}} block to the quote_sent email
-- template so customers see the tenant's payment / setup / cancellation
-- policies right before they approve.
--
-- Only edits templates that don't already contain the placeholder, so
-- re-running is idempotent.

update public.email_templates
set
  body_html = body_html ||
    E'\n<div style="margin-top:24px;padding:16px;background:#fffbea;border-left:3px solid #FFD700;border-radius:4px;font-size:13px;color:#451a03;">{{#if importantTipsHtml}}{{importantTipsHtml}}{{/if}}</div>',
  body_text = body_text || E'\n\n{{#if importantTips}}{{importantTips}}{{/if}}',
  available_vars = array_cat(
    available_vars,
    ARRAY['importantTips','importantTipsHtml']::text[]
  )
where key = 'quote_sent'
  and body_html not like '%importantTipsHtml%';

-- Booking confirmation email — same treatment. The template key varies by
-- tenant seed; common keys: booking_confirmed, booking_paid.
update public.email_templates
set
  body_html = body_html ||
    E'\n<div style="margin-top:24px;padding:16px;background:#fffbea;border-left:3px solid #FFD700;border-radius:4px;font-size:13px;color:#451a03;">{{#if importantTipsHtml}}{{importantTipsHtml}}{{/if}}</div>',
  body_text = body_text || E'\n\n{{#if importantTips}}{{importantTips}}{{/if}}',
  available_vars = array_cat(
    available_vars,
    ARRAY['importantTips','importantTipsHtml']::text[]
  )
where key in ('booking_confirmed', 'booking_paid', 'booking_confirmation')
  and body_html not like '%importantTipsHtml%';
