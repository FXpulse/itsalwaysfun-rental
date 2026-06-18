// Loads an email template from DB by key, substitutes {{vars}} and {{#if}}
// blocks, wraps in the shared base layout, and returns subject + html + text.
//
// Falls back to hardcoded templates (lib/email/templates.ts) if the row is
// missing or fails to load — that way emails never silently break if admin
// hasn't seeded the DB.
//
// MULTI-TENANT: the wrapper banner + footer pull from the current tenant's
// branding (business_name, phone, email, colors). Callers can also pass a
// `brand` explicitly when there's no request context (webhooks, cron).

import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantInfo, tenantToEmailBrand, type TenantInfo } from "@/lib/tenant/business";

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
  sms_body: string | null;
  available_vars: string[];
  is_active: boolean;
}

/** Substitute {{varName}} and {{#if varName}}...{{/if}} blocks.
 *
 *  Variables are HTML-escaped by default to prevent stored XSS from
 *  customer-controlled inputs (names, addresses, messages, etc.). Use
 *  {{{varName}}} (triple braces) to inject already-trusted HTML — the
 *  callsite must vouch for the safety of the value (e.g. server-built
 *  rich text we control). */
export function substitute(template: string, vars: Record<string, any>): string {
  let result = template;
  const condRe = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  let changed = true;
  let safety = 5;
  while (changed && safety-- > 0) {
    changed = false;
    result = result.replace(condRe, (_, name, content) => {
      changed = true;
      const v = vars[name];
      return v !== null && v !== undefined && v !== false && v !== "" && v !== 0 ? content : "";
    });
  }
  // {{{var}}} — raw injection (trusted HTML). Match BEFORE the escaped form.
  result = result.replace(/\{\{\{(\w+)\}\}\}/g, (_, name) => {
    const v = vars[name];
    if (v === null || v === undefined) return "";
    return String(v);
  });
  // {{var}} — HTML-escaped (safe default for everything else).
  result = result.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    const v = vars[name];
    if (v === null || v === undefined) return "";
    return escapeHtml(String(v));
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

interface WrapperBrand {
  name: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  primaryColor: string;
  accentColor: string;
}

function brandForWrapper(t: TenantInfo): WrapperBrand {
  const b = tenantToEmailBrand(t);
  return {
    name: b.name,
    phone: b.phone,
    email: b.email,
    logoUrl: b.logoUrl,
    primaryColor: b.primaryColor || "#1a1a6e",
    accentColor: b.accentColor || "#FFD700",
  };
}

/** Wraps inner body html in the shared branded layout, tenant-aware. */
export function wrapInBaseLayout(
  title: string,
  innerBody: string,
  brand: WrapperBrand,
  preheader?: string,
): string {
  const nameUpper = brand.name.toUpperCase();
  const phoneLink = brand.phone
    ? `<a href="tel:${brand.phone.replace(/\D/g, "")}" style="color:${brand.primaryColor};text-decoration:none;">${escapeHtml(brand.phone)}</a>`
    : "";
  const emailLink = brand.email
    ? `<a href="mailto:${brand.email}" style="color:${brand.primaryColor};text-decoration:none;">${escapeHtml(brand.email)}</a>`
    : "";
  const contactLine = [phoneLink, emailLink].filter(Boolean).join(" · ");

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
        ${brand.logoUrl ? `<tr>
          <td style="background:#ffffff;padding:24px 32px;text-align:center;border-bottom:1px solid #e2e8f0;">
            <img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.name)}" style="display:block;max-width:200px;max-height:80px;height:auto;margin:0 auto;" />
          </td>
        </tr>` : ""}
        <tr>
          <td style="background:${brand.primaryColor};padding:24px 32px;text-align:center;">
            <div style="display:inline-block;background:${brand.accentColor};color:${brand.primaryColor};font-size:10px;letter-spacing:2px;font-weight:bold;padding:4px 10px;border-radius:4px;">${escapeHtml(nameUpper)}</div>
            <h1 style="color:#ffffff;font-size:22px;margin:8px 0 0 0;font-weight:bold;">${escapeHtml(title)}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;font-size:15px;line-height:1.6;color:#0f172a;">${innerBody}</td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#64748b;">
            <p style="margin:0 0 4px 0;">${escapeHtml(brand.name)}</p>
            ${contactLine ? `<p style="margin:0;">${contactLine}</p>` : ""}
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

/** Load + substitute + wrap. Returns rendered email or null if template missing.
 *  Pass tenantId when called outside request context (webhook, cron). */
export async function renderTemplate(
  key: string,
  vars: Record<string, any>,
  tenantId?: string,
): Promise<RenderedEmail | null> {
  const tmpl = await loadTemplate(key);
  if (!tmpl) return null;

  // Resolve tenant brand and auto-inject brand-related variables so templates
  // can use {{businessName}}, {{businessPhone}}, {{businessEmail}} without
  // each caller having to pass them.
  const tenant = await getTenantInfo(tenantId);
  const brand = brandForWrapper(tenant);
  const enriched: Record<string, any> = {
    businessName: brand.name,
    businessPhone: brand.phone || "",
    businessEmail: brand.email || "",
    ...vars,
  };

  const subject = substitute(tmpl.subject, enriched);
  const innerHtml = substitute(tmpl.body_html, enriched);
  const title = substitute(tmpl.email_title, enriched);
  const text = substitute(tmpl.body_text, enriched);
  const html = wrapInBaseLayout(title, innerHtml, brand, subject);

  return { subject, html, text };
}

/** Render the SMS body of a template with vars substituted + auto-injected
 *  brand vars ({{businessName}}, {{businessPhone}}, {{businessEmail}}).
 *  Returns null if the template doesn't exist, is inactive, or has no
 *  sms_body (i.e. SMS not enabled for that event). */
export async function renderTemplateSms(
  key: string,
  vars: Record<string, unknown>,
  tenantId?: string | null,
): Promise<string | null> {
  const tmpl = await loadTemplate(key);
  if (!tmpl || !tmpl.sms_body) return null;

  const tenant = await getTenantInfo(tenantId);
  const brand = brandForWrapper(tenant);
  const enriched: Record<string, any> = {
    businessName: brand.name,
    businessPhone: brand.phone || "",
    businessEmail: brand.email || "",
    ...vars,
  };
  // substitute() HTML-escapes by default. SMS is plain text — unescape the
  // common entities so '&' / quotes don't render as &amp; / &#39; over the wire.
  return substitute(tmpl.sms_body, enriched)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
