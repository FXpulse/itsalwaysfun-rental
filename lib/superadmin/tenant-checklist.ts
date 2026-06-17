// Tenant checklist definitions + auto-detection logic.
//
// Each item belongs to a category. Items with `autoDetect` run a DB check
// on load; their `is_completed` status is overridden by the result.
// Items without `autoDetect` are manual — operator clicks to toggle.
//
// To add a new item: append to CHECKLIST_ITEMS. To change auto-detection
// behavior: edit the autoDetect function for that key.

import { createAdminClient } from "@/lib/supabase/admin";

export type ChecklistCategory =
  | "account"
  | "catalog"
  | "inventory"
  | "fleet"
  | "payments"
  | "public_site"
  | "team"
  | "communication"
  | "legal"
  | "operations"
  | "marketing"
  | "operator_intel";

export interface ChecklistItem {
  key: string;
  category: ChecklistCategory;
  label: string;
  description: string;
  /** Returns true if the item is satisfied based on current DB state. */
  autoDetect?: (tenantId: string) => Promise<boolean>;
  /** True if this is the operator's responsibility (not auto-detectable). */
  manualOnly?: boolean;
  /** True if this item is required for "100% ready" status. */
  required?: boolean;
}

export const CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  account: "🆔 Account Setup",
  catalog: "📦 Product Catalog",
  inventory: "🔧 Operational Inventory",
  fleet: "🚚 Fleet (Vehicles + Trailers)",
  payments: "💳 Payments",
  public_site: "🌐 Public Site",
  team: "👥 Team",
  communication: "📧 Communication",
  legal: "⚖️ Legal & Compliance",
  operations: "⚙️ Operations",
  marketing: "📣 Marketing & Growth",
  operator_intel: "🕵️ Operator Intel (manual)",
};

// ─── Auto-detect helpers ──────────────────────────────────────────────

async function countRows(tenantId: string, table: string, filters: Record<string, any> = {}): Promise<number> {
  const supabase = createAdminClient({ unscoped: true });
  let q = supabase.from(table).select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
  for (const [k, v] of Object.entries(filters)) {
    q = q.eq(k, v);
  }
  const { count } = await q;
  return count || 0;
}

async function getSetting(tenantId: string, key: string): Promise<string> {
  const supabase = createAdminClient({ unscoped: true });
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("key", key)
    .maybeSingle();
  return ((data as any)?.value || "").toString().trim();
}

async function getTenant(tenantId: string): Promise<any | null> {
  const supabase = createAdminClient({ unscoped: true });
  const { data } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .maybeSingle();
  return data;
}

// ─── The checklist ────────────────────────────────────────────────────

export const CHECKLIST_ITEMS: ChecklistItem[] = [
  // ── ACCOUNT ──
  {
    key: "tenant_created",
    category: "account",
    label: "Tenant created in RentalFlow",
    description: "Row in tenants table exists",
    required: true,
    autoDetect: async (tenantId) => !!(await getTenant(tenantId)),
  },
  {
    key: "business_name_set",
    category: "account",
    label: "Business name set",
    description: "tenants.business_name is non-empty",
    required: true,
    autoDetect: async (tenantId) => {
      const t = await getTenant(tenantId);
      return !!(t?.business_name && t.business_name.length > 0);
    },
  },
  {
    key: "business_contact_complete",
    category: "account",
    label: "Business phone + email + address set",
    description: "All 3 contact fields in site_settings filled",
    required: true,
    autoDetect: async (tenantId) => {
      const [phone, email, address] = await Promise.all([
        getSetting(tenantId, "business_phone"),
        getSetting(tenantId, "business_email"),
        getSetting(tenantId, "business_address"),
      ]);
      return !!(phone && email && address);
    },
  },
  {
    key: "business_hours_set",
    category: "account",
    label: "Business hours set",
    description: "site_settings.business_hours is filled",
    autoDetect: async (tenantId) => !!(await getSetting(tenantId, "business_hours")),
  },
  {
    key: "logo_uploaded",
    category: "account",
    label: "Logo uploaded",
    description: "site_settings.logo_url is set",
    required: true,
    autoDetect: async (tenantId) => !!(await getSetting(tenantId, "logo_url")),
  },
  {
    key: "brand_colors_set",
    category: "account",
    label: "Brand colors set (hero, navbar)",
    description: "At least hero_bg_color is set",
    autoDetect: async (tenantId) => !!(await getSetting(tenantId, "hero_bg_color")),
  },
  {
    key: "important_tips_set",
    category: "account",
    label: "Customer-facing important tips/policies written",
    description: "site_settings.important_tips has content",
    autoDetect: async (tenantId) => {
      const tips = await getSetting(tenantId, "important_tips");
      return tips.length > 20;
    },
  },

  // ── CATALOG ──
  {
    key: "first_category",
    category: "catalog",
    label: "At least 1 category created",
    description: "categories row count > 0",
    required: true,
    autoDetect: async (tenantId) => (await countRows(tenantId, "categories")) > 0,
  },
  {
    key: "first_product",
    category: "catalog",
    label: "At least 1 product in catalog",
    description: "products row count > 0",
    required: true,
    autoDetect: async (tenantId) => (await countRows(tenantId, "products", { is_active: true })) > 0,
  },
  {
    key: "five_products",
    category: "catalog",
    label: "5+ products listed",
    description: "Enough variety for customers to choose",
    autoDetect: async (tenantId) => (await countRows(tenantId, "products", { is_active: true })) >= 5,
  },
  {
    key: "product_has_image",
    category: "catalog",
    label: "Products have images",
    description: "At least 1 product with non-empty image_url",
    autoDetect: async (tenantId) => {
      const supabase = createAdminClient({ unscoped: true });
      const { count } = await supabase
        .from("products").select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("is_active", true)
        .not("image_url", "is", null);
      return (count || 0) > 0;
    },
  },

  // ── INVENTORY ──
  {
    key: "inventory_items_added",
    category: "inventory",
    label: "Operational inventory items tracked",
    description: "inventory_items count > 0",
    autoDetect: async (tenantId) => (await countRows(tenantId, "inventory_items")) > 0,
  },

  // ── FLEET ──
  {
    key: "fleet_vehicle_added",
    category: "fleet",
    label: "At least 1 vehicle in fleet",
    description: "Required for dispatch routes",
    required: true,
    autoDetect: async (tenantId) => (await countRows(tenantId, "vehicles")) > 0,
  },
  {
    key: "fleet_vehicle_has_compliance",
    category: "fleet",
    label: "Vehicles have VIN + license tag",
    description: "Required for some commercial insurance",
    autoDetect: async (tenantId) => {
      const supabase = createAdminClient({ unscoped: true });
      const { count } = await supabase
        .from("vehicles").select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).not("vin", "is", null).not("license_tag", "is", null);
      return (count || 0) > 0;
    },
  },

  // ── PAYMENTS ──
  {
    key: "stripe_connected",
    category: "payments",
    label: "Stripe Connect connected",
    description: "Required to accept online payments",
    required: true,
    autoDetect: async (tenantId) => {
      const t = await getTenant(tenantId);
      return !!(t?.stripe_account_id);
    },
  },
  {
    key: "first_paid_booking",
    category: "payments",
    label: "First paid booking received",
    description: "Confirms payment flow works end-to-end",
    autoDetect: async (tenantId) => {
      const supabase = createAdminClient({ unscoped: true });
      const { count } = await supabase
        .from("bookings").select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("stripe_payment_status", "paid")
        .neq("booking_status", "cancelled");
      return (count || 0) > 0;
    },
  },

  // ── PUBLIC SITE ──
  {
    key: "custom_domain_or_subdomain",
    category: "public_site",
    label: "Domain configured (custom or .getrentalflow.com)",
    description: "Tenant has a working URL",
    required: true,
    autoDetect: async (tenantId) => {
      const t = await getTenant(tenantId);
      return !!(t?.custom_domain || t?.slug);
    },
  },
  {
    key: "first_booking_received",
    category: "public_site",
    label: "First public booking received (any status)",
    description: "bookings row count > 0",
    autoDetect: async (tenantId) => (await countRows(tenantId, "bookings")) > 0,
  },

  // ── TEAM ──
  {
    key: "staff_users_invited",
    category: "team",
    label: "Staff users invited",
    description: "More than just the owner has access",
    autoDetect: async (tenantId) => {
      const supabase = createAdminClient({ unscoped: true });
      // user_roles PK is user_id — there is no `id` column. Selecting a
      // non-existent column was making the query throw → caught upstream
      // → autoDetect returned null → item displayed as incomplete even
      // when the tenant clearly had staff invited.
      const { count } = await supabase
        .from("user_roles").select("user_id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("is_active", true);
      return (count || 0) > 1;
    },
  },
  {
    key: "driver_users_added",
    category: "team",
    label: "At least 1 driver added",
    description: "Required to assign dispatch routes",
    autoDetect: async (tenantId) => {
      const supabase = createAdminClient({ unscoped: true });
      const { count } = await supabase
        .from("user_roles").select("user_id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("role", "driver").eq("is_active", true);
      return (count || 0) > 0;
    },
  },

  // ── COMMUNICATION ──
  {
    key: "email_templates_reviewed",
    category: "communication",
    label: "Email templates reviewed/customized",
    description: "At least 1 customized from default",
    manualOnly: true,
  },
  {
    key: "sms_configured",
    category: "communication",
    label: "SMS configured (Twilio)",
    description: "Optional — for booking confirmation + reminder SMS",
    manualOnly: true,
  },
  {
    key: "faqs_added",
    category: "communication",
    label: "3+ FAQs added",
    description: "Improves AI chat answers + public FAQ page",
    autoDetect: async (tenantId) => (await countRows(tenantId, "faqs", { is_active: true })) >= 3,
  },

  // ── LEGAL ──
  {
    key: "liability_waiver_reviewed",
    category: "legal",
    label: "Liability waiver text reviewed for state",
    description: "Default waiver is generic — review with lawyer for state-specific clauses",
    manualOnly: true,
    required: true,
  },
  {
    key: "sales_tax_configured",
    category: "legal",
    label: "Sales tax rate configured (or marked exempt)",
    description: "site_settings.tax_enabled set",
    required: true,
    autoDetect: async (tenantId) => {
      const enabled = await getSetting(tenantId, "tax_enabled");
      return enabled === "true" || enabled === "false";   // either explicitly set
    },
  },
  {
    key: "privacy_terms_reviewed",
    category: "legal",
    label: "Privacy policy + Terms of service reviewed",
    description: "Default text covers common cases — review for your jurisdiction",
    manualOnly: true,
  },

  // ── OPERATIONS ──
  {
    key: "first_dispatch_route",
    category: "operations",
    label: "First dispatch route built",
    description: "Confirms dispatch workflow understood",
    autoDetect: async (tenantId) => (await countRows(tenantId, "dispatch_routes")) > 0,
  },
  {
    key: "test_booking_full_cycle",
    category: "operations",
    label: "Full booking cycle tested (book → pay → deliver → review)",
    description: "End-to-end smoke test confirms everything works",
    manualOnly: true,
  },

  // ── MARKETING ──
  {
    key: "reviews_imported",
    category: "marketing",
    label: "Customer reviews imported (manual or carryover)",
    description: "Existing reviews from Google/Facebook added to /admin/reviews",
    autoDetect: async (tenantId) => (await countRows(tenantId, "customer_reviews", { is_active: true })) > 0,
  },
  {
    key: "loyalty_configured",
    category: "marketing",
    label: "Loyalty + referral commission % set",
    description: "Default is fine but verify points-per-dollar matches your margin",
    manualOnly: true,
  },
  {
    key: "first_lead_magnet_signup",
    category: "marketing",
    label: "Lead magnets enabled (free tools, calculators)",
    description: "Capture emails from prospects who aren't ready to book",
    manualOnly: true,
  },

  // ── OPERATOR INTEL (always manual — internal use) ──
  {
    key: "onboarding_call_done",
    category: "operator_intel",
    label: "Onboarding call completed",
    description: "30-min call to walk through setup with operator",
    manualOnly: true,
  },
  {
    key: "weekly_checkin_scheduled",
    category: "operator_intel",
    label: "Weekly check-in scheduled (first 4 weeks)",
    description: "Catch issues early",
    manualOnly: true,
  },
  {
    key: "champion_identified",
    category: "operator_intel",
    label: "Internal champion identified",
    description: "Who at the tenant most cares about success?",
    manualOnly: true,
  },
];

// ─── Result type ──────────────────────────────────────────────────────

export interface ChecklistItemStatus {
  item: ChecklistItem;
  is_completed: boolean;
  is_auto_detected: boolean;     // true if status comes from autoDetect, false if from DB
  detected_value: boolean | null;  // result of autoDetect, null if no autoDetect
  manual_value: boolean;          // value from tenant_onboarding_checklist row
  completed_at: string | null;
  completed_by_email: string | null;
  notes: string | null;
}

export interface ChecklistSummary {
  total: number;
  completed: number;
  required_total: number;
  required_completed: number;
  pct: number;
  by_category: Record<ChecklistCategory, { total: number; completed: number }>;
  items: ChecklistItemStatus[];
}

/** Run the full checklist evaluation for a tenant. */
export async function evaluateChecklist(tenantId: string): Promise<ChecklistSummary> {
  const supabase = createAdminClient({ unscoped: true });
  let manualRows: any[] = [];
  try {
    const r = await supabase
      .from("tenant_onboarding_checklist")
      .select("item_key, is_completed, completed_at, completed_by_email, notes")
      .eq("tenant_id", tenantId);
    manualRows = (r.data as any[]) || [];
  } catch (e) {
    console.error("evaluateChecklist: manualRows query failed:", e);
    manualRows = [];
  }
  const manualByKey = new Map<string, any>(
    manualRows.map((r) => [r.item_key, r]),
  );

  // Run all auto-detects in parallel
  const autoResults = await Promise.all(
    CHECKLIST_ITEMS.map(async (item) => {
      if (!item.autoDetect) return { key: item.key, value: null };
      try {
        const value = await item.autoDetect(tenantId);
        return { key: item.key, value };
      } catch {
        return { key: item.key, value: null };
      }
    }),
  );
  const autoByKey = new Map<string, boolean | null>(
    autoResults.map((r) => [r.key, r.value]),
  );

  const items: ChecklistItemStatus[] = CHECKLIST_ITEMS.map((item) => {
    const manual = manualByKey.get(item.key);
    const detected = autoByKey.get(item.key) ?? null;
    const is_completed = detected !== null ? detected : (manual?.is_completed ?? false);
    return {
      item,
      is_completed,
      is_auto_detected: detected !== null,
      detected_value: detected,
      manual_value: manual?.is_completed ?? false,
      completed_at: manual?.completed_at ?? null,
      completed_by_email: manual?.completed_by_email ?? null,
      notes: manual?.notes ?? null,
    };
  });

  const by_category: any = {};
  for (const cat of Object.keys(CATEGORY_LABELS)) {
    by_category[cat] = { total: 0, completed: 0 };
  }
  for (const it of items) {
    by_category[it.item.category].total++;
    if (it.is_completed) by_category[it.item.category].completed++;
  }

  const required_items = items.filter((i) => i.item.required);
  const completed_count = items.filter((i) => i.is_completed).length;
  return {
    total: items.length,
    completed: completed_count,
    required_total: required_items.length,
    required_completed: required_items.filter((i) => i.is_completed).length,
    pct: items.length > 0 ? Math.round((completed_count / items.length) * 100) : 0,
    by_category,
    items,
  };
}
