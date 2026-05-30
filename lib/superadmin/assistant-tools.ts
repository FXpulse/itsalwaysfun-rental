// Tools the AI Operator Assistant can call. All read-only for now —
// action tools (suspend, refund, send) get added in a follow-up with
// confirmation UI.

import { createAdminClient } from "@/lib/supabase/admin";

export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "list_past_due_tenants",
      description: "List all tenants whose subscription is past_due, sorted by how many days they've been late.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_tenant",
      description: "Look up a tenant by business name or slug. Returns plan, status, MRR contribution, signup date, last activity.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Business name or slug to search for (case-insensitive partial match)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_open_tickets",
      description: "List open support tickets, optionally filtered by priority.",
      parameters: {
        type: "object",
        properties: {
          priority: { type: "string", enum: ["urgent", "high", "normal", "low"], description: "Only return tickets at this priority" },
          limit: { type: "number", description: "Max tickets to return (default 20)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_recent_signups",
      description: "Get tenants that signed up in the last N days.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Look-back window in days (default 7)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_kb",
      description: "Search the knowledge base for articles matching a query. Returns slug + title of top matches.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search terms" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_revenue_summary",
      description: "Get current MRR, 30-day growth %, plan breakdown, and churn waterfall for the last 30 days.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

export async function executeTool(
  name: string,
  args: Record<string, any>,
): Promise<string> {
  const supabase = createAdminClient({ unscoped: true });

  switch (name) {
    case "list_past_due_tenants": {
      const { data } = await supabase
        .from("tenants")
        .select("business_name, owner_email, current_period_end, dunning_emails_sent")
        .eq("subscription_status", "past_due")
        .order("current_period_end", { ascending: true });
      const rows = ((data as any[]) || []).map((t) => {
        const cpe = t.current_period_end ? new Date(t.current_period_end) : null;
        const days = cpe ? Math.max(0, Math.floor((Date.now() - cpe.getTime()) / 86_400_000)) : null;
        const emailsSent = Array.isArray(t.dunning_emails_sent) ? t.dunning_emails_sent.length : 0;
        return { business_name: t.business_name, owner_email: t.owner_email, days_past_due: days, dunning_emails_sent: emailsSent };
      });
      return JSON.stringify({ count: rows.length, tenants: rows });
    }

    case "get_tenant": {
      const q = (args.query || "").toString().trim();
      if (!q) return JSON.stringify({ error: "query required" });
      const { data } = await supabase
        .from("tenants")
        .select("id, slug, business_name, owner_email, plan, subscription_status, suspended_at, created_at, current_period_end, custom_domain")
        .or(`business_name.ilike.%${q}%,slug.ilike.%${q}%`)
        .limit(5);
      return JSON.stringify({ matches: data || [] });
    }

    case "list_open_tickets": {
      const limit = args.limit || 20;
      let query = supabase
        .from("support_tickets")
        .select("id, subject, ai_priority, ai_category, status, created_at, tenant_id")
        .neq("status", "resolved")
        .neq("status", "closed")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (args.priority) query = query.eq("ai_priority", args.priority);
      const { data } = await query;
      return JSON.stringify({ count: data?.length || 0, tickets: data || [] });
    }

    case "get_recent_signups": {
      const days = args.days || 7;
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data } = await supabase
        .from("tenants")
        .select("business_name, owner_email, plan, subscription_status, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      return JSON.stringify({ window_days: days, count: data?.length || 0, signups: data || [] });
    }

    case "search_kb": {
      const q = (args.query || "").toString().trim();
      if (!q) return JSON.stringify({ error: "query required" });
      const { data } = await supabase
        .from("kb_articles")
        .select("slug, title, category, view_count")
        .eq("is_published", true)
        .or(`title.ilike.%${q}%,body_md.ilike.%${q}%`)
        .order("view_count", { ascending: false })
        .limit(8);
      return JSON.stringify({ matches: data || [] });
    }

    case "get_revenue_summary": {
      const { data: tenants } = await supabase
        .from("tenants")
        .select("plan, subscription_status, suspended_at, created_at");
      const list = (tenants as any[]) || [];
      const active = list.filter((t) => t.subscription_status === "active" && !t.suspended_at);
      const mrr = active.filter((t) => t.plan !== "founder").length * 99;
      const planBreakdown: Record<string, number> = {};
      for (const t of active) planBreakdown[t.plan || "starter"] = (planBreakdown[t.plan || "starter"] || 0) + 1;
      const monthAgo = new Date(Date.now() - 30 * 86_400_000);
      const newCount = list.filter((t) => new Date(t.created_at) >= monthAgo).length;
      const churned = list.filter((t) =>
        (t.suspended_at && new Date(t.suspended_at) >= monthAgo) ||
        t.subscription_status === "canceled"
      ).length;
      return JSON.stringify({
        mrr_usd: mrr,
        active_tenants: active.length,
        plans: planBreakdown,
        last_30d: { new_signups: newCount, churned },
      });
    }

    default:
      return JSON.stringify({ error: `unknown tool: ${name}` });
  }
}
