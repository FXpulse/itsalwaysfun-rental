// GET /api/cron/booking-emails
// Runs daily (configured in vercel.json) — sends due scheduled emails.
//
// Vercel Cron sends a bearer token from env CRON_SECRET so we verify
// the request is legit. Manual triggering: hit the URL with
//   Authorization: Bearer <CRON_SECRET>

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { processScheduledBookingEmails } from "@/lib/email/scheduled-emails";

export const dynamic = "force-dynamic";

export async function GET() {
  // Verify the request came from Vercel Cron (bearer token)
  const auth = headers().get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return await Sentry.withMonitor(
    "booking-emails",
    async () => {
      try {
        const summary = await processScheduledBookingEmails();
        return NextResponse.json({
          ok: true,
          ranAt: new Date().toISOString(),
          ...summary,
        });
      } catch (e: any) {
        return NextResponse.json(
          { ok: false, error: e.message || "Unknown error" },
          { status: 500 },
        );
      }
    },
    {
      schedule: { type: "crontab", value: "0 14 * * *" },
      checkinMargin: 5,
      maxRuntime: 10,
      timezone: "UTC",
    },
  );
}
