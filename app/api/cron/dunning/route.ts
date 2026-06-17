// GET /api/cron/dunning
//
// Runs daily. For each tenant with subscription_status = past_due, progress
// through the dunning sequence:
//
//   Day 1 (kickoff)     → "Payment failed — update your card"
//   Day 3               → "Reminder — we couldn't charge you"
//   Day 7               → "Final notice — account closes in 24 hours"
//   Day 8               → Cancel subscription via Stripe, mark suspended
//
// If subscription_status changes back to "active" between sends, mark
// dunning_recovered_at and stop the sequence. The recovered tenant gets a
// "Thanks — we're back on track" email automatically.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailConfigured } from "@/lib/email/send";
import { sendFromSaasOwner } from "@/lib/email/saas-owner-send";
import { getStripe } from "@/lib/stripe/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface TenantRow {
  id: string;
  business_name: string;
  owner_email: string;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
  dunning_started_at: string | null;
  dunning_emails_sent: string[] | null;     // ["day_1","day_3",...]
  dunning_recovered_at: string | null;
  suspended_at: string | null;
}

export async function GET() {
  const auth = headers().get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return await runDunning();
  } catch (e: any) {
    Sentry.captureException(e, { tags: { stage: "dunning_route" } });
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

async function runDunning() {
  const supabase = createAdminClient({ unscoped: true });
  const now = new Date();

  // Two queries: kickoff fresh past_due, advance already-in-dunning
  const { data: freshPastDue } = await supabase
    .from("tenants")
    .select("id, business_name, owner_email, subscription_status, stripe_subscription_id, dunning_started_at, dunning_emails_sent, dunning_recovered_at, suspended_at")
    .eq("subscription_status", "past_due")
    .is("dunning_started_at", null);

  const { data: inDunning } = await supabase
    .from("tenants")
    .select("id, business_name, owner_email, subscription_status, stripe_subscription_id, dunning_started_at, dunning_emails_sent, dunning_recovered_at, suspended_at")
    .not("dunning_started_at", "is", null)
    .is("dunning_recovered_at", null);

  const results: any[] = [];

  // 1. Kick off new dunning for fresh past_due
  for (const t of (freshPastDue as TenantRow[]) || []) {
    try {
      await sendDunningEmail(t, "day_1");
      await supabase.from("tenants").update({
        dunning_started_at: now.toISOString(),
        dunning_emails_sent: ["day_1"],
        dunning_last_action_at: now.toISOString(),
      }).eq("id", t.id);
      results.push({ tenant: t.business_name, action: "kicked_off" });
    } catch (e: any) {
      Sentry.captureException(e, { tags: { stage: "dunning_kickoff", tenant_id: t.id } });
      results.push({ tenant: t.business_name, error: String(e?.message || e) });
    }
  }

  // 2. Advance / recover tenants already in dunning
  for (const t of (inDunning as TenantRow[]) || []) {
    try {
      // Recovery? Payment resumed
      if (t.subscription_status === "active") {
        await sendRecoveryEmail(t);
        await supabase.from("tenants").update({
          dunning_recovered_at: now.toISOString(),
          dunning_last_action_at: now.toISOString(),
        }).eq("id", t.id);
        results.push({ tenant: t.business_name, action: "recovered" });
        continue;
      }

      // Still past_due — figure out which day we're on
      const startedAt = t.dunning_started_at ? new Date(t.dunning_started_at) : now;
      const dayNum = Math.floor((now.getTime() - startedAt.getTime()) / 86_400_000);
      const sent = new Set(t.dunning_emails_sent || []);

      // Send appropriate email
      let action = "no_op";
      if (dayNum >= 8 && !sent.has("cancelled")) {
        // Cancel + suspend
        if (t.stripe_subscription_id) {
          try {
            const stripe = getStripe();
            await stripe.subscriptions.cancel(t.stripe_subscription_id);
          } catch (e) {
            Sentry.captureException(e, { tags: { stage: "dunning_cancel", tenant_id: t.id } });
          }
        }
        await supabase.from("tenants").update({
          suspended_at: now.toISOString(),
          subscription_status: "canceled",
          dunning_emails_sent: [...Array.from(sent), "cancelled"],
          dunning_last_action_at: now.toISOString(),
        }).eq("id", t.id);
        await sendDunningEmail(t, "cancelled");
        action = "auto_cancelled";
      } else if (dayNum >= 7 && !sent.has("day_7")) {
        await sendDunningEmail(t, "day_7");
        await supabase.from("tenants").update({
          dunning_emails_sent: [...Array.from(sent), "day_7"],
          dunning_last_action_at: now.toISOString(),
        }).eq("id", t.id);
        action = "sent_day_7";
      } else if (dayNum >= 3 && !sent.has("day_3")) {
        await sendDunningEmail(t, "day_3");
        await supabase.from("tenants").update({
          dunning_emails_sent: [...Array.from(sent), "day_3"],
          dunning_last_action_at: now.toISOString(),
        }).eq("id", t.id);
        action = "sent_day_3";
      }

      results.push({ tenant: t.business_name, day: dayNum, action });
    } catch (e: any) {
      Sentry.captureException(e, { tags: { stage: "dunning_advance", tenant_id: t.id } });
      results.push({ tenant: t.business_name, error: String(e?.message || e) });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}

async function sendDunningEmail(
  tenant: TenantRow,
  stage: "day_1" | "day_3" | "day_7" | "cancelled",
) {
  if (!isEmailConfigured() || !tenant.owner_email) return;
  const billingUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://getrentalflow.com"}/admin/settings/billing`;
  const supportUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://getrentalflow.com"}/admin/support`;

  const templates: Record<string, { subject: string; html: string }> = {
    day_1: {
      subject: `Payment failed on your RentalFlow subscription`,
      html: `<p>Hi ${tenant.business_name || "there"},</p>
<p>We couldn't process your payment this month. No drama — just need you to update your card so your account stays active.</p>
<p><a href="${billingUrl}" style="background:#1a1a6e;color:white;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Update payment method</a></p>
<p>Once updated we'll retry the charge automatically.</p>
<p>— RentalFlow</p>`,
    },
    day_3: {
      subject: `Reminder — your RentalFlow payment hasn't gone through`,
      html: `<p>Hi ${tenant.business_name || "there"},</p>
<p>Heads up — your card is still not charging successfully. Your account is still active but will be paused if we don't resolve this soon.</p>
<p><a href="${billingUrl}" style="background:#1a1a6e;color:white;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Fix it now</a></p>
<p>If something's blocking the payment let us know — <a href="${supportUrl}">we can help</a>.</p>
<p>— RentalFlow</p>`,
    },
    day_7: {
      subject: `⚠️ Final notice — RentalFlow access ends in 24 hours`,
      html: `<p>Hi ${tenant.business_name || "there"},</p>
<p><strong>This is the last reminder.</strong> If we still can't charge your card by tomorrow, your RentalFlow subscription will be cancelled and your admin access locked.</p>
<p>Your data will stay safe for 90 days in case you reactivate, but bookings and customer-facing pages will go offline immediately.</p>
<p><a href="${billingUrl}" style="background:#dc2626;color:white;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Save your account</a></p>
<p>— RentalFlow</p>`,
    },
    cancelled: {
      subject: `Your RentalFlow subscription has been cancelled`,
      html: `<p>Hi ${tenant.business_name || "there"},</p>
<p>After 8 days of unsuccessful charges, your RentalFlow subscription has been cancelled and your admin access locked.</p>
<p>If this was a mistake or you want to come back, reach us at <a href="${supportUrl}">support</a>. Your data is preserved for 90 days.</p>
<p>— RentalFlow</p>`,
    },
  };

  const t = templates[stage];
  if (!t) return;
  await sendFromSaasOwner({
    to: tenant.owner_email,
    subject: t.subject,
    html: t.html,
  });
}

async function sendRecoveryEmail(tenant: TenantRow) {
  if (!isEmailConfigured() || !tenant.owner_email) return;
  await sendFromSaasOwner({
    to: tenant.owner_email,
    subject: `Payment received — RentalFlow is back on track ✓`,
    html: `<p>Hi ${tenant.business_name || "there"},</p>
<p>Great news — we successfully charged your card. Your RentalFlow account is fully active again.</p>
<p>Thanks for sticking with us.</p>
<p>— RentalFlow</p>`,
  });
}
