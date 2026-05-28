// GET /api/health
// Public health check for external monitoring (UptimeRobot, BetterStack,
// etc.). Returns 200 if the app + DB are reachable, 503 otherwise.
//
// Set UptimeRobot to ping this every 5 minutes; alert on 2 consecutive
// failures. The check is light (one SELECT 1 equivalent) so polling cost
// is negligible.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const checks: Record<string, { ok: boolean; ms?: number; error?: string }> = {};

  // 1. Database — count tenants (small fixed table, cheap query)
  try {
    const t0 = Date.now();
    const supabase = createAdminClient({ unscoped: true });
    const { error } = await supabase
      .from("tenants")
      .select("id", { count: "exact", head: true })
      .limit(1);
    checks.database = {
      ok: !error,
      ms: Date.now() - t0,
      error: error?.message,
    };
  } catch (e: any) {
    checks.database = { ok: false, error: String(e?.message || e) };
  }

  // 2. Env config — sanity check that critical secrets are loaded
  const requiredEnv = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_SECRET_KEY",
  ];
  const missing = requiredEnv.filter((k) => !process.env[k]);
  checks.env = {
    ok: missing.length === 0,
    error: missing.length ? `missing: ${missing.join(", ")}` : undefined,
  };

  const allOk = Object.values(checks).every((c) => c.ok);
  const totalMs = Date.now() - startedAt;

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      total_ms: totalMs,
      checks,
    },
    { status: allOk ? 200 : 503 },
  );
}
