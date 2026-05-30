// Pre-fetches a snapshot of platform state to inject into the AI assistant's
// system prompt. This is what makes the assistant smart — it sees real numbers,
// not hallucinations.

import { createAdminClient } from "@/lib/supabase/admin";

export interface AssistantContext {
  tenants: {
    total: number;
    active: number;
    trialing: number;
    past_due: number;
    canceled: number;
    suspended: number;
  };
  mrr_cents: number;
  recent_signups: Array<{ business_name: string; created_at: string; status: string | null }>;
  open_tickets: Array<{ subject: string; priority: string | null; created_at: string }>;
  past_due_tenants: Array<{ business_name: string; days_past_due: number }>;
  recent_errors_24h: number;
}

export async function fetchAssistantContext(): Promise<AssistantContext> {
  const supabase = createAdminClient({ unscoped: true });
  const { data: tenants } = await supabase
    .from("tenants")
    .select("business_name, plan, subscription_status, suspended_at, created_at, current_period_end")
    .order("created_at", { ascending: false });
  const list = (tenants as any[]) || [];

  const counts = {
    total: list.length,
    active: list.filter((t) => t.subscription_status === "active").length,
    trialing: list.filter((t) => t.subscription_status === "trialing").length,
    past_due: list.filter((t) => t.subscription_status === "past_due").length,
    canceled: list.filter((t) => t.subscription_status === "canceled").length,
    suspended: list.filter((t) => t.suspended_at).length,
  };

  const mrr_cents = list
    .filter((t) => t.subscription_status === "active" && t.plan !== "founder")
    .length * 9900;

  const recent_signups = list.slice(0, 5).map((t) => ({
    business_name: t.business_name,
    created_at: t.created_at,
    status: t.subscription_status,
  }));

  const past_due_tenants = list
    .filter((t) => t.subscription_status === "past_due")
    .map((t) => {
      const cpe = t.current_period_end ? new Date(t.current_period_end) : new Date();
      const days = Math.floor((Date.now() - cpe.getTime()) / 86_400_000);
      return { business_name: t.business_name, days_past_due: Math.max(0, days) };
    });

  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("subject, ai_priority, created_at, status")
    .neq("status", "resolved")
    .neq("status", "closed")
    .order("created_at", { ascending: false })
    .limit(10);
  const open_tickets = ((tickets as any[]) || []).map((t) => ({
    subject: t.subject,
    priority: t.ai_priority,
    created_at: t.created_at,
  }));

  const errorSince = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { count: recent_errors_24h } = await supabase
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .gte("created_at", errorSince)
    .ilike("action", "%error%");

  return {
    tenants: counts,
    mrr_cents,
    recent_signups,
    open_tickets,
    past_due_tenants,
    recent_errors_24h: recent_errors_24h ?? 0,
  };
}
