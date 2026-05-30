// Tenant-scoped AI assistant tools. Tenant owners can ask their own data,
// NEVER cross-tenant. Each tool reads from the scoped admin client which
// auto-filters by tenant_id.

import { createAdminClient } from "@/lib/supabase/admin";

export const TENANT_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "get_revenue_summary",
      description: "Revenue overview for this tenant — total bookings, paid revenue, last 30d, YTD.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_bookings_for_date_range",
      description: "List bookings between two dates (inclusive). Use this for ANY range of more than 1 day — do NOT call this once per day. For a single day, set start_date == end_date.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "ISO date YYYY-MM-DD (inclusive)" },
          end_date: { type: "string", description: "ISO date YYYY-MM-DD (inclusive). If omitted, returns just that single day." },
        },
        required: ["start_date"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_busiest_days",
      description: "Find the busiest days (by booking count) in a given window.",
      parameters: {
        type: "object",
        properties: {
          days_back: { type: "number", description: "Look-back in days (default 90)" },
          limit: { type: "number", description: "Top N results (default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_top_products",
      description: "Most-booked products in last 90 days.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_customer_count",
      description: "Total unique customers + new this month.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_kb",
      description: "Search the help knowledge base for an article.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
        },
        required: ["query"],
      },
    },
  },
];

export async function executeTenantTool(
  name: string,
  args: Record<string, any>,
  tenantId: string,
): Promise<string> {
  // Use unscoped client + manual tenant filter for safety
  const supabase = createAdminClient({ unscoped: true });

  switch (name) {
    case "get_revenue_summary": {
      const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
      const [
        { count: totalBookings },
        { data: paidSum },
        { data: paidThisMonth },
        { data: paidYtd },
      ] = await Promise.all([
        supabase.from("bookings").select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId),
        supabase.from("bookings").select("total_amount.sum()")
          .eq("tenant_id", tenantId).eq("stripe_payment_status", "paid").neq("booking_status", "cancelled").single(),
        supabase.from("bookings").select("total_amount.sum()")
          .eq("tenant_id", tenantId).eq("stripe_payment_status", "paid").gte("created_at", monthAgo).single(),
        supabase.from("bookings").select("total_amount.sum()")
          .eq("tenant_id", tenantId).eq("stripe_payment_status", "paid").gte("created_at", yearStart).single(),
      ]);
      return JSON.stringify({
        total_bookings: totalBookings || 0,
        lifetime_revenue_dollars: ((paidSum as any)?.sum || 0) / 100,
        last_30d_revenue_dollars: ((paidThisMonth as any)?.sum || 0) / 100,
        ytd_revenue_dollars: ((paidYtd as any)?.sum || 0) / 100,
      });
    }

    case "get_bookings_for_date_range": {
      const start = (args.start_date || "").toString();
      const end = (args.end_date || args.start_date || "").toString();
      if (!start) return JSON.stringify({ error: "start_date required" });
      const { data } = await supabase
        .from("bookings")
        .select("id, customer_first_name, customer_last_name, product_name, total_amount, booking_status, event_date, delivery_time, pickup_time, address")
        .eq("tenant_id", tenantId)
        .gte("event_date", start)
        .lte("event_date", end)
        .order("event_date")
        .order("delivery_time", { nullsFirst: false })
        .limit(200);
      const list = (data as any[]) || [];
      // Compress: if many, return summary by day instead of full rows
      if (list.length > 50) {
        const byDay = new Map<string, number>();
        for (const b of list) byDay.set(b.event_date, (byDay.get(b.event_date) || 0) + 1);
        return JSON.stringify({
          range: { start, end },
          total_count: list.length,
          summary: "too many to list — showing count per day",
          by_day: Array.from(byDay.entries()).map(([date, count]) => ({ date, count })),
        });
      }
      return JSON.stringify({ range: { start, end }, count: list.length, bookings: list });
    }

    // Backwards-compat alias so the model doesn't fail if it still tries the old name
    case "get_bookings_for_date": {
      const date = (args.date || "").toString();
      return executeTenantTool("get_bookings_for_date_range", { start_date: date, end_date: date }, tenantId);
    }

    case "get_busiest_days": {
      const days = args.days_back || 90;
      const limit = args.limit || 10;
      const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("bookings")
        .select("event_date")
        .eq("tenant_id", tenantId)
        .gte("event_date", since)
        .neq("booking_status", "cancelled");
      const counts = new Map<string, number>();
      for (const r of (data as any[]) || []) {
        counts.set(r.event_date, (counts.get(r.event_date) || 0) + 1);
      }
      const sorted = Array.from(counts.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([date, count]) => ({ date, count }));
      return JSON.stringify({ window_days: days, busiest: sorted });
    }

    case "get_top_products": {
      const limit = args.limit || 5;
      const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
      const { data } = await supabase
        .from("bookings")
        .select("product_name, product_id")
        .eq("tenant_id", tenantId)
        .gte("created_at", since)
        .neq("booking_status", "cancelled");
      const counts = new Map<string, number>();
      for (const r of (data as any[]) || []) {
        if (!r.product_name) continue;
        counts.set(r.product_name, (counts.get(r.product_name) || 0) + 1);
      }
      const sorted = Array.from(counts.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([product, count]) => ({ product, count }));
      return JSON.stringify({ window: "90d", top: sorted });
    }

    case "get_customer_count": {
      const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const [{ count: totalCustomers }, { count: newThisMonth }] = await Promise.all([
        supabase.from("customer_profiles").select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId),
        supabase.from("customer_profiles").select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId).gte("created_at", monthAgo),
      ]);
      return JSON.stringify({
        total_customers: totalCustomers || 0,
        new_last_30d: newThisMonth || 0,
      });
    }

    case "search_kb": {
      const q = (args.query || "").toString().trim();
      if (!q) return JSON.stringify({ error: "query required" });
      const { data } = await supabase
        .from("kb_articles")
        .select("slug, title, category")
        .eq("is_published", true)
        .or(`title.ilike.%${q}%,body_md.ilike.%${q}%`)
        .limit(8);
      return JSON.stringify({ matches: data || [] });
    }

    default:
      return JSON.stringify({ error: `unknown tool: ${name}` });
  }
}
