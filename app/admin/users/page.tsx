import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { UsersManager } from "./UsersManager";

export const dynamic = "force-dynamic";

export interface UserRow {
  user_id: string;
  email: string;
  role: "admin" | "staff" | "driver";
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

export default async function AdminUsersPage() {
  // Admin-only — kick staff back to dashboard
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") {
    redirect("/admin/dashboard");
  }

  // The scoped admin client auto-filters user_roles by current tenant
  // via the proxy wrap (lib/tenant/scope.ts). So this only returns
  // user_roles for THIS tenant — no cross-tenant leaks.
  const admin = createAdminClient();
  const { data: roles } = await admin
    .from("user_roles")
    .select("user_id, role, is_active, created_at")
    .order("created_at", { ascending: false });

  const tenantUserIds = new Set((roles || []).map((r: any) => r.user_id));

  // For the email lookup we have to use the auth admin API (no RLS).
  // Use an UNSCOPED admin client to avoid the proxy wrapping non-existent
  // tenant_id filters on auth schema (auth tables aren't in our
  // MULTI_TENANT_TABLES set, so it's a no-op, but explicit is safer).
  const authAdmin = createAdminClient({ unscoped: true });
  const { data: { users: authUsers } = { users: [] } } =
    await authAdmin.auth.admin.listUsers({ perPage: 1000 });

  // CRITICAL: filter authUsers to ONLY those whose ID appears in this
  // tenant's user_roles. Other tenants' users must never appear here.
  const emailMap = new Map(
    (authUsers || [])
      .filter((u) => tenantUserIds.has(u.id))
      .map((u) => [u.id, { email: u.email, last_sign_in_at: u.last_sign_in_at }]),
  );

  const rows: UserRow[] = (roles || []).map((r: any) => {
    const info = emailMap.get(r.user_id);
    return {
      user_id: r.user_id,
      email: info?.email || "(unknown)",
      role: r.role,
      is_active: r.is_active,
      created_at: r.created_at,
      last_sign_in_at: info?.last_sign_in_at || null,
    };
  });

  // No "orphans" list in multi-tenant: there's no such thing as an auth
  // user without a tenant role from this tenant's perspective. Other
  // tenants' users are simply not visible.

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1">Users</h1>
      <p className="text-sm text-slate-500 mb-6">
        Manage admin and staff accounts for your business. Staff see only Bookings,
        Inventory, Availability, and Dashboard.
      </p>

      <UsersManager users={rows} orphans={[]} currentUserId={me.id} />
    </div>
  );
}
