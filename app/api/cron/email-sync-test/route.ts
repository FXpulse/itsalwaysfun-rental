// GET /api/cron/email-sync-test
// Minimal diagnostic — just returns ok. If this 500s, the route system itself
// is broken. If this works but email-sync 500s, the issue is in our imports.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
