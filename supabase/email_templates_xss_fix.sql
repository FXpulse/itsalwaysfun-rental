-- Follow-up to the substitute() XSS hardening in lib/email/render-template.ts.
--
-- Previously {{var}} interpolated raw HTML — now it HTML-escapes by default.
-- For variables that are INTENTIONALLY HTML (admin-controlled rich text like
-- the important_tips block which uses <br>), switch from {{var}} to the new
-- {{{var}}} triple-brace syntax that bypasses escaping.
--
-- importantTipsHtml is server-built from tenant-controlled plain text with
-- newlines replaced by <br> — admins are trusted not to inject script there.
-- For maximum safety in the future, replace the replace(/\n/g, '<br>') with
-- a proper sanitizer.
--
-- Idempotent: only updates rows where the placeholder hasn't been switched.

update public.email_templates
set body_html = replace(body_html, '{{importantTipsHtml}}', '{{{importantTipsHtml}}}')
where body_html like '%{{importantTipsHtml}}%'
  and body_html not like '%{{{importantTipsHtml}}}%';
