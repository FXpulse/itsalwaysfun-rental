// GET /api/cron/beta-lifecycle-status
//
// Public health endpoint for UptimeRobot. Returns:
//   - 200 when there are no active beta tenants OR the most recent beta
//     lifecycle email is within the last 25 hours (cron runs daily).
//   - 503 when there ARE active beta tenants AND no lifecycle email has
//     fired in the last 25 hours — likely the cron is wedged or the env
//     var BETA_PROGRAM_END_AT got mis-set.
//
// Wire UptimeRobot to this URL; it pages Ludmila when beta nurture goes
// silent. No auth required — the response only exposes counts + a
// timestamp, no PII.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Snapshot {
  active_beta_tenants: number;
  last_lifecycle_email_sent_at: string | null;
  hours_since_last: number | null;
  beta_program_end_at: string | null;
  healthy: boolean;
  reason: string;
}

export async function GET() {
  const supabase = createAdminClient({ unscoped: true });

  // Active beta tenants = beta_program_joined_at set AND subscription not
  // cancelled. We treat trialing + active as "still in the program."
  const { data: betaTenants } = await supabase
    .from("tenants")
    .select("id, beta_program_joined_at, beta_emails_sent, subscription_status")
    .not("beta_program_joined_at", "is", null)
    .neq("subscription_status", "canceled");
  const active = (betaTenants as any[]) || [];

  // Most recent lifecycle email = max created_at across booking_emails_sent
  // with email_type starting with 'beta_'. (Beta lifecycle uses
  // booking_emails_sent to record what was already sent for idempotency.)
  let lastSent: string | null = null;
  if (active.length > 0) {
    const { data: lastRow } = await supabase
      .from("booking_emails_sent")
      .select("created_at")
      .like("email_type", "beta_%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastSent = (lastRow as { created_at: string } | null)?.created_at ?? null;
  }

  const hoursSince = lastSent
    ? Math.round((Date.now() - new Date(lastSent).getTime()) / 3_600_000)
    : null;

  let healthy = true;
  let reason = "ok";

  if (active.length === 0) {
    reason = "no active beta tenants — cron has nothing to do, expected";
  } else if (!lastSent) {
    healthy = false;
    reason = `${active.length} active beta tenants but no lifecycle email sent yet`;
  } else if ((hoursSince ?? 0) > 25) {
    healthy = false;
    reason = `last lifecycle email was ${hoursSince}h ago — cron may be wedged`;
  } else {
    reason = `${active.length} beta tenants · last sent ${hoursSince}h ago`;
  }

  const snap: Snapshot = {
    active_beta_tenants: active.length,
    last_lifecycle_email_sent_at: lastSent,
    hours_since_last: hoursSince,
    beta_program_end_at: process.env.BETA_PROGRAM_END_AT || null,
    healthy,
    reason,
  };

  return NextResponse.json(snap, { status: healthy ? 200 : 503 });
}
