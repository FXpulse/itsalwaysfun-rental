// Beta-program lifecycle emails — Ludmila/Henry → operator.
//
// Tenant-side platform emails (not customer-facing). Sent FROM the
// platform's noreply address (EMAIL_FROM) on getrentalflow.com, NOT from
// the tenant's custom domain. Mirrors the existing onboarding-nudge
// pattern (lib/email/scheduled-emails not used here because that's
// booking-lifecycle for tenant → end-customer).
//
// 4 emails:
//   welcome        — at signup, immediate
//   day_30_checkin — cron, 30 days after beta_program_joined_at
//   day_60_usage   — cron, 60 days
//   day_80_convert — cron, 80 days (10 days before trial end)
//
// Idempotency: each email key is appended to tenants.beta_emails_sent
// jsonb array after a successful send. The cron rechecks the array
// before each send, so duplicates can't happen even if the cron fires
// twice or a manual call happens.

import { isEmailConfigured } from "@/lib/email/send";
import { sendFromSaasOwner } from "@/lib/email/saas-owner-send";
import * as Sentry from "@sentry/nextjs";

export type BetaEmailKey =
  | "welcome"
  | "day_30_checkin"
  | "day_60_usage"
  | "day_80_convert";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://getrentalflow.com";

function buildEmail(
  tenant: { business_name: string; owner_email: string; slug: string },
  key: BetaEmailKey,
): { subject: string; html: string; text: string } | null {
  const name = tenant.business_name || "there";
  const adminUrl = `https://${tenant.slug}.getrentalflow.com/admin/dashboard`;
  const replyHint =
    "Just hit reply on this email — it lands in my inbox, not a help desk queue.";

  switch (key) {
    case "welcome":
      return {
        subject: `You're in the RentalFlow beta — here's what to do first`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#0f172a;line-height:1.55">
<p>Hey ${name},</p>
<p>Welcome to the RentalFlow beta. You have <strong>90 days</strong> to take this thing for a real spin — no credit card on file, no card asked at the end of the trial without your action.</p>
<p>Three things that will save you time over the next week:</p>
<ol style="padding-left:18px">
  <li><strong>Stripe Connect first.</strong> The booking flow needs it. <a href="${adminUrl.replace("/dashboard", "/settings/payments")}">Set up Stripe →</a></li>
  <li><strong>Bulk-upload your products.</strong> If you have a Google Sheet of inventory, paste it as CSV. <a href="${adminUrl.replace("/dashboard", "/bulk-upload")}">Bulk upload →</a></li>
  <li><strong>Open <code>/admin/help</code>.</strong> 70+ articles covering every screen. The AI assistant in the corner (sparkle icon) reads your data and answers in plain English.</li>
</ol>
<p style="background:#fff8e1;border-left:4px solid #f59e0b;padding:10px 14px;border-radius:4px;margin-top:18px"><strong>This is what we want from you:</strong> as you use it, if something feels off or missing, tell us. Don't sugar-coat it — bug reports are the whole point of this program.</p>
<p>${replyHint}</p>
<p style="margin-top:18px">
  <a href="${adminUrl}" style="background:#1a1a6e;color:white;padding:11px 22px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:bold">Open your dashboard</a>
</p>
<p>— Ludmila & Henry<br/>RentalFlow</p>
</div>`,
        text: `Hey ${name},

Welcome to the RentalFlow beta. You have 90 days, no card on file.

Three things to save you time:
1. Set up Stripe Connect first: ${adminUrl.replace("/dashboard", "/settings/payments")}
2. Bulk-upload products from a CSV: ${adminUrl.replace("/dashboard", "/bulk-upload")}
3. Open /admin/help — 70+ articles + AI assistant in the corner.

What we want from you: if something is off or missing, tell us. Bug reports are the whole point.

Open your dashboard: ${adminUrl}

— Ludmila & Henry, RentalFlow`,
      };

    case "day_30_checkin":
      return {
        subject: `Day 30 — how's it going?`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#0f172a;line-height:1.55">
<p>Hey ${name},</p>
<p>You're 30 days into the beta. Quick check-in:</p>
<ul style="padding-left:18px;list-style:none">
  <li>✓ &nbsp; Is the booking flow doing what you need?</li>
  <li>✓ &nbsp; Drivers using the mobile app, or sticking to paper sheets?</li>
  <li>✓ &nbsp; Anything you wanted to find that you couldn't?</li>
</ul>
<p>You have 60 days left on the free trial. If something is half-broken or you couldn't figure out how to do a thing — that's exactly what we need to hear before you decide to convert.</p>
<p>${replyHint}</p>
<p style="margin-top:18px">
  <a href="${adminUrl}" style="background:#1a1a6e;color:white;padding:11px 22px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:bold">Open your dashboard</a>
</p>
<p>— Ludmila</p>
</div>`,
        text: `Hey ${name},

30 days in. Quick check-in:
- Is the booking flow doing what you need?
- Drivers using the mobile app or sticking to paper?
- Anything you wanted to find but couldn't?

60 days left on the trial. If something is half-broken, tell us before you decide to convert.

— Ludmila`,
      };

    case "day_60_usage":
      return {
        subject: `Day 60 — what would make you stay?`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#0f172a;line-height:1.55">
<p>Hey ${name},</p>
<p>Day 60 of your 90-day beta. Most folks know by now whether the platform is going to work for them.</p>
<p>One question I genuinely want a real answer to: <strong>what's the ONE thing missing that's preventing you from using us as your full system?</strong></p>
<p>It might be a feature we haven't built. It might be a process step that doesn't match how your business actually works. It might be a UX thing that drives you crazy.</p>
<p>Tell me. We're at the stage where we ship feature requests in 1-2 weeks. The earlier I hear it, the better your version of RentalFlow gets.</p>
<p>${replyHint}</p>
<p>— Ludmila</p>
</div>`,
        text: `Hey ${name},

Day 60 of your 90-day beta. Most folks know by now if it's going to work.

One question: what's the ONE thing missing that's preventing you from using us as your full system?

We ship feature requests in 1-2 weeks at this stage. The earlier I hear it, the better.

— Ludmila`,
      };

    case "day_80_convert":
      return {
        subject: `10 days left in your trial — here's what to expect`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#0f172a;line-height:1.55">
<p>Hey ${name},</p>
<p>You have 10 days left on your 90-day beta trial. After that you'll either:</p>
<ol style="padding-left:18px">
  <li><strong>Convert at $99/month flat.</strong> Same plan as everyone else — unlimited bookings, no commission, everything you're already using.</li>
  <li><strong>Cancel.</strong> We export everything to CSV (customers, bookings, products, expenses) before deleting the account. Your Stripe Connect account is yours either way.</li>
</ol>
<p style="background:#ecfdf5;border-left:4px solid #10b981;padding:10px 14px;border-radius:4px;margin-top:18px">If you're converting, the easiest way is to add a card at <a href="${adminUrl.replace("/dashboard", "/settings/billing")}">/admin/settings/billing</a>. Takes 60 seconds.</p>
<p>If you're cancelling, hit reply and tell me why. That's the most valuable feedback we get out of this whole program.</p>
<p>Either way — thank you for putting RentalFlow through real-world use for 80+ days. That's what made the platform better for everyone after you.</p>
<p>${replyHint}</p>
<p>— Ludmila & Henry</p>
</div>`,
        text: `Hey ${name},

10 days left on your 90-day beta. After that:
1. Convert at $99/month flat. Same plan as everyone else.
2. Cancel. CSV export of all your data before deletion.

If converting: add a card at ${adminUrl.replace("/dashboard", "/settings/billing")} (60 seconds).
If cancelling: hit reply and tell me why. That's the most valuable feedback from this whole program.

— Ludmila & Henry`,
      };
  }
}

/** Send one beta lifecycle email. Idempotent: caller passes the current
 *  beta_emails_sent array; this function returns the new array (with the
 *  key appended) when the send succeeds, or null if it skipped (already
 *  sent OR email not configured OR template missing). */
export async function sendBetaLifecycleEmail(
  tenant: {
    id: string;
    business_name: string;
    owner_email: string;
    slug: string;
  },
  key: BetaEmailKey,
  currentLedger: string[],
): Promise<string[] | null> {
  if (currentLedger.includes(key)) return null;
  if (!isEmailConfigured() || !tenant.owner_email) return null;

  const built = buildEmail(tenant, key);
  if (!built) return null;

  try {
    const r = await sendFromSaasOwner({
      to: tenant.owner_email,
      subject: built.subject,
      html: built.html,
      text: built.text,
      tags: [
        { name: "type", value: "beta_lifecycle" },
        { name: "key", value: key },
      ],
    });
    if (!r.ok) {
      Sentry.captureMessage("beta-lifecycle send failed", {
        level: "warning",
        tags: { area: "beta-lifecycle", key, via: r.via },
        extra: { tenant_id: tenant.id, error: r.error },
      });
      return null;
    }
    return [...currentLedger, key];
  } catch (e) {
    Sentry.captureException(e, {
      tags: { area: "beta-lifecycle", key, tenant_id: tenant.id },
    });
    return null;
  }
}
