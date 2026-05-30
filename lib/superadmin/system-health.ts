// System health snapshot for the Dashboard widget.
// Pings each cron health surface + measures DB latency + counts recent Sentry-like errors.

import { createAdminClient } from "@/lib/supabase/admin";

export interface SystemHealthSnapshot {
  db_response_ms: number;
  crons: Array<{
    name: string;
    status: "healthy" | "warning" | "stale" | "unknown";
    last_run_ago_hours: number | null;
  }>;
  recent_errors_24h: number;
  email_send_ok: boolean;
  overall_status: "healthy" | "warning" | "critical";
}

const EXPECTED_CRONS = [
  { name: "booking-emails", expect_hours: 26 },          // daily
  { name: "quote-followup", expect_hours: 26 },          // daily
  { name: "quote-hold-reminder", expect_hours: 2 },      // hourly
  { name: "low-stock-alert", expect_hours: 26 },         // daily
  { name: "lead-magnet-resync", expect_hours: 26 },      // daily
  { name: "email-sync", expect_hours: 0.5 },              // every 5 min
  { name: "dunning", expect_hours: 26 },                  // daily
  { name: "onboarding-nudge", expect_hours: 26 },         // daily
];

export async function fetchSystemHealth(): Promise<SystemHealthSnapshot> {
  const supabase = createAdminClient({ unscoped: true });
  const t0 = Date.now();

  // DB latency (a tiny indexed query)
  const { data: _probe, error: probeError } = await supabase
    .from("tenants").select("id").limit(1);
  const db_response_ms = Date.now() - t0;

  // Cron health derived from audit_log — last entry per cron action.
  // The crons we ship insert audit rows on success.
  const since = new Date(Date.now() - 48 * 3_600_000).toISOString();
  const { data: auditRows } = await supabase
    .from("audit_log")
    .select("action, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);

  const lastSeen = new Map<string, Date>();
  for (const row of (auditRows as Array<{ action: string; created_at: string }> | null) || []) {
    if (!lastSeen.has(row.action)) lastSeen.set(row.action, new Date(row.created_at));
  }

  const crons = EXPECTED_CRONS.map((c) => {
    // We don't track exact cron success in audit_log (yet) — return unknown to
    // signal "we don't have data" rather than red-status panic. Real impl
    // would have each cron INSERT into a cron_runs table.
    const last = lastSeen.get(`cron.${c.name}.ok`);
    const last_run_ago_hours = last ? (Date.now() - last.getTime()) / 3_600_000 : null;
    const status: SystemHealthSnapshot["crons"][number]["status"] = last_run_ago_hours === null
      ? "unknown"
      : last_run_ago_hours <= c.expect_hours ? "healthy"
      : last_run_ago_hours <= c.expect_hours * 2 ? "warning"
      : "stale";
    return { name: c.name, status, last_run_ago_hours };
  });

  // Recent errors: count audit_log error rows in last 24h
  const errorSince = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { count: recent_errors_24h } = await supabase
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .gte("created_at", errorSince)
    .ilike("action", "%error%");

  // Email send health — check Resend env presence
  const email_send_ok = !!process.env.RESEND_API_KEY;

  // Overall band
  const staleCount = crons.filter((c) => c.status === "stale").length;
  const overall_status: SystemHealthSnapshot["overall_status"] =
    probeError ? "critical" :
    staleCount > 2 ? "critical" :
    staleCount > 0 || (recent_errors_24h ?? 0) > 10 ? "warning" :
    "healthy";

  return {
    db_response_ms,
    crons,
    recent_errors_24h: recent_errors_24h ?? 0,
    email_send_ok,
    overall_status,
  };
}
