// Goal tracking — Ludmila sets targets, dashboard shows live progress.

import { createAdminClient } from "@/lib/supabase/admin";

export type GoalMetric = "mrr" | "active_tenants" | "paying_tenants" | "signups_30d";

export interface Goal {
  id: string;
  metric: GoalMetric;
  target: number;
  target_date: string;
  label: string | null;
  is_active: boolean;
  achieved_at: string | null;
  created_at: string;
}

export interface GoalProgress extends Goal {
  current_value: number;
  pct_complete: number;             // 0-100
  days_remaining: number;
  on_track: boolean;
  projected_hit_date: string | null;
  projected_status: "ahead" | "on_track" | "behind" | "achieved" | "missed";
}

export async function fetchActiveGoals(): Promise<GoalProgress[]> {
  const supabase = createAdminClient({ unscoped: true });
  const { data: goals } = await supabase
    .from("superadmin_goals")
    .select("*")
    .eq("is_active", true)
    .order("target_date");
  if (!goals || goals.length === 0) return [];

  // Compute current values once
  const [{ data: tenants }] = await Promise.all([
    supabase.from("tenants")
      .select("plan, subscription_status, suspended_at, created_at"),
  ]);
  const list = (tenants as any[]) || [];
  const paying = list.filter((t) => t.subscription_status === "active" && t.plan !== "founder" && !t.suspended_at);
  const active = list.filter((t) => t.subscription_status === "active" && !t.suspended_at);
  const monthAgo = Date.now() - 30 * 86_400_000;
  const recent = list.filter((t) => new Date(t.created_at).getTime() >= monthAgo);
  const metricValues: Record<GoalMetric, number> = {
    mrr: paying.length * 99,
    active_tenants: active.length,
    paying_tenants: paying.length,
    signups_30d: recent.length,
  };

  return (goals as Goal[]).map((g) => {
    const current = metricValues[g.metric] ?? 0;
    const pct = g.target > 0 ? Math.min(100, Math.round((current / g.target) * 100)) : 0;
    const targetDate = new Date(g.target_date);
    const daysRemaining = Math.ceil((targetDate.getTime() - Date.now()) / 86_400_000);
    const createdAt = new Date(g.created_at);
    const daysSinceCreated = Math.max(1, (Date.now() - createdAt.getTime()) / 86_400_000);
    const ratePerDay = current / daysSinceCreated;
    const projected_hit_date = ratePerDay > 0
      ? new Date(Date.now() + ((g.target - current) / ratePerDay) * 86_400_000).toISOString()
      : null;
    const onTrack = projected_hit_date
      ? new Date(projected_hit_date).getTime() <= targetDate.getTime()
      : current >= g.target;

    let projected_status: GoalProgress["projected_status"];
    if (current >= g.target) projected_status = "achieved";
    else if (daysRemaining < 0) projected_status = "missed";
    else if (!projected_hit_date) projected_status = "behind";
    else {
      const projDays = Math.ceil((new Date(projected_hit_date).getTime() - Date.now()) / 86_400_000);
      const aheadBy = daysRemaining - projDays;
      if (aheadBy > 7) projected_status = "ahead";
      else if (aheadBy >= 0) projected_status = "on_track";
      else projected_status = "behind";
    }

    return {
      ...g,
      current_value: current,
      pct_complete: pct,
      days_remaining: daysRemaining,
      on_track: onTrack,
      projected_hit_date,
      projected_status,
    };
  });
}

export function formatGoalLabel(g: Goal | GoalProgress): string {
  if (g.label) return g.label;
  const targetStr = g.metric === "mrr" ? `$${Number(g.target).toLocaleString()}/mo MRR` :
                    g.metric === "active_tenants" ? `${g.target} active tenants` :
                    g.metric === "paying_tenants" ? `${g.target} paying tenants` :
                    `${g.target} signups/30d`;
  return `${targetStr} by ${new Date(g.target_date).toLocaleDateString()}`;
}
