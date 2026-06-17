// GET /api/cron/onboarding-nudge
//
// Daily nudge for tenants who signed up but haven't activated. Sends:
//   Day 2 (if <33% complete) → "Need help getting started?"
//   Day 5 (if <66% complete) → "Halfway there — let's finish"
//   Day 14 (if <100% complete and not paying) → "Trial ending — finish setup"
//
// Tracks sent nudges via a JSONB column on tenants (onboarding_nudges_sent).
// Each tenant gets each nudge at most once.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailConfigured } from "@/lib/email/send";
import { sendFromSaasOwner } from "@/lib/email/saas-owner-send";
import { fetchOnboardingForTenant } from "@/lib/superadmin/onboarding-checklist";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = headers().get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return await runNudges();
  } catch (e: any) {
    Sentry.captureException(e, { tags: { stage: "onboarding_nudge_route" } });
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

async function runNudges() {
  const supabase = createAdminClient({ unscoped: true });

  // Pull all tenants younger than 30 days who aren't paying
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, business_name, owner_email, plan, subscription_status, created_at, onboarding_nudges_sent")
    .gte("created_at", cutoff)
    .neq("plan", "founder")
    .or("subscription_status.is.null,subscription_status.neq.active");

  const results: any[] = [];
  for (const t of (tenants as any[]) || []) {
    try {
      const status = await fetchOnboardingForTenant(t.id);
      if (!status) continue;

      const sent: string[] = Array.isArray(t.onboarding_nudges_sent)
        ? t.onboarding_nudges_sent
        : [];
      const days = status.days_since_signup;
      const pct = status.percentage;

      let nudgeKey: string | null = null;
      if (days >= 14 && pct < 100 && !sent.includes("day_14")) nudgeKey = "day_14";
      else if (days >= 5 && pct < 66 && !sent.includes("day_5")) nudgeKey = "day_5";
      else if (days >= 2 && pct < 33 && !sent.includes("day_2")) nudgeKey = "day_2";

      if (!nudgeKey) {
        results.push({ tenant: t.business_name, day: days, pct, action: "no_nudge_needed" });
        continue;
      }

      const ok = await sendNudgeEmail(t, status, nudgeKey);
      if (!ok) {
        results.push({ tenant: t.business_name, action: "email_skipped (no infra)" });
        continue;
      }

      await supabase.from("tenants").update({
        onboarding_nudges_sent: [...sent, nudgeKey],
        onboarding_last_nudge_at: new Date().toISOString(),
      }).eq("id", t.id);

      results.push({ tenant: t.business_name, day: days, pct, action: `sent_${nudgeKey}` });
    } catch (e: any) {
      Sentry.captureException(e, { tags: { stage: "onboarding_nudge", tenant_id: t.id } });
      results.push({ tenant: t.business_name, error: String(e?.message || e) });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}

async function sendNudgeEmail(
  tenant: { business_name: string; owner_email: string },
  status: Awaited<ReturnType<typeof fetchOnboardingForTenant>>,
  nudgeKey: string,
): Promise<boolean> {
  if (!isEmailConfigured() || !tenant.owner_email || !status) return false;
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://getrentalflow.com";
  const helpUrl = `${base}/admin/support`;

  const remaining = status.items.filter((i) => !i.done).slice(0, 3);
  const checklist = remaining.map((i) =>
    `<li style="margin:6px 0">⏳ ${i.label}${i.hint ? ` <span style="color:#888">— ${i.hint}</span>` : ""}</li>`,
  ).join("");

  const templates: Record<string, { subject: string; html: string }> = {
    day_2: {
      subject: `Quick question — need help with RentalFlow setup?`,
      html: `<p>Hi ${tenant.business_name || "there"},</p>
<p>Noticed you signed up 2 days ago but haven't gotten everything set up yet. <strong>Most tenants are taking real bookings within 60 minutes.</strong></p>
<p>The 3 things left for you:</p>
<ul style="padding-left:20px;list-style:none">${checklist}</ul>
<p>Need a hand? <a href="${helpUrl}">Hit reply</a> or browse our knowledge base.</p>
<p>— RentalFlow</p>`,
    },
    day_5: {
      subject: `You're ${status.percentage}% set up — let's finish strong`,
      html: `<p>Hi ${tenant.business_name || "there"},</p>
<p>You're <strong>${status.percentage}% through onboarding</strong>. Just a few things left:</p>
<ul style="padding-left:20px;list-style:none">${checklist}</ul>
<p>Once those are done you can start taking real bookings. Your 30-day trial gives you plenty of runway.</p>
<p><a href="${base}/admin/dashboard" style="background:#1a1a6e;color:white;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Open admin</a></p>
<p>— RentalFlow</p>`,
    },
    day_14: {
      subject: `⏰ Your trial is halfway over — let's get you taking bookings`,
      html: `<p>Hi ${tenant.business_name || "there"},</p>
<p>You're on day ${status.days_since_signup} of your 30-day trial and still at <strong>${status.percentage}% setup</strong>.</p>
<p>I don't want you to miss your window. The last steps:</p>
<ul style="padding-left:20px;list-style:none">${checklist}</ul>
<p>If you've decided RentalFlow isn't the right fit, that's totally OK — just hit reply and let me know what's missing for you. Real owner replies, not a bot.</p>
<p>— Ludmila, RentalFlow</p>`,
    },
  };

  const t = templates[nudgeKey];
  if (!t) return false;

  await sendFromSaasOwner({
    to: tenant.owner_email,
    subject: t.subject,
    html: t.html,
  });
  return true;
}
