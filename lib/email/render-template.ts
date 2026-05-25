// Loads an email template from DB by key, substitutes {{vars}} and {{#if}}
// blocks, wraps in the shared base layout, and returns subject + html + text.
//
// Falls back to hardcoded templates (lib/email/templates.ts) if the row is
// missing or fails to load — that way emails never silently break if admin
// hasn't seeded the DB.

import { createAdminClient } from "@/lib/supabase/admin";

const SUPPORT_PHONE = "(904) 584-3047";
const SUPPORT_EMAIL = "admin@itsalwaysfun.com";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface TemplateRow {
  key: string;
  label: string;
  description: string | null;
  subject: string;
  email_title: string;
  body_html: string;
  body_text: string;
  available_vars: string[];
  is_active: boolean;
}

/** Substitute {{varName}} and {{#if varName}}...{{/if}} blocks. */
export function substitute(template: string, vars: Record<string, any>): string {
  // 1. Handle conditionals first (non-nested only — simple loop until stable)
  let result = template;
  const condRe = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  let changed = true;
  let safety = 5;
  while (changed && safety-- > 0) {
    changed = false;
    result = result.replace(condRe, (_, name, content) => {
      changed = true;
      const v = vars[name];
      // Truthy if not null/undefined/false/empty-string/0
      return v !== null && v !== undefined && v !== false && v !== "" && v !== 0 ? content : "";
    });
  }
  // 2. Replace {{varName}}
  result = result.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    const v = vars[name];
    if (v === null || v === undefined) return "";
    return String(v);
  });
  return result;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Wraps inner body html in the shared branded layout. */
export function wrapInBaseLayout(title: string, innerBody: string, preheader?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
${preheader ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>` : ""}
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f1f5f9;padding:20px 0;">
  <tr>
    <td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <tr>
          <td style="background:#1a1a6e;padding:24px 32px;text-align:center;">
            <div style="display:inline-block;background:#FFD700;color:#1a1a6e;font-size:10px;letter-spacing:2px;font-weight:bold;padding:4px 10px;border-radius:4px;">IT'S ALWAYS FUN</div>
            <h1 style="color:#ffffff;font-size:22px;margin:8px 0 0 0;font-weight:bold;">${escapeHtml(title)}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;font-size:15px;line-height:1.6;color:#0f172a;">${innerBody}</td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#64748b;">
            <p style="margin:0 0 4px 0;">It's Always Fun, LLC · Jacksonville, FL</p>
            <p style="margin:0;">
              <a href="tel:${SUPPORT_PHONE.replace(/\D/g, "")}" style="color:#1a1a6e;text-decoration:none;">${SUPPORT_PHONE}</a>
              ·
              <a href="mailto:${SUPPORT_EMAIL}" style="color:#1a1a6e;text-decoration:none;">${SUPPORT_EMAIL}</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Load a template from DB. Returns null if not found / inactive / error. */
export async function loadTemplate(key: string): Promise<TemplateRow | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("email_templates")
      .select("*")
      .eq("key", key)
      .eq("is_active", true)
      .maybeSingle();
    return (data as TemplateRow) || null;
  } catch (e) {
    console.error("[loadTemplate]", key, e);
    return null;
  }
}

/** Load + substitute + wrap. Returns rendered email or null if template missing. */
export async function renderTemplate(
  key: string,
  vars: Record<string, any>,
): Promise<RenderedEmail | null> {
  const tmpl = await loadTemplate(key);
  if (!tmpl) return null;

  const subject = substitute(tmpl.subject, vars);
  const innerHtml = substitute(tmpl.body_html, vars);
  const title = substitute(tmpl.email_title, vars);
  const text = substitute(tmpl.body_text, vars);
  const html = wrapInBaseLayout(title, innerHtml, subject);

  return { subject, html, text };
}
