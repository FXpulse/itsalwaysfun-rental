// GET /api/cron/lead-magnet-resync
// Daily. Retries GHL sync for any lead_magnet_signups where the
// fire-and-forget call from the submit endpoint failed.
//
// Caps at 200 rows per run to avoid blowing GHL rate limits.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isGhlConfigured,
  lookupContactByEmail,
  upsertContact,
  addContactTags,
} from "@/lib/ghl/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = headers().get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return await Sentry.withMonitor(
    "lead-magnet-resync",
    async () => {
      if (!isGhlConfigured()) {
        return NextResponse.json({ ok: true, skipped: "ghl_not_configured" });
      }

      const supabase = createAdminClient({ unscoped: true });
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: pending, error } = await supabase
        .from("lead_magnet_signups")
        .select("id, email, tool_name, marketing_opt_in, payload_json")
        .is("ghl_synced_at", null)
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(200);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      let synced = 0;
      let failed = 0;
      for (const row of pending || []) {
        try {
          const tags = [
            `${row.tool_name}-user`,
            ...((row.payload_json as any)?.ref === "email6"
              ? ["email6-engaged"]
              : []),
            ...(row.marketing_opt_in ? ["rf-marketing-opt-in"] : []),
          ];

          const existing = await lookupContactByEmail(row.email);
          let contactId: string | null =
            existing && "contact" in existing && existing.contact
              ? (existing.contact as any).id
              : null;

          if (!contactId) {
            const created = await upsertContact({ email: row.email, tags, firstName: "", lastName: "" });
            contactId =
              created && "contact" in created && created.contact
                ? (created.contact as any).id
                : null;
          }

          if (!contactId) {
            failed++;
            continue;
          }

          await addContactTags(contactId, tags);
          await supabase
            .from("lead_magnet_signups")
            .update({
              ghl_synced_at: new Date().toISOString(),
              ghl_contact_id: contactId,
            })
            .eq("id", row.id);
          synced++;
        } catch (e) {
          failed++;
          Sentry.captureException(e, {
            tags: { stage: "lead_magnet_resync", row_id: row.id },
          });
        }
      }

      return NextResponse.json({ ok: true, synced, failed, scanned: pending?.length ?? 0 });
    },
  );
}
