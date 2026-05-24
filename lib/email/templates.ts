// Email HTML templates. Plain inline-styled HTML for max compatibility
// across Gmail, Outlook, Apple Mail, etc. Brand colors: navy #1a1a6e, yellow #FFD700.

const SUPPORT_PHONE = "(904) 584-3047";
const SUPPORT_EMAIL = "admin@itsalwaysfun.com";

interface BaseLayoutParams {
  preheader?: string; // hidden preview text shown by email clients
  title: string;
  body: string; // already HTML
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function baseLayout({ preheader, title, body }: BaseLayoutParams): string {
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
          <td style="background:#1a1a6e;padding:24px 32px;text-align:center;">
            <div style="display:inline-block;background:#FFD700;color:#1a1a6e;font-size:10px;letter-spacing:2px;font-weight:bold;padding:4px 10px;border-radius:4px;">
              IT'S ALWAYS FUN
            </div>
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

function btn(href: string, label: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;">
    <tr><td style="background:#1a1a6e;border-radius:6px;">
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
}

export function renderQuoteEmail(p: QuoteEmailParams): { subject: string; html: string; text: string } {
  const totalStr = `$${(p.total / 100).toFixed(2)}`;
  const eventStr = p.eventEndDate && p.eventEndDate !== p.eventDate
    ? `${p.eventDate} → ${p.eventEndDate}`
    : p.eventDate;
  const expiresStr = p.expiresAt
    ? new Date(p.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  const subject = `Your quote ${p.quoteNumber} from It's Always Fun`;

  const body = `
    <p>Hi ${escapeHtml(p.firstName)},</p>
    <p>Your quote is ready to review!</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;">
      <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Quote number</td><td style="padding:4px 0;text-align:right;font-family:monospace;font-weight:bold;">${escapeHtml(p.quoteNumber)}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Event date</td><td style="padding:4px 0;text-align:right;font-weight:bold;">${escapeHtml(eventStr)}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Total</td><td style="padding:4px 0;text-align:right;color:#1a1a6e;font-size:20px;font-weight:bold;">${totalStr}</td></tr>
    </table>
    ${p.message ? `
    <div style="background:#fffbea;border-left:3px solid #FFD700;padding:12px 16px;margin:16px 0;font-style:italic;color:#451a03;">
      "${escapeHtml(p.message)}"
    </div>` : ""}
    <p>Click below to review and approve. You can also decline or ask questions before approving.</p>
    ${btn(p.quoteUrl, "Review & approve quote →")}
    ${expiresStr ? `<p style="font-size:13px;color:#64748b;">This quote is valid until <strong>${expiresStr}</strong>.</p>` : ""}
    <p style="margin-top:24px;">Questions? Reply to this email or call us at ${SUPPORT_PHONE}.</p>
    <p>— The It's Always Fun team</p>
  `;

  const text = `Hi ${p.firstName},

Your quote ${p.quoteNumber} is ready to review.

Event: ${eventStr}
Total: ${totalStr}
${p.message ? `\nMessage from us: "${p.message}"\n` : ""}
Review and approve: ${p.quoteUrl}
${expiresStr ? `Valid until ${expiresStr}.` : ""}

Questions? Reply or call ${SUPPORT_PHONE}.

— The It's Always Fun team`;

  return {
    subject,
    html: baseLayout({ title: "Your Quote is Ready", preheader: `Quote ${p.quoteNumber} — ${totalStr} for ${eventStr}`, body }),
    text,
  };
}

// ─── REFERRAL COMMISSION ──────────────────────────────────────────────────
export interface ReferralEmailParams {
  firstName: string;
  commissionEarned: number; // cents
  referredCustomerEmail: string;
  totalPendingCommission: number; // cents
  portalUrl: string; // /portal/referrals
  readyForPayout: boolean;
}

export function renderReferralEmail(p: ReferralEmailParams): { subject: string; html: string; text: string } {
  const commissionStr = `$${(p.commissionEarned / 100).toFixed(2)}`;
  const pendingStr = `$${(p.totalPendingCommission / 100).toFixed(2)}`;

  const subject = `🎉 You earned ${commissionStr} from a referral!`;

  const body = `
    <p>Hi ${escapeHtml(p.firstName)},</p>
    <p>Great news! Your friend <strong>${escapeHtml(p.referredCustomerEmail)}</strong> just booked their first rental with us.</p>
    <div style="background:linear-gradient(135deg,#1a1a6e 0%,#1a1a6e 100%);color:#ffffff;border-radius:12px;padding:24px;margin:20px 0;text-align:center;">
      <div style="font-size:13px;color:#FFD700;text-transform:uppercase;letter-spacing:2px;font-weight:bold;">You earned</div>
      <div style="font-size:36px;font-weight:bold;color:#FFD700;margin:6px 0;">${commissionStr}</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.8);">Total pending: ${pendingStr}</div>
    </div>
    ${p.readyForPayout ? `
    <div style="background:#d1fae5;border:1px solid #10b981;border-radius:6px;padding:12px 16px;color:#065f46;margin:16px 0;">
      <strong>💰 You've reached the payout threshold!</strong> We'll be in touch shortly to send your payment.
    </div>` : ""}
    ${btn(p.portalUrl, "View your referrals →")}
    <p>Keep sharing your link to earn more — every friend who books pays you back!</p>
    <p style="margin-top:24px;">— The It's Always Fun team</p>
  `;

  const text = `Hi ${p.firstName},

Your friend ${p.referredCustomerEmail} just booked their first rental with us.

You earned: ${commissionStr}
Total pending: ${pendingStr}
${p.readyForPayout ? "\nYou've reached the payout threshold! We'll be in touch.\n" : ""}
View your referrals: ${p.portalUrl}

Keep sharing your link to earn more!

— The It's Always Fun team`;

  return {
    subject,
    html: baseLayout({ title: "You Earned Commission!", preheader: `${commissionStr} from a referral`, body }),
    text,
  };
}

// ─── ABANDONED CART ───────────────────────────────────────────────────────
export interface AbandonedCartEmailParams {
  firstName: string;
  productName: string;
  eventDate: string;
  totalPrice: number; // cents
  resumeUrl: string;
}

export function renderAbandonedCartEmail(p: AbandonedCartEmailParams): { subject: string; html: string; text: string } {
  const priceStr = `$${(p.totalPrice / 100).toFixed(2)}`;
  const subject = `${p.firstName}, your ${p.productName} rental is waiting`;

  const body = `
    <p>Hi ${escapeHtml(p.firstName)},</p>
    <p>You were so close to booking the <strong>${escapeHtml(p.productName)}</strong> for <strong>${escapeHtml(p.eventDate)}</strong>!</p>
    <p>Your spot isn't reserved yet — but we held the details so you can finish in 1 minute.</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;">
      <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Rental</td><td style="padding:4px 0;text-align:right;font-weight:bold;">${escapeHtml(p.productName)}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Event date</td><td style="padding:4px 0;text-align:right;font-weight:bold;">${escapeHtml(p.eventDate)}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Total</td><td style="padding:4px 0;text-align:right;color:#1a1a6e;font-size:18px;font-weight:bold;">${priceStr}</td></tr>
    </table>
    ${btn(p.resumeUrl, "Finish my booking →")}
    <p>Got questions or need to change a detail? Just reply to this email or call us at ${SUPPORT_PHONE}.</p>
    <p>— The It's Always Fun team</p>
  `;

  const text = `Hi ${p.firstName},

You were so close to booking the ${p.productName} for ${p.eventDate}!

Total: ${priceStr}

Finish your booking: ${p.resumeUrl}

Questions? Reply or call ${SUPPORT_PHONE}.

— The It's Always Fun team`;

  return {
    subject,
    html: baseLayout({ title: "Almost there!", preheader: `Your ${p.productName} rental is waiting`, body }),
    text,
  };
}

// ─── ADMIN PAYOUT ALERT ──────────────────────────────────────────────────
export interface AdminPayoutAlertParams {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totalPending: number; // cents
  adminPanelUrl: string;
}

export function renderAdminPayoutAlert(p: AdminPayoutAlertParams): { subject: string; html: string; text: string } {
  const pendingStr = `$${(p.totalPending / 100).toFixed(2)}`;
  const subject = `🔔 Payout ready: ${p.customerName} — ${pendingStr}`;

  const body = `
    <p><strong>${escapeHtml(p.customerName)}</strong> has reached the commission payout threshold.</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#fffbea;border-radius:8px;padding:16px;margin:16px 0;">
      <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Customer</td><td style="padding:4px 0;text-align:right;font-weight:bold;">${escapeHtml(p.customerName)}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Email</td><td style="padding:4px 0;text-align:right;">${escapeHtml(p.customerEmail)}</td></tr>
      ${p.customerPhone ? `<tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Phone</td><td style="padding:4px 0;text-align:right;">${escapeHtml(p.customerPhone)}</td></tr>` : ""}
      <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Pending</td><td style="padding:4px 0;text-align:right;color:#1a1a6e;font-size:18px;font-weight:bold;">${pendingStr}</td></tr>
    </table>
    ${btn(p.adminPanelUrl, "Open admin loyalty panel →")}
    <p style="font-size:13px;color:#64748b;">Pay them outside the system (Venmo / Zelle / cash) then click "Record commission payout" to clear the pending balance.</p>
  `;

  const text = `${p.customerName} has reached the commission payout threshold.

Customer: ${p.customerName}
Email: ${p.customerEmail}
${p.customerPhone ? `Phone: ${p.customerPhone}\n` : ""}Pending: ${pendingStr}

Admin panel: ${p.adminPanelUrl}`;

  return {
    subject,
    html: baseLayout({ title: "Payout Ready", preheader: `${p.customerName} — ${pendingStr} commission`, body }),
    text,
  };
}
