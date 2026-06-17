// GET /api/cron/beta-lifecycle
//
// Daily check on all beta-program tenants. Sends the lifecycle email that
// matches days_since_beta_program_joined_at:
//
//   ≥ 30 days → day_30_checkin
//   ≥ 60 days → day_60_usage
//   ≥ 80 days → day_80_convert
//
// Idempotency via tenants.beta_emails_sent jsonb array. Each tenant gets
// each key at most once. Each row is rechecked against the array before
// the send, so duplicate cron runs are no-ops.
//
// Welcome email fires at signup time (app/signup/actions.ts), NOT here.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendBetaLifecycleEmail,
  type BetaEmailKey,
} from "@/lib/email/beta-lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface TierConfig {
  minDays: number;
  key: BetaEmailKey;
}

const TIERS: TierConfig[] = [
  { minDays: 80, key: "day_80_convert" },
  { minDays: 60, key: "day_60_usage" },
  { minDays: 30, key: "day_30_checkin" },
];

export async function GET() {
  const auth = headers().get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Sentry.withMonitor(
    "beta-lifecycle",
    async () => {
      const supabase = createAdminClient({ unscoped: true });

      const { data: betas, error } = await supabase
        .from("tenants")
        .select(
          "id, slug, business_name, owner_email, beta_program_joined_at, beta_emails_sent",
        )
        .eq("beta_program", true)
        .not("beta_program_joined_at", "is", null);

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 },
        );
      }

      const now = Date.now();
      const results: Array<Record<string, any>> = [];

      for (const t of (betas as any[]) || []) {
        const joinedAt = new Date(t.beta_program_joined_at).getTime();
        const days = Math.floor((now - joinedAt) / 86400000);
        const ledger: string[] = Array.isArray(t.beta_emails_sent)
          ? (t.beta_emails_sent as string[])
          : [];

        // Pick the highest tier the tenant qualifies for that hasn't been sent.
        // TIERS is ordered most-recent-trigger first (80 → 60 → 30) so we don't
        // re-send a day_30 to someone who already passed day_60 without it.
        const matchedTier = TIERS.find(
          (tier) => days >= tier.minDays && !ledger.includes(tier.key),
        );

        if (!matchedTier) {
          results.push({ tenant: t.business_name, days, action: "no_match" });
          continue;
        }

        try {
          const newLedger = await sendBetaLifecycleEmail(
            {
              id: t.id,
              business_name: t.business_name,
              owner_email: t.owner_email,
              slug: t.slug,
            },
            matchedTier.key,
            ledger,
          );
          if (newLedger) {
            await supabase
              .from("tenants")
              .update({ beta_emails_sent: newLedger })
              .eq("id", t.id);
            results.push({
              tenant: t.business_name,
              days,
              action: `sent_${matchedTier.key}`,
            });
          } else {
            results.push({
              tenant: t.business_name,
              days,
              action: `skipped_${matchedTier.key}`,
            });
          }
        } catch (e: any) {
          Sentry.captureException(e, {
            tags: { cron: "beta-lifecycle", tenant_id: t.id },
          });
          results.push({
            tenant: t.business_name,
            days,
            action: "error",
            error: String(e?.message || e),
          });
        }
      }

      return NextResponse.json({
        ok: true,
        ran_at: new Date().toISOString(),
        cohort: results.length,
        results,
      });
    },
    {
      schedule: { type: "crontab", value: "0 16 * * *" },
      checkinMargin: 10,
      maxRuntime: 60,
      timezone: "UTC",
    },
  );
}
