// Full DB backup — server-only. Exports every critical table to a single
// JSON object. Used by /api/admin/backup (manual download) and
// /api/cron/weekly-backup (scheduled upload to Storage + email).
//
// NOT included: file uploads (photos, W9s, COI PDFs) — those live in
// Supabase Storage and need a separate backup process.

import { createAdminClient } from "@/lib/supabase/admin";

// Tables to export. Order doesn't matter for backup (only for restore).
// Marked `optional` for tables that may not exist in older schemas — those
// silently skip if missing.
const TABLES = [
  // CRITICAL — customer + transaction data
  { name: "bookings", optional: false },
  { name: "booking_expenses", optional: true },
  { name: "booking_damages", optional: true },
  { name: "booking_proofs", optional: true },
  { name: "booking_waivers", optional: true },
  { name: "booking_extensions", optional: true },
  { name: "coi_requests", optional: true },
  { name: "customer_profiles", optional: true },
  { name: "gift_cards", optional: true },
  { name: "gift_card_transactions", optional: true },
  { name: "gift_card_redemptions", optional: true },
  { name: "quotes", optional: true },
  { name: "quote_items", optional: true },
  { name: "payout_requests", optional: true },
  { name: "contact_messages", optional: true },
  { name: "contact_message_replies", optional: true },
  { name: "reviews", optional: true },
  { name: "loyalty_points_history", optional: true },
  { name: "loyalty_transactions", optional: true },
  // CONFIGURATION
  { name: "products", optional: false },
  { name: "product_inventory_requirements", optional: true },
  { name: "product_images", optional: true },
  { name: "categories", optional: true },
  { name: "inventory_items", optional: true },
  { name: "inventory_units", optional: true },
  { name: "inventory_categories", optional: true },
  { name: "vehicles", optional: true },
  { name: "trailers", optional: true },
  { name: "packages", optional: true },
  { name: "coupons", optional: true },
  { name: "site_settings", optional: false },
  { name: "email_templates", optional: true },
  { name: "user_roles", optional: false },
  { name: "overhead_costs", optional: true },
  { name: "overhead_categories", optional: true },
  { name: "booking_expense_categories", optional: true },
  { name: "driver_tax_profiles", optional: true },
  { name: "audit_log", optional: true },
  { name: "home_banners", optional: true },
  { name: "faqs", optional: true },
  { name: "dispatch_routes", optional: true },
  { name: "dispatch_stops", optional: true },
];

export interface BackupResult {
  version: string;
  exported_at: string;
  tables: Record<string, any[]>;
  skipped: string[];
  total_rows: number;
  errors: Record<string, string>;
}

/** Pull all tables into one JSON object. Returns counts + any errors. */
export async function exportFullBackup(): Promise<BackupResult> {
  const supabase = createAdminClient();
  const tables: Record<string, any[]> = {};
  const skipped: string[] = [];
  const errors: Record<string, string> = {};
  let total_rows = 0;

  // Run in parallel for speed
  const results = await Promise.all(
    TABLES.map(async (t) => {
      const { data, error } = await supabase.from(t.name).select("*");
      return { table: t.name, optional: t.optional, data, error };
    }),
  );

  for (const r of results) {
    if (r.error) {
      if (r.optional) {
        skipped.push(r.table);
      } else {
        errors[r.table] = r.error.message;
      }
      continue;
    }
    const rows = (r.data as any[]) || [];
    tables[r.table] = rows;
    total_rows += rows.length;
  }

  // Auth users — extract just the essentials (id, email, role) — passwords
  // and other auth metadata are managed by Supabase and never backed up.
  try {
    const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const users = (data?.users || []).map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      email_confirmed_at: u.email_confirmed_at,
    }));
    tables["_auth_users_metadata"] = users;
    total_rows += users.length;
  } catch (e: any) {
    errors["_auth_users_metadata"] = e.message;
  }

  return {
    version: "1.0",
    exported_at: new Date().toISOString(),
    tables,
    skipped,
    total_rows,
    errors,
  };
}
