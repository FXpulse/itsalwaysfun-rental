// GET /api/cron/cleanup-old-rows
//
// Daily archival cron. Removes rows from unbounded-growth tables once they
// are past their usable retention window. Each table has its own policy.
//
// What lives here vs what doesn't:
//   IN: tables where the row is purely operational state (delivery attempts,
//       transient OTP codes, etc.) and has no audit/compliance value past N days.
//   NOT IN: ledgers we keep forever — booking_emails_sent, admin_audit_log,
//       loyalty_transactions, inventory_unit_movements, contact_messages,
//       email_messages (superadmin inbox). Those are the audit trail.
//
// Policy summary:
//   webhook_deliveries succeeded=true  →  delete after 30 days
//   webhook_deliveries succeeded=false →  delete after 90 days
//   portal_otp_codes consumed_at IS NOT NULL OR expires_at < now-7d  →  delete

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WEBHOOK_SUCCEEDED_RETENTION_DAYS = 30;
const WEBHOOK_FAILED_RETENTION_DAYS = 90;
const OTP_CODE_GRACE_DAYS = 7;

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  return Sentry.withMonitor(
    "cleanup-old-rows",
    async () => {
      const supabase = createAdminClient({ unscoped: true });
      const now = new Date();

      const succeededCutoff = new Date(
        now.getTime() - WEBHOOK_SUCCEEDED_RETENTION_DAYS * 86400000,
      ).toISOString();
      const failedCutoff = new Date(
        now.getTime() - WEBHOOK_FAILED_RETENTION_DAYS * 86400000,
      ).toISOString();
      const otpCutoff = new Date(
        now.getTime() - OTP_CODE_GRACE_DAYS * 86400000,
      ).toISOString();

      // 1. webhook_deliveries — succeeded > 30d
      const { count: succeededDeleted, error: succErr } = await supabase
        .from("webhook_deliveries")
        .delete({ count: "exact" })
        .eq("succeeded", true)
        .lt("created_at", succeededCutoff);

      // 2. webhook_deliveries — failed > 90d (max_attempts exhausted by then)
      const { count: failedDeleted, error: failErr } = await supabase
        .from("webhook_deliveries")
        .delete({ count: "exact" })
        .eq("succeeded", false)
        .lt("created_at", failedCutoff);

      // 3. portal_otp_codes — consumed OR expired > 7d ago.
      // Codes already expired (per app logic) keep zero security value;
      // keeping consumed_at rows is a small audit trail but a week is plenty.
      const { count: otpDeleted, error: otpErr } = await supabase
        .from("portal_otp_codes")
        .delete({ count: "exact" })
        .or(`consumed_at.not.is.null,expires_at.lt.${otpCutoff}`);

      const errors: string[] = [];
      if (succErr) errors.push(`webhook_succeeded: ${succErr.message}`);
      if (failErr) errors.push(`webhook_failed: ${failErr.message}`);
      if (otpErr) errors.push(`portal_otp: ${otpErr.message}`);

      const result = {
        ok: errors.length === 0,
        ran_at: now.toISOString(),
        deleted: {
          webhook_deliveries_succeeded: succeededDeleted || 0,
          webhook_deliveries_failed: failedDeleted || 0,
          portal_otp_codes: otpDeleted || 0,
        },
        retention: {
          webhook_succeeded_days: WEBHOOK_SUCCEEDED_RETENTION_DAYS,
          webhook_failed_days: WEBHOOK_FAILED_RETENTION_DAYS,
          otp_code_grace_days: OTP_CODE_GRACE_DAYS,
        },
        errors,
      };

      if (errors.length > 0) {
        Sentry.captureMessage("cleanup-old-rows had errors", {
          level: "warning",
          tags: { cron: "cleanup-old-rows" },
          extra: result,
        });
      } else {
        Sentry.addBreadcrumb({
          category: "cron",
          level: "info",
          message: `cleanup-old-rows OK: w_succ=${result.deleted.webhook_deliveries_succeeded} w_fail=${result.deleted.webhook_deliveries_failed} otp=${result.deleted.portal_otp_codes}`,
        });
      }

      return NextResponse.json(result);
    },
    {
      schedule: { type: "crontab", value: "0 5 * * *" },
      checkinMargin: 10,
      maxRuntime: 60,
      timezone: "UTC",
    },
  );
}
