// Webhook retry cron — runs every 5 minutes. Picks up failed deliveries
// whose next_retry_at has passed and re-attempts them. Exponential backoff
// is encoded in lib/webhooks/dispatch.ts (immediate, +5m, +30m, +2h, give up).

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { retryDelivery } from "@/lib/webhooks/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient({ unscoped: true });
  const now = new Date().toISOString();
  const { data: due } = await supabase
    .from("webhook_deliveries")
    .select("id")
    .eq("succeeded", false)
    .lte("next_retry_at", now)
    .not("next_retry_at", "is", null)
    .limit(50);

  const list = (due as { id: string }[]) || [];
  let attempted = 0;
  for (const d of list) {
    try {
      await retryDelivery(d.id);
      attempted++;
    } catch (e: any) {
      console.error("[webhook retry] failed for", d.id, e?.message);
    }
  }

  return NextResponse.json({ ok: true, found: list.length, attempted });
}
