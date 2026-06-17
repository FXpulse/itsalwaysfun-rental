// Email sent to a customer when admin assigns them a coupon.
// Fire-and-forget — failures logged but don't block the save.

import * as Sentry from "@sentry/nextjs";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { getTenantEmailConfig } from "@/lib/email/tenant-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantBusinessName } from "@/lib/tenant/business";
import { getCurrentTenantId } from "@/lib/tenant/db";

interface CouponAssignedEmailInput {
  coupon_code: string;
  discount_type: "percent" | "fixed" | "overnight_free";
  discount_value: number;
  description: string | null;
  customer_user_id: string;
}

function discountLabel(t: "percent" | "fixed" | "overnight_free", v: number): string {
  if (t === "percent") return `${v}% off`;
  if (t === "fixed") return `$${(v / 100).toFixed(0)} off`;
  return "Overnight free";
}

export async function sendCouponAssignedEmail(input: CouponAssignedEmailInput): Promise<void> {
  if (!isEmailConfigured()) return;

  const supabase = createAdminClient({ unscoped: true });
  const { data: userRes } = await supabase.auth.admin.getUserById(input.customer_user_id);
  const email = userRes?.user?.email;
  if (!email) return;
  const firstName = (userRes.user?.user_metadata as any)?.first_name || email.split("@")[0];

  let businessName = "us";
  try { businessName = await getTenantBusinessName(); } catch {}

  const discount = discountLabel(input.discount_type, input.discount_value);
  const subject = `🎟 You've got a personal coupon — ${input.coupon_code}`;

  // baseUrl from tenant — we don't always have it but Resend allows mailto links
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://getrentalflow.com";
  const portalUrl = `${baseUrl}/portal/referrals`;

  const html = `<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#0f172a;max-width:600px;margin:0 auto;padding:24px">
  <div style="background:linear-gradient(135deg,#6d28d9,#db2777);padding:20px;border-radius:16px;margin-bottom:20px;text-align:center">
    <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#fce7f3;font-weight:700">Your personal coupon</div>
    <div style="font-size:32px;font-weight:800;color:white;font-family:Menlo,Monaco,monospace;letter-spacing:2px;margin-top:8px">${input.coupon_code}</div>
    <div style="font-size:16px;color:#fce7f3;margin-top:6px">${discount}</div>
  </div>

  <p style="font-size:16px;line-height:1.55">Hi ${firstName} 👋</p>

  <p style="font-size:15px;line-height:1.6">
    Great news — we've just given you your own personal coupon code: <strong style="color:#6d28d9;font-family:Menlo,Monaco,monospace">${input.coupon_code}</strong>.
    Anyone you share it with gets <strong>${discount}</strong> on their booking with ${businessName}, and <strong>you earn a referral commission</strong> on their first paid booking — automatically.
  </p>

  ${input.description ? `<p style="font-size:14px;line-height:1.5;color:#64748b;font-style:italic">📝 ${input.description}</p>` : ""}

  <div style="background:#f1f5f9;border-left:4px solid #6d28d9;padding:14px 18px;border-radius:8px;margin:18px 0">
    <strong style="display:block;margin-bottom:6px">How to share it</strong>
    <ul style="margin:0;padding-left:18px;line-height:1.7;font-size:14px">
      <li>Send the code <strong>${input.coupon_code}</strong> via text, WhatsApp, email — anywhere</li>
      <li>They apply it at checkout for ${discount}</li>
      <li>You earn commission on their <strong>first paid booking</strong></li>
      <li>Watch your earnings grow in your portal</li>
    </ul>
  </div>

  <div style="text-align:center;margin:24px 0">
    <a href="${portalUrl}" style="display:inline-block;background:#6d28d9;color:white;font-weight:700;text-decoration:none;padding:12px 26px;border-radius:8px">
      Open your portal →
    </a>
  </div>

  <div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:24px;font-size:12px;color:#64748b">
    Thanks for being part of our community.<br>
    — ${businessName}
  </div>
</body></html>`;

  const text = `Hi ${firstName},

Great news — we've assigned you a personal coupon: ${input.coupon_code}
Discount: ${discount}

Share this code with friends. They get ${discount} on their booking, and you earn a referral commission on their first paid booking — automatically.

View your portal: ${portalUrl}

— ${businessName}`;

  const tenantEmail = await getTenantEmailConfig(getCurrentTenantId());
  if (!tenantEmail) {
    Sentry.captureMessage("Tenant email skipped — no custom domain configured", {
      level: "warning",
      tags: { tenant_id: getCurrentTenantId() || "", area: "tenant-email" },
    });
    return;
  }
  await sendEmail({
    to: email,
    from: tenantEmail.from,
    replyTo: tenantEmail.replyTo,
    subject,
    html,
    text,
    tags: [{ name: "type", value: "coupon_assigned" }],
  }).catch((e) => console.error("[coupon-assigned email failed, non-fatal]", e));
}
