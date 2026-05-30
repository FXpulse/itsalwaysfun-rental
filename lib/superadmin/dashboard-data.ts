// Server-side data fetchers for /superadmin/dashboard.
// Each fn returns null/zero on error so the page always renders.

import { createAdminClient } from "@/lib/supabase/admin";

export interface DashboardData {
  mrr: { current_cents: number; monthly: number; annual: number; trial: number };
  tenants: {
    total: number;
    active: number;
    trialing: number;
    past_due: number;
    canceling: number;
    suspended: number;
    new_this_week: number;
    new_this_month: number;
  };
  signups_sparkline: number[];                // last 30 days cumulative
  recent_signups: Array<{
    id: string;
    business_name: string;
    plan: string;
    created_at: string;
    subscription_status: string | null;
  }>;
  recent_activity: Array<{
    when: string;
    action: string;
    detail: string;
  }>;
  health: {
    failed_payments: number;
    expired_trials_unpaid: number;
    inactive_30d: number;
    db_response_ms: number;
  };
  outbound: {
    leads_total: number;
    leads_this_week: number;
    threads_with_replies: number;
  };
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const supabase = createAdminClient({ unscoped: true });
  const t0 = Date.now();

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400_000);
  const monthAgo = new Date(now.getTime() - 30 * 86400_000);

  const [
    tenantsResult,
    auditResult,
    leadsResult,
    leadsRecentResult,
    emailRepliesResult,
  ] = await Promise.all([
    supabase.from("tenants").select(
      "id, business_name, plan, subscription_status, trial_ends_at, current_period_end, cancel_at_period_end, suspended_at, created_at",
    ),
    supabase
      .from("audit_log")
      .select("created_at, action, details, user_email")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase.from("lead_magnet_signups").select("id, created_at"),
    supabase
      .from("lead_magnet_signups")
      .select("id")
      .gte("created_at", weekAgo.toISOString()),
    supabase
      .from("email_messages")
      .select("id")
      .eq("direction", "incoming"),
  ]);

  const db_response_ms = Date.now() - t0;

  const tenants = (tenantsResult.data as any[]) || [];

  // Categorize tenants
  let active = 0, trialing = 0, past_due = 0, canceling = 0, suspended = 0;
  let monthlyMrr = 0, annualMrr = 0, trialMrr = 0;
  let failed_payments = 0, expired_trials_unpaid = 0;

  for (const t of tenants) {
    if (t.suspended_at) { suspended++; continue; }
    if (t.subscription_status === "active") {
      active++;
      // Assume monthly $99 unless we can detect annual via current_period_end vs created_at
      // (Annual subs have ~365d period; monthly have ~30d)
      const createdMs = new Date(t.created_at).getTime();
      const periodEndMs = t.current_period_end ? new Date(t.current_period_end).getTime() : 0;
      const periodDays = periodEndMs > 0 ? (periodEndMs - createdMs) / 86400_000 : 30;
      if (periodDays > 100) {
        annualMrr += 990_00 / 12;  // $990/yr → $82.50/mo equivalent
      } else {
        monthlyMrr += 99_00;
      }
    } else if (t.subscription_status === "trialing") {
      trialing++;
      trialMrr += 99_00;
    } else if (t.subscription_status === "past_due") {
      past_due++;
      failed_payments++;
    }
    if (t.cancel_at_period_end) canceling++;
    if (t.trial_ends_at && new Date(t.trial_ends_at) < now && !["active", "past_due"].includes(t.subscription_status || "")) {
      expired_trials_unpaid++;
    }
  }

  // New tenants growth
  const new_this_week = tenants.filter((t) => new Date(t.created_at) >= weekAgo).length;
  const new_this_month = tenants.filter((t) => new Date(t.created_at) >= monthAgo).length;

  // 30-day signup sparkline (cumulative tenants by day)
  const signups_sparkline: number[] = [];
  for (let i = 29; i >= 0; i--) {
    const cutoff = new Date(now.getTime() - i * 86400_000);
    signups_sparkline.push(tenants.filter((t) => new Date(t.created_at) <= cutoff).length);
  }

  // Recent signups (last 5)
  const recent_signups = [...tenants]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)
    .map((t) => ({
      id: t.id, business_name: t.business_name || "(unnamed)",
      plan: t.plan || "starter",
      created_at: t.created_at,
      subscription_status: t.subscription_status,
    }));

  // Recent activity from audit log (best-effort, audit_log may not exist on all tenants)
  const recent_activity = ((auditResult.data as any[]) || []).slice(0, 10).map((a) => ({
    when: a.created_at,
    action: a.action || "(unknown)",
    detail: typeof a.details === "object" ? JSON.stringify(a.details).slice(0, 80) : String(a.details || a.user_email || ""),
  }));

  // Inactive: tenants whose last_active (we'll proxy via created_at + plan check) is > 30d
  // Real implementation would need a last_login or last_admin_activity column.
  // For now: trialing past trial_ends_at + no upgrade = inactive risk.
  const inactive_30d = expired_trials_unpaid;

  // Lead magnet signups (outbound funnel signal)
  const leads_total = (leadsResult.data as any[])?.length || 0;
  const leads_this_week = (leadsRecentResult.data as any[])?.length || 0;
  const threads_with_replies = (emailRepliesResult.data as any[])?.length || 0;

  return {
    mrr: {
      current_cents: monthlyMrr + annualMrr,
      monthly: monthlyMrr / 100,
      annual: annualMrr / 100,
      trial: trialMrr / 100,
    },
    tenants: {
      total: tenants.length,
      active, trialing, past_due, canceling, suspended,
      new_this_week, new_this_month,
    },
    signups_sparkline,
    recent_signups,
    recent_activity,
    health: {
      failed_payments,
      expired_trials_unpaid,
      inactive_30d,
      db_response_ms,
    },
    outbound: { leads_total, leads_this_week, threads_with_replies },
  };
}
