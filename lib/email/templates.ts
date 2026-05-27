// Email HTML templates. Plain inline-styled HTML for max compatibility
// across Gmail, Outlook, Apple Mail, etc.
//
// MULTI-TENANT: every render function accepts an optional `brand` param.
// When provided, it overrides the defaults so each tenant's emails carry
// their own business name, contact info, and brand colors. When omitted,
// generic placeholders kick in (NOT IAF-specific).

export interface EmailBrand {
  name: string;                  // e.g. "Test Bouncers Party Rentals"
  phone?: string;                // e.g. "(813) 555-1234"
  email?: string;                // contact email shown in footer
  city?: string;                 // for footer line ("Tampa, FL")
  primaryColor?: string;         // hex, default navy
  accentColor?: string;          // hex, default gold
  logoUrl?: string;              // optional header logo
}

const DEFAULT_BRAND: Required<EmailBrand> = {
  name: "Rental Management",
  phone: "",
  email: "",
  city: "",
  primaryColor: "#1a1a6e",
  accentColor: "#FFD700",
  logoUrl: "",
};

function resolveBrand(b?: EmailBrand): Required<EmailBrand> {
  return {
    name: b?.name || DEFAULT_BRAND.name,
    phone: b?.phone || "",
    email: b?.email || "",
    city: b?.city || "",
    primaryColor: b?.primaryColor || DEFAULT_BRAND.primaryColor,
    accentColor: b?.accentColor || DEFAULT_BRAND.accentColor,
    logoUrl: b?.logoUrl || "",
  };
}

interface BaseLayoutParams {
  preheader?: string;
  title: string;
  body: string;
  brand?: EmailBrand;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function baseLayout({ preheader, title, body, brand }: BaseLayoutParams): string {
  const b = resolveBrand(brand);
  const phoneDigits = b.phone.replace(/\D/g, "");
  const cityLine = b.city ? ` · ${escapeHtml(b.city)}` : "";

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
        <!-- Header -->
        <tr>
          <td style="background:${b.primaryColor};padding:24px 32px;text-align:center;">
            ${
              b.logoUrl
                ? `<img src="${b.logoUrl}" alt="${escapeHtml(b.name)}" style="max-height:50px;display:block;margin:0 auto 8px;">`
                : `<div style="display:inline-block;background:${b.accentColor};color:${b.primaryColor};font-size:11px;letter-spacing:2px;font-weight:bold;padding:4px 12px;border-radius:4px;text-transform:uppercase;">${escapeHtml(b.name)}</div>`
            }
            <h1 style="color:#ffffff;font-size:22px;margin:8px 0 0 0;font-weight:bold;">${escapeHtml(title)}</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;font-size:15px;line-height:1.6;color:#0f172a;">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#64748b;">
            <p style="margin:0 0 4px 0;">${escapeHtml(b.name)}${cityLine}</p>
            ${
              b.phone || b.email
                ? `<p style="margin:0;">${
                    b.phone
                      ? `<a href="tel:${phoneDigits}" style="color:${b.primaryColor};text-decoration:none;">${escapeHtml(b.phone)}</a>`
                      : ""
                  }${b.phone && b.email ? " · " : ""}${
                    b.email
                      ? `<a href="mailto:${b.email}" style="color:${b.primaryColor};text-decoration:none;">${escapeHtml(b.email)}</a>`
                      : ""
                  }</p>`
                : ""
            }
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function btn(href: string, label: string, brand?: EmailBrand): string {
  const b = resolveBrand(brand);
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;">
    <tr><td style="background:${b.primaryColor};border-radius:6px;">
      <a href="${href}" style="display:inline-block;color:#ffffff;font-weight:bold;font-size:15px;padding:12px 28px;text-decoration:none;">${escapeHtml(label)}</a>
    </td></tr>
  </table>`;
}

// ─── QUOTE SENT ───────────────────────────────────────────────────────────
export interface QuoteEmailParams {
  firstName: string;
  quoteNumber: string;
  quoteUrl: string;
  total: number; // cents
  eventDate: string;
  eventEndDate?: string | null;
  message?: string | null;
  expiresAt?: string | null;
  brand?: EmailBrand;
}

export function renderQuoteEmail(p: QuoteEmailParams): { subject: string; html: string; text: string } {
  const b = resolveBrand(p.brand);
  const totalStr = `$${(p.total / 100).toFixed(2)}`;
  const eventStr = p.eventEndDate && p.eventEndDate !== p.eventDate
    ? `${p.eventDate} → ${p.eventEndDate}`
    : p.eventDate;
  const expiresStr = p.expiresAt
    ? new Date(p.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  const subject = `Your quote ${p.quoteNumber} from ${b.name}`;
  const contactLine = b.phone
    ? `Questions? Reply to this email or call us at ${b.phone}.`
    : "Questions? Reply to this email.";

  const body = `
    <p>Hi ${escapeHtml(p.firstName)},</p>
    <p>Your quote is ready to review!</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;">
      <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Quote number</td><td style="padding:4px 0;text-align:right;font-family:monospace;font-weight:bold;">${escapeHtml(p.quoteNumber)}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Event date</td><td style="padding:4px 0;text-align:right;font-weight:bold;">${escapeHtml(eventStr)}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Total</td><td style="padding:4px 0;text-align:right;color:${b.primaryColor};font-size:20px;font-weight:bold;">${totalStr}</td></tr>
    </table>
    ${p.message ? `
    <div style="background:#fffbea;border-left:3px solid ${b.accentColor};padding:12px 16px;margin:16px 0;font-style:italic;color:#451a03;">
      "${escapeHtml(p.message)}"
    </div>` : ""}
    <p>Click below to review and approve. You can also decline or ask questions before approving.</p>
    ${btn(p.quoteUrl, "Review & approve quote →", p.brand)}
    ${expiresStr ? `<p style="font-size:13px;color:#64748b;">This quote is valid until <strong>${expiresStr}</strong>.</p>` : ""}
    <p style="margin-top:24px;">${contactLine}</p>
    <p>— The ${escapeHtml(b.name)} team</p>
  `;

  const text = `Hi ${p.firstName},

Your quote ${p.quoteNumber} is ready to review.

Event: ${eventStr}
Total: ${totalStr}
${p.message ? `\nMessage from us: "${p.message}"\n` : ""}
Review and approve: ${p.quoteUrl}
${expiresStr ? `Valid until ${expiresStr}.` : ""}

${b.phone ? `Questions? Reply or call ${b.phone}.` : "Questions? Reply to this email."}

— The ${b.name} team`;

  return {
    subject,
    html: baseLayout({
      title: "Your Quote is Ready",
      preheader: `Quote ${p.quoteNumber} — ${totalStr} for ${eventStr}`,
      body,
      brand: p.brand,
    }),
    text,
  };
}

// ─── REFERRAL COMMISSION EARNED ──────────────────────────────────────────
export interface ReferralEmailParams {
  firstName: string;
  commissionCents: number;
  bookingCustomerName: string;
  pendingTotalCents: number;
  payoutThresholdCents: number;
  portalUrl: string;
  brand?: EmailBrand;
}

export function renderReferralEmail(p: ReferralEmailParams): { subject: string; html: string; text: string } {
  const b = resolveBrand(p.brand);
  const commissionStr = `$${(p.commissionCents / 100).toFixed(2)}`;
  const pendingStr = `$${(p.pendingTotalCents / 100).toFixed(2)}`;
  const thresholdStr = `$${(p.payoutThresholdCents / 100).toFixed(2)}`;
  const aboveThreshold = p.pendingTotalCents >= p.payoutThresholdCents;

  const subject = `You earned ${commissionStr} from a referral!`;

  const body = `
    <p>Hi ${escapeHtml(p.firstName)},</p>
    <p>Great news — <strong>${escapeHtml(p.bookingCustomerName)}</strong> just used your referral and booked a rental.</p>
    <p>You've earned <strong style="color:${b.primaryColor};font-size:18px;">${commissionStr}</strong> in commission.</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;">
      <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">This commission</td><td style="padding:4px 0;text-align:right;font-weight:bold;">${commissionStr}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Your pending total</td><td style="padding:4px 0;text-align:right;font-weight:bold;">${pendingStr}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Payout threshold</td><td style="padding:4px 0;text-align:right;">${thresholdStr}</td></tr>
    </table>
    ${aboveThreshold ? `<p style="background:#dcfce7;color:#166534;padding:10px 14px;border-radius:6px;"><strong>You can request a payout!</strong></p>` : `<p>You'll be eligible for payout once you reach <strong>${thresholdStr}</strong>.</p>`}
    ${btn(p.portalUrl, "View your referrals →", p.brand)}
    <p style="margin-top:24px;">— The ${escapeHtml(b.name)} team</p>
  `;

  const text = `Hi ${p.firstName},

${p.bookingCustomerName} used your referral! You earned ${commissionStr}.

Pending total: ${pendingStr}
Payout threshold: ${thresholdStr}
${aboveThreshold ? "\nYou can request a payout!\n" : ""}
View your referrals: ${p.portalUrl}

— The ${b.name} team`;

  return {
    subject,
    html: baseLayout({
      title: "You Earned Commission!",
      preheader: `${commissionStr} from a referral`,
      body,
      brand: p.brand,
    }),
    text,
  };
}

// ─── ABANDONED CART RECOVERY ─────────────────────────────────────────────
export interface AbandonedCartEmailParams {
  firstName: string;
  productName: string;
  eventDate: string;
  totalCents: number;
  resumeUrl: string;
  brand?: EmailBrand;
}

export function renderAbandonedCartEmail(p: AbandonedCartEmailParams): { subject: string; html: string; text: string } {
  const b = resolveBrand(p.brand);
  const totalStr = `$${(p.totalCents / 100).toFixed(2)}`;

  const subject = `${p.firstName}, your ${p.productName} rental is waiting`;

  const body = `
    <p>Hi ${escapeHtml(p.firstName)},</p>
    <p>You were almost done booking your <strong>${escapeHtml(p.productName)}</strong> for ${escapeHtml(p.eventDate)} — but didn't finish.</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;">
      <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Rental</td><td style="padding:4px 0;text-align:right;font-weight:bold;">${escapeHtml(p.productName)}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Event date</td><td style="padding:4px 0;text-align:right;font-weight:bold;">${escapeHtml(p.eventDate)}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Total</td><td style="padding:4px 0;text-align:right;color:${b.primaryColor};font-size:20px;font-weight:bold;">${totalStr}</td></tr>
    </table>
    <p>Want to finish? Click below to pick up where you left off — your spot is still available.</p>
    ${btn(p.resumeUrl, "Finish my booking →", p.brand)}
    <p style="margin-top:24px;">— The ${escapeHtml(b.name)} team</p>
  `;

  const text = `Hi ${p.firstName},

You almost finished booking your ${p.productName} for ${p.eventDate}.

Total: ${totalStr}

Pick up where you left off: ${p.resumeUrl}

— The ${b.name} team`;

  return {
    subject,
    html: baseLayout({
      title: "Almost there!",
      preheader: `Your ${p.productName} rental is waiting`,
      body,
      brand: p.brand,
    }),
    text,
  };
}

// ─── ADMIN PAYOUT ALERT ──────────────────────────────────────────────────
export interface AdminPayoutAlertParams {
  customerName: string;
  customerEmail: string;
  pendingCommissionCents: number;
  adminUrl: string;
  brand?: EmailBrand;
}

export function renderAdminPayoutAlert(p: AdminPayoutAlertParams): { subject: string; html: string; text: string } {
  const b = resolveBrand(p.brand);
  const pendingStr = `$${(p.pendingCommissionCents / 100).toFixed(2)}`;

  const subject = `${p.customerName} hit the payout threshold (${pendingStr})`;

  const body = `
    <p>Heads up — a referrer is ready for payout.</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;">
      <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Customer</td><td style="padding:4px 0;text-align:right;font-weight:bold;">${escapeHtml(p.customerName)}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Email</td><td style="padding:4px 0;text-align:right;">${escapeHtml(p.customerEmail)}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Pending commission</td><td style="padding:4px 0;text-align:right;color:${b.primaryColor};font-size:18px;font-weight:bold;">${pendingStr}</td></tr>
    </table>
    ${btn(p.adminUrl, "Review & process payout →", p.brand)}
  `;

  const text = `Heads up — ${p.customerName} (${p.customerEmail}) has ${pendingStr} in pending commission and is ready for payout.

Review: ${p.adminUrl}`;

  return {
    subject,
    html: baseLayout({
      title: "Payout Ready",
      preheader: `${p.customerName} — ${pendingStr} commission`,
      body,
      brand: p.brand,
    }),
    text,
  };
}
