"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { logAuditEvent } from "@/lib/audit";

const TABLES_TO_CLEAR = [
  // booking children
  "booking_expenses",
  "booking_damages",
  "booking_proofs",
  "booking_waivers",
  "booking_extensions",
  "coi_requests",
  // dispatch
  "dispatch_stops",
  "dispatch_routes",
  // bookings
  "bookings",
  // quotes
  "quote_items",
  "quotes",
  // customer-facing
  "contact_message_replies",
  "contact_messages",
  "payout_requests",
  "loyalty_points_history",
  "loyalty_transactions",
  "gift_card_transactions",
  "gift_cards",
  "reviews",
  "customer_profiles",
];

export interface CleanupResult {
  ok: boolean;
  error?: string;
  deleted_per_table: Record<string, number | "skipped (missing)">;
  deleted_users: number;
  kept_users: number;
}

/** PREVIEW only — returns current counts without deleting anything. */
export async function previewCleanupCounts(): Promise<{
  per_table: Record<string, number | "missing">;
  auth_users_total: number;
  auth_users_to_delete: number;
  team_count: number;
}> {
  await requireAdmin();
  const supabase = createAdminClient();
  const per_table: Record<string, number | "missing"> = {};

  for (const t of TABLES_TO_CLEAR) {
    const { count, error } = await supabase
      .from(t)
      .select("*", { count: "exact", head: true });
    if (error) {
      per_table[t] = "missing";
    } else {
      per_table[t] = count || 0;
    }
  }

  // Active team
  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("is_active", true);
  const teamIds = new Set(((roles as any[]) || []).map((r) => r.user_id));
  const team_count = teamIds.size;

  // All auth users
  const { data: usersList } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const allUsers = usersList?.users || [];
  const auth_users_total = allUsers.length;
  const auth_users_to_delete = allUsers.filter((u) => !teamIds.has(u.id)).length;

  return {
    per_table,
    auth_users_total,
    auth_users_to_delete,
    team_count,
  };
}

/** DESTRUCTIVE — runs the actual cleanup. Requires confirm string "DELETE". */
export async function runCleanupTestData(confirm: string): Promise<CleanupResult> {
  const me = await requireAdmin();
  if (confirm !== "DELETE") {
    return {
      ok: false,
      error: 'You must type "DELETE" to confirm',
      deleted_per_table: {},
      deleted_users: 0,
      kept_users: 0,
    };
  }

  const supabase = createAdminClient();
  const deleted_per_table: Record<string, number | "skipped (missing)"> = {};

  for (const t of TABLES_TO_CLEAR) {
    // Count first so we know how many got wiped (PostgREST delete doesn't
    // return count by default in this version)
    const { count: beforeCount, error: countErr } = await supabase
      .from(t)
      .select("*", { count: "exact", head: true });
    if (countErr) {
      deleted_per_table[t] = "skipped (missing)";
      continue;
    }
    // PostgREST requires a filter for DELETE (safety). Using "id IS NOT NULL"
    // matches every row of any table with an id PK column.
    const { error } = await supabase.from(t).delete().not("id", "is", null);
    if (error) {
      deleted_per_table[t] = `error: ${error.message}` as any;
      continue;
    }
    deleted_per_table[t] = beforeCount || 0;
  }

  // Resolve team user ids (these get KEPT)
  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("is_active", true);
  const teamIds = new Set(((roles as any[]) || []).map((r) => r.user_id));
  // Always keep the calling admin even if their role row got disabled mid-cleanup
  teamIds.add(me.id);

  // List ALL auth users (paginate up to 5000 — sufficient for any reasonable test set)
  const allUsers: { id: string; email?: string | null }[] = [];
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) break;
    const usersPage = data?.users || [];
    allUsers.push(...usersPage.map((u) => ({ id: u.id, email: u.email })));
    if (usersPage.length < 1000) break;
  }

  // Delete users not in team
  let deleted_users = 0;
  for (const u of allUsers) {
    if (teamIds.has(u.id)) continue;
    const { error } = await supabase.auth.admin.deleteUser(u.id);
    if (!error) deleted_users++;
  }

  await logAuditEvent({
    userEmail: me.email || "unknown",
    action: "test_data.wiped",
    entityType: "system",
    details: {
      deleted_per_table,
      deleted_users,
      kept_users: teamIds.size,
    },
  });

  // Revalidate cached admin pages
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/inbox");
  revalidatePath("/admin/coi");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/customers");
  revalidatePath("/admin/quotes");
  revalidatePath("/admin/gift-cards");
  revalidatePath("/admin/payouts");
  revalidatePath("/admin/diagnostics");

  return {
    ok: true,
    deleted_per_table,
    deleted_users,
    kept_users: teamIds.size,
  };
}
