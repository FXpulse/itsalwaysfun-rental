// Tenant-side goal tracking. Mirrors lib/superadmin/goals.ts but the
// metrics are business-level (bookings, revenue, customers).

import { createAdminClient } from "@/lib/supabase/admin";

export type TenantGoalMetric = "bookings_30d" | "revenue_30d" | "customers_30d" | "repeat_rate";

export interface TenantGoal {
  id: string;
  tenant_id: string;
  metric: TenantGoalMetric;
  target: number;
  target_date: string;
  label: string | null;
  is_active: boolean;
  achieved_at: string | null;
  created_at: string;
}

export interface TenantGoalProgress extends TenantGoal {
  current_value: number;
  pct_complete: number;
  days_remaining: number;
  projected_hit_date: string | null;
  projected_status: "ahead" | "on_track" | "behind" | "achieved" | "missed";
}

export async function fetchTenantGoals(tenantId: string): Promise<TenantGoalProgress[]> {
  const supabase = createAdminClient({ unscoped: true });
  const { data: goals } = await supabase
    .from("tenant_goals")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("target_date");
  if (!goals || goals.length === 0) return [];

  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [
    { count: bookings30 },
    { data: revenueRow },
    { count: customers30 },
    { data: repeatRow },
  ] = await Promise.all([
    supabase.from("bookings").select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId).gte("created_at", monthAgo).neq("booking_status", "cancelled"),
    supabase.from("bookings").select("total_amount.sum()")
      .eq("tenant_id", tenantId).eq("stripe_payment_status", "paid").gte("created_at", monthAgo).single(),
    supabase.from("customer_profiles").select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId).gte("created_at", monthAgo),
    supabase.from("customer_profiles").select("total_bookings")
      .eq("tenant_id", tenantId),
  ]);

  const profiles = (repeatRow as any[]) || [];
  const repeats = profiles.filter((p) => (p.total_bookings || 0) >= 2).length;
  const repeatRate = profiles.length > 0 ? Math.round((repeats / profiles.length) * 100) : 0;

  const metricValues: Record<TenantGoalMetric, number> = {
    bookings_30d: bookings30 || 0,
    revenue_30d: ((revenueRow as any)?.sum || 0) / 100,
    customers_30d: customers30 || 0,
    repeat_rate: repeatRate,
  };

  return (goals as TenantGoal[]).map((g) => {
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

    let projected_status: TenantGoalProgress["projected_status"];
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
      projected_hit_date,
      projected_status,
    };
  });
}

export function formatTenantGoalLabel(g: TenantGoal | TenantGoalProgress): string {
  if (g.label) return g.label;
  const targetStr =
    g.metric === "revenue_30d" ? `$${Number(g.target).toLocaleString()} revenue / 30d` :
    g.metric === "bookings_30d" ? `${g.target} bookings / 30d` :
    g.metric === "customers_30d" ? `${g.target} new customers / 30d` :
    `${g.target}% repeat customers`;
  return `${targetStr} by ${new Date(g.target_date).toLocaleDateString()}`;
}
