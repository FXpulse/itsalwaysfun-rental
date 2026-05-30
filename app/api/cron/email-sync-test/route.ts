// GET /api/cron/email-sync-test
// Progressive diagnostic — imports modules in stages so we can pinpoint
// which import crashes the route at load time.

import { NextResponse } from "next/server";
import { parseRawMessage } from "@/lib/email/parser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    parser_imported: typeof parseRawMessage === "function",
    ts: new Date().toISOString(),
  });
}
