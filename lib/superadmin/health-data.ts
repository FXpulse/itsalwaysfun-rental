// Server-side fetcher that builds tenant health data for /superadmin/health.
// Cross-tenant unscoped queries.

import { createAdminClient } from "@/lib/supabase/admin";
import { scoreTenant, type TenantHealthResult } from "./tenant-health";

export interface TenantHealthRow {
  id: string;
  business_name: string;
  plan: string;
  subscription_status: string | null;
  custom_domain: string | null;
  created_at: string;
  health: TenantHealthResult;
  bookings_last_30d: number;
  bookings_lifetime: number;
  open_tickets: number;
}

export async function fetchAllTenantHealth(): Promise<TenantHealthRow[]> {
  const supabase = createAdminClient({ unscoped: true });

  // Pull all tenants
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, business_name, plan, subscription_status, custom_domain, suspended_at, trial_ends_at, current_period_end, cancel_at_period_end, created_at")
    .order("created_at", { ascending: false });
  if (!tenants) return [];

  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

  // Per-tenant data via Promise.all (parallel — fast)
  const rows = await Promise.all((tenants as any[]).map(async (t) => {
    // Bookings counts (filter by tenant_id for cross-tenant tables)
    const [bookings30, bookingsAll, tickets] = await Promise.all([
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", t.id)
        .gte("created_at", monthAgo),
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", t.id),
      supabase
        .from("support_tickets")
        .select("status")
        .eq("tenant_id", t.id),
    ]);

    const open_tickets = (tickets.data as Array<{ status: string }> | null)?.filter(
      (x) => x.status === "open" || x.status === "in_progress",
    ).length ?? 0;
    const resolved_tickets = (tickets.data as Array<{ status: string }> | null)?.filter(
      (x) => x.status === "resolved" || x.status === "closed",
    ).length ?? 0;

    const health = scoreTenant({
      subscription_status: t.subscription_status,
      plan: t.plan,
      trial_ends_at: t.trial_ends_at,
      current_period_end: t.current_period_end,
      cancel_at_period_end: t.cancel_at_period_end || false,
      suspended_at: t.suspended_at,
      created_at: t.created_at,
      bookings_last_30d: bookings30.count ?? 0,
      bookings_lifetime: bookingsAll.count ?? 0,
      open_tickets,
      resolved_tickets,
      last_admin_activity_at: null, // TODO: pull from auth.users.last_sign_in_at when we have that wired
    });

    return {
      id: t.id,
      business_name: t.business_name || "(unnamed)",
      plan: t.plan || "starter",
      subscription_status: t.subscription_status,
      custom_domain: t.custom_domain,
      created_at: t.created_at,
      health,
      bookings_last_30d: bookings30.count ?? 0,
      bookings_lifetime: bookingsAll.count ?? 0,
      open_tickets,
    } as TenantHealthRow;
  }));

  return rows;
}
