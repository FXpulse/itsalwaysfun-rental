// Revenue analytics for /superadmin/revenue.

import { createAdminClient } from "@/lib/supabase/admin";

export interface RevenueData {
  mrr_90d_series: number[];        // last 90 days, MRR in cents
  mrr_now_cents: number;
  mrr_30d_ago_cents: number;
  mrr_growth_pct: number;
  cohort_table: Array<{
    cohort_month: string;            // YYYY-MM
    signed_up: number;
    still_active: number;
    retention_pct: number;
  }>;
  churn_waterfall: {
    start_count: number;
    new: number;
    upgrades: number;
    downgrades: number;
    churned: number;
    end_count: number;
  };
  plan_distribution: Array<{ plan: string; count: number; pct: number }>;
}

export async function fetchRevenueData(): Promise<RevenueData> {
  const supabase = createAdminClient({ unscoped: true });
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, plan, subscription_status, created_at, suspended_at, cancel_at_period_end");

  const list = (tenants as any[]) || [];

  // 90-day MRR series — count paying tenants as of each day, × $99
  const mrr_90d_series: number[] = [];
  for (let i = 89; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000);
    const payingOnDay = list.filter((t) => {
      const created = new Date(t.created_at);
      return created <= day &&
        (t.subscription_status === "active") &&
        !t.suspended_at;
    }).length;
    mrr_90d_series.push(payingOnDay * 9900);
  }

  const mrr_now_cents = mrr_90d_series[mrr_90d_series.length - 1] ?? 0;
  const mrr_30d_ago_cents = mrr_90d_series[Math.max(0, mrr_90d_series.length - 31)] ?? 0;
  const mrr_growth_pct = mrr_30d_ago_cents > 0
    ? Math.round(((mrr_now_cents - mrr_30d_ago_cents) / mrr_30d_ago_cents) * 100)
    : (mrr_now_cents > 0 ? 100 : 0);

  // Cohort table — group by signup month, track retention
  const cohorts = new Map<string, { signed: any[]; }>();
  for (const t of list) {
    const m = t.created_at.slice(0, 7);  // YYYY-MM
    if (!cohorts.has(m)) cohorts.set(m, { signed: [] });
    cohorts.get(m)!.signed.push(t);
  }
  const cohort_table = Array.from(cohorts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)  // last 12 months
    .map(([month, info]) => {
      const stillActive = info.signed.filter(
        (t) => t.subscription_status === "active" && !t.suspended_at && !t.cancel_at_period_end,
      ).length;
      return {
        cohort_month: month,
        signed_up: info.signed.length,
        still_active: stillActive,
        retention_pct: info.signed.length > 0
          ? Math.round((stillActive / info.signed.length) * 100)
          : 0,
      };
    });

  // Churn waterfall (last 30 days)
  const monthAgo = new Date(Date.now() - 30 * 86_400_000);
  const start_count = list.filter((t) => {
    const created = new Date(t.created_at);
    return created < monthAgo;
  }).length;
  const newSignups = list.filter((t) => new Date(t.created_at) >= monthAgo).length;
  const churned = list.filter(
    (t) =>
      (t.suspended_at && new Date(t.suspended_at) >= monthAgo) ||
      (t.subscription_status === "canceled"),
  ).length;
  const upgrades = 0; // not tracked yet
  const downgrades = 0;
  const end_count = list.filter(
    (t) => t.subscription_status === "active" && !t.suspended_at,
  ).length;

  // Plan distribution
  const planMap = new Map<string, number>();
  for (const t of list) {
    if (t.subscription_status === "active" || t.plan === "founder") {
      const p = t.plan || "starter";
      planMap.set(p, (planMap.get(p) || 0) + 1);
    }
  }
  const totalActive = Array.from(planMap.values()).reduce((s, v) => s + v, 0);
  const plan_distribution = Array.from(planMap.entries()).map(([plan, count]) => ({
    plan,
    count,
    pct: totalActive > 0 ? Math.round((count / totalActive) * 100) : 0,
  })).sort((a, b) => b.count - a.count);

  return {
    mrr_90d_series,
    mrr_now_cents,
    mrr_30d_ago_cents,
    mrr_growth_pct,
    cohort_table,
    churn_waterfall: { start_count, new: newSignups, upgrades, downgrades, churned, end_count },
    plan_distribution,
  };
}
