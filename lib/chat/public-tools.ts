// Tools the public AI chat can call. All scoped to the current tenant via
// the request's tenant context (createAdminClient inside a request is auto-scoped).
//
// Tools are READ-ONLY. The assistant can NEVER book, cancel, refund, or
// modify data — only inform + point customers to /order-by-date.

import { createAdminClient } from "@/lib/supabase/admin";

export const PUBLIC_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "list_products",
      description: "List active rental products in this business's catalog. Returns name, category, price per day, and a brief description.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Optional category to filter by" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_product_details",
      description: "Get full details on a single product (description, pricing, age group, dimensions, weekend rate).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Product name or slug (partial match)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "check_availability",
      description: "Check whether a product is available on a specific date. Returns available count.",
      parameters: {
        type: "object",
        properties: {
          product_query: { type: "string", description: "Product name (partial match)" },
          date: { type: "string", description: "ISO date YYYY-MM-DD" },
        },
        required: ["product_query", "date"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_business_info",
      description: "Get hours, phone, email, address, service area, and key policies.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_faqs",
      description: "Search published FAQs for a topic. Returns matching question/answer pairs.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Topic or keywords" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_policies",
      description: "Get cancellation, weather, payment, and setup policies.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

export async function executePublicTool(name: string, args: Record<string, any>): Promise<string> {
  // Auto-scoped to current tenant via the HTTP request context
  const supabase = createAdminClient();

  switch (name) {
    case "list_products": {
      let query = supabase
        .from("products")
        .select("name, slug, category, description, price_per_day, weekend_price_per_day, age_group, image_url")
        .eq("is_active", true)
        .eq("is_addon", false)
        .order("category")
        .order("name");
      if (args.category) query = query.ilike("category", `%${args.category}%`);
      const { data } = await query.limit(40);
      const items = ((data as any[]) || []).map((p) => ({
        name: p.name,
        slug: p.slug,
        category: p.category,
        price_per_day: p.price_per_day,
        weekend_price_per_day: p.weekend_price_per_day || null,
        age_group: p.age_group,
        page_url: `/items/${p.slug}`,
        description_excerpt: (p.description || "").slice(0, 200),
      }));
      return JSON.stringify({ count: items.length, products: items });
    }

    case "get_product_details": {
      const q = (args.query || "").toString().trim();
      if (!q) return JSON.stringify({ error: "query_required" });
      const { data } = await supabase
        .from("products")
        .select("name, slug, category, description, price_per_day, weekend_price_per_day, stock, age_group, setup_area, actual_size, outlets_required, image_url")
        .eq("is_active", true)
        .or(`name.ilike.%${q}%,slug.ilike.%${q}%`)
        .limit(5);
      const matches = (data as any[]) || [];
      return JSON.stringify({
        matches: matches.map((p) => ({
          name: p.name,
          category: p.category,
          description: p.description,
          price_per_day: p.price_per_day,
          weekend_price_per_day: p.weekend_price_per_day || null,
          age_group: p.age_group,
          setup_area: p.setup_area,
          actual_size: p.actual_size,
          outlets_required: p.outlets_required,
          in_stock: (p.stock || 0) > 0,
          page_url: `/items/${p.slug}`,
        })),
      });
    }

    case "check_availability": {
      const q = (args.product_query || "").toString().trim();
      const date = (args.date || "").toString();
      if (!q || !date) return JSON.stringify({ error: "product_query and date required" });
      const { data: prods } = await supabase
        .from("products").select("id, name, slug, stock")
        .eq("is_active", true)
        .or(`name.ilike.%${q}%,slug.ilike.%${q}%`)
        .limit(3);
      const list = (prods as any[]) || [];
      if (list.length === 0) return JSON.stringify({ error: "no_matching_product" });
      const results: any[] = [];
      for (const p of list) {
        const { count } = await supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("product_id", p.id)
          .eq("event_date", date)
          .neq("booking_status", "cancelled");
        const booked = count || 0;
        const available = Math.max(0, (p.stock || 1) - booked);
        results.push({
          product: p.name,
          slug: p.slug,
          page_url: `/items/${p.slug}`,
          stock: p.stock || 1,
          booked,
          available,
          sold_out: available === 0,
          book_now_url: `/order-by-date?product=${p.slug}&date=${date}`,
        });
      }
      return JSON.stringify({ date, results });
    }

    case "get_business_info": {
      const { data: settings } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", [
          "business_name", "business_phone", "business_email", "business_address",
          "service_area", "business_hours", "important_tips",
        ]);
      const map = new Map<string, string>(
        ((settings as any[]) || []).map((s) => [s.key, s.value || ""]),
      );
      return JSON.stringify({
        business_name: map.get("business_name") || "",
        phone: map.get("business_phone") || "",
        email: map.get("business_email") || "",
        address: map.get("business_address") || "",
        service_area: map.get("service_area") || "",
        hours: map.get("business_hours") || "",
        policies_excerpt: (map.get("important_tips") || "").slice(0, 800),
      });
    }

    case "search_faqs": {
      const q = (args.query || "").toString().trim();
      if (!q) return JSON.stringify({ error: "query_required" });
      const { data } = await supabase
        .from("faqs")
        .select("question, answer")
        .eq("is_active", true)
        .or(`question.ilike.%${q}%,answer.ilike.%${q}%`)
        .order("display_order")
        .limit(6);
      return JSON.stringify({ matches: data || [] });
    }

    case "get_policies": {
      const { data: settings } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", ["important_tips", "footer_description"]);
      const map = new Map<string, string>(
        ((settings as any[]) || []).map((s) => [s.key, s.value || ""]),
      );
      return JSON.stringify({
        policies: map.get("important_tips") || "",
        about: map.get("footer_description") || "",
      });
    }

    default:
      return JSON.stringify({ error: `unknown tool: ${name}` });
  }
}
