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
  {
    type: "function" as const,
    function: {
      name: "get_dispatch_today",
      description:
        "Today + tomorrow's routes and stops. Useful for 'who's delivering what', 'what's on the schedule', 'how busy are we today'.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_pending_payments",
      description:
        "Bookings stuck in pending_payment status. These are abandoned-cart / failed-checkout situations the owner may want to follow up.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max rows to return (default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_damage_summary",
      description:
        "Unresolved damage records across recent bookings. Useful for 'what damages do I owe' or 'which bookings have open damage'.",
      parameters: {
        type: "object",
        properties: {
          days_back: { type: "number", description: "Look-back window in days (default 60)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_low_stock_items",
      description:
        "Inventory items below their low-stock threshold. Useful for 'what do I need to buy / repair'.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_quote_pipeline",
      description:
        "Quotes that are sent, viewed, or about to expire. Useful for 'which quotes need a nudge'.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_payout_requests",
      description:
        "Loyalty/referrer payout requests by status (pending/approved/rejected/processed). Useful for 'who's waiting on a payout'.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            description: "Filter — one of: pending, approved, rejected, processed. Default: pending.",
          },
        },
        required: [],
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

    case "get_dispatch_today": {
      const today = new Date().toISOString().slice(0, 10);
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      const { data: routes } = await supabase
        .from("dispatch_routes")
        .select(`
          id, route_date, route_type, status, driver_name, notes,
          vehicles ( name ),
          trailers ( name ),
          dispatch_stops ( id, stop_order, delivered_at, bookings ( customer_first_name, customer_last_name, product_name, customer_address, start_time, end_time ) )
        `)
        .eq("tenant_id", tenantId)
        .in("route_date", [today, tomorrow])
        .order("route_date")
        .order("status");
      const list = (routes as any[]) || [];
      const summary = list.map((r) => {
        const stops = (r.dispatch_stops || []) as any[];
        const total = stops.length;
        const done = stops.filter((s) => s.delivered_at).length;
        return {
          route_id: r.id,
          date: r.route_date,
          type: r.route_type,
          status: r.status,
          driver: r.driver_name || null,
          vehicle: r.vehicles?.name || null,
          trailer: r.trailers?.name || null,
          stop_count: total,
          completed: done,
          stops: stops
            .sort((a: any, b: any) => a.stop_order - b.stop_order)
            .map((s: any) => ({
              customer:
                `${s.bookings?.customer_first_name || ""} ${s.bookings?.customer_last_name || ""}`.trim(),
              product: s.bookings?.product_name || null,
              address: s.bookings?.customer_address || null,
              window:
                s.bookings?.start_time && s.bookings?.end_time
                  ? `${s.bookings.start_time.slice(0, 5)}-${s.bookings.end_time.slice(0, 5)}`
                  : null,
              delivered: !!s.delivered_at,
            })),
        };
      });
      return JSON.stringify({ today, tomorrow, route_count: list.length, routes: summary });
    }

    case "get_pending_payments": {
      const limit = args.limit || 10;
      const { data } = await supabase
        .from("bookings")
        .select(
          "id, customer_first_name, customer_last_name, customer_email, customer_phone, product_name, total_amount, event_date, created_at, hold_expires_at",
        )
        .eq("tenant_id", tenantId)
        .eq("booking_status", "pending_payment")
        .order("created_at", { ascending: false })
        .limit(limit);
      return JSON.stringify({
        count: (data || []).length,
        bookings: (data || []).map((b: any) => ({
          id: b.id,
          customer:
            `${b.customer_first_name || ""} ${b.customer_last_name || ""}`.trim(),
          email: b.customer_email,
          phone: b.customer_phone,
          product: b.product_name,
          total_dollars: (b.total_amount || 0) / 100,
          event_date: b.event_date,
          created_at: b.created_at,
          hold_expires_at: b.hold_expires_at,
        })),
      });
    }

    case "get_damage_summary": {
      const days = args.days_back || 60;
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data: damages } = await supabase
        .from("booking_damages")
        .select(
          "id, severity, description, covered_by_protection, charged_amount, resolved, created_at, booking_id, bookings ( customer_first_name, customer_last_name, product_name, event_date, tenant_id )",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50);
      // Filter to this tenant (booking_damages has no tenant_id of its own)
      const filtered = (damages as any[] || []).filter(
        (d) => d.bookings?.tenant_id === tenantId,
      );
      const open = filtered.filter((d) => !d.resolved);
      return JSON.stringify({
        window_days: days,
        total: filtered.length,
        open_count: open.length,
        damages: filtered.slice(0, 15).map((d) => ({
          id: d.id,
          severity: d.severity,
          covered_by_protection: d.covered_by_protection,
          charged_dollars: (d.charged_amount || 0) / 100,
          resolved: d.resolved,
          customer:
            `${d.bookings?.customer_first_name || ""} ${d.bookings?.customer_last_name || ""}`.trim(),
          product: d.bookings?.product_name,
          event_date: d.bookings?.event_date,
          description: (d.description || "").slice(0, 120),
        })),
      });
    }

    case "get_low_stock_items": {
      const { data } = await supabase
        .from("inventory_items")
        .select(
          "id, name, category, quantity_owned, quantity_in_use, low_stock_threshold, condition, last_maintenance_date",
        )
        .eq("tenant_id", tenantId)
        .not("low_stock_threshold", "is", null);
      const items = (data as any[]) || [];
      const low = items.filter((i) => {
        const available = (i.quantity_owned || 0) - (i.quantity_in_use || 0);
        return available <= (i.low_stock_threshold || 0);
      });
      return JSON.stringify({
        checked: items.length,
        low_stock_count: low.length,
        items: low.map((i) => ({
          name: i.name,
          category: i.category,
          quantity_owned: i.quantity_owned,
          quantity_in_use: i.quantity_in_use,
          available: (i.quantity_owned || 0) - (i.quantity_in_use || 0),
          threshold: i.low_stock_threshold,
          condition: i.condition,
        })),
      });
    }

    case "get_quote_pipeline": {
      const soon = new Date(Date.now() + 6 * 3600_000).toISOString();
      const { data } = await supabase
        .from("quotes")
        .select(
          "id, quote_number, customer_first_name, customer_last_name, customer_email, total_cents, status, sent_at, expires_at, event_date",
        )
        .eq("tenant_id", tenantId)
        .in("status", ["sent", "viewed"])
        .order("expires_at", { ascending: true })
        .limit(25);
      const list = (data as any[]) || [];
      const expiring_soon = list.filter(
        (q) => q.expires_at && q.expires_at <= soon,
      );
      return JSON.stringify({
        open_count: list.length,
        expiring_within_6h: expiring_soon.length,
        quotes: list.slice(0, 15).map((q) => ({
          quote_number: q.quote_number,
          customer:
            `${q.customer_first_name || ""} ${q.customer_last_name || ""}`.trim(),
          email: q.customer_email,
          total_dollars: (q.total_cents || 0) / 100,
          status: q.status,
          sent_at: q.sent_at,
          expires_at: q.expires_at,
          event_date: q.event_date,
        })),
      });
    }

    case "get_payout_requests": {
      const status = (args.status || "pending").toString();
      const { data } = await supabase
        .from("payout_requests")
        .select(
          "id, user_id, amount_cents, payout_type, status, requested_at, approved_at, processed_at, rejected_reason",
        )
        .eq("tenant_id", tenantId)
        .eq("status", status)
        .order("requested_at", { ascending: false })
        .limit(20);
      const list = (data as any[]) || [];
      const total_cents = list.reduce(
        (s, r) => s + (r.amount_cents || 0),
        0,
      );
      return JSON.stringify({
        status,
        count: list.length,
        total_dollars: total_cents / 100,
        requests: list.map((r) => ({
          id: r.id,
          user_id: r.user_id,
          amount_dollars: (r.amount_cents || 0) / 100,
          payout_type: r.payout_type,
          requested_at: r.requested_at,
          approved_at: r.approved_at,
          processed_at: r.processed_at,
          rejected_reason: r.rejected_reason,
        })),
      });
    }

    default:
      return JSON.stringify({ error: `unknown tool: ${name}` });
  }
}
