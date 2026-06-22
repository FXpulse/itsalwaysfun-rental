"use server";

import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendFromSaasOwner } from "@/lib/email/saas-owner-send";
import { rateLimit } from "@/lib/rate-limit";

/** Request a password reset for a superadmin account.
 *
 *  Strict policy: only emails that resolve to a user with
 *  user_roles.is_superadmin = true will trigger an email. To avoid leaking
 *  whether an email is a superadmin or not, the response is identical
 *  regardless ("If that email belongs to a superadmin..."). The actual
 *  Resend send is gated server-side.
 *
 *  Rate-limited per-IP (5/15min) and per-email (3/15min). The link
 *  Supabase generates is single-use and has a short TTL.
 */
export async function requestSuperadminReset(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const normalized = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
    return { ok: false, error: "Invalid email format" };
  }

  const ip =
    headers().get("x-forwarded-for")?.split(",")[0].trim() ||
    headers().get("x-real-ip") ||
    "unknown";
  const [rlIp, rlEmail] = await Promise.all([
    rateLimit(`sa-reset-ip:${ip}`, { max: 5, windowSeconds: 900 }),
    rateLimit(`sa-reset-email:${normalized}`, { max: 3, windowSeconds: 900 }),
  ]);
  if (!rlIp.allowed || !rlEmail.allowed) {
    return {
      ok: false,
      error: "Too many reset attempts. Wait a few minutes and try again.",
    };
  }

  const supabase = createAdminClient({ unscoped: true });

  // Look up the user. We DO NOT reveal whether the email exists; the email
  // only fires when the lookup resolves to a real superadmin.
  let userId: string | null = null;
  let page = 1;
  while (page < 50) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    const found = (data?.users || []).find(
      (u) => (u.email || "").toLowerCase() === normalized,
    );
    if (found) {
      userId = found.id;
      break;
    }
    if (!data?.users || data.users.length < 200) break;
    page++;
  }

  if (userId) {
    const { data: role } = await supabase
      .from("user_roles")
      .select("is_superadmin")
      .eq("user_id", userId)
      .eq("is_superadmin", true)
      .maybeSingle();

    if (role) {
      try {
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL || "https://getrentalflow.com";
        const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
          type: "recovery",
          email: normalized,
          options: {
            redirectTo: `${baseUrl}/superadmin/reset-password`,
          },
        });
        if (linkErr || !linkData?.properties?.action_link) {
          Sentry.captureMessage("superadmin reset: generateLink failed", {
            level: "warning",
            tags: { area: "superadmin-reset" },
            extra: { error: linkErr?.message },
          });
        } else {
          await sendFromSaasOwner({
            to: normalized,
            subject: "Reset your RentalFlow superadmin password",
            html: `<div style="font-family:system-ui,sans-serif;max-width:520px;color:#0f172a;line-height:1.55">
<p>Hi,</p>
<p>Use the link below to set a new password on your RentalFlow superadmin account. This link is one-time use and expires in about an hour.</p>
<p style="margin:18px 0">
  <a href="${linkData.properties.action_link}" style="background:#1a1a6e;color:white;padding:11px 22px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:bold">Set a new password</a>
</p>
<p style="font-size:13px;color:#64748b">If you didn't request this, ignore this email — nothing changes on your account.</p>
</div>`,
            text: `Use this link to set a new password on your RentalFlow superadmin account. One-time use, expires in ~1 hour.\n\n${linkData.properties.action_link}\n\nIf you didn't request this, ignore this email.`,
            tags: [{ name: "type", value: "superadmin_reset" }],
          });
        }
      } catch (e) {
        Sentry.captureException(e, { tags: { area: "superadmin-reset" } });
      }
    }
  }

  // Identical response whether the email matched a superadmin or not.
  return { ok: true };
}
