import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { UsersManager } from "./UsersManager";

export const dynamic = "force-dynamic";

export interface UserRow {
  user_id: string;
  email: string;
  role: "admin" | "staff";
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

  const admin = createAdminClient();

  // 1) Get all user_roles
  const { data: roles } = await admin
    .from("user_roles")
    .select("user_id, role, is_active, created_at")
    .order("created_at", { ascending: false });

  // 2) Get auth user emails (admin API)
  const { data: { users: authUsers } = { users: [] } } =
    await admin.auth.admin.listUsers({ perPage: 200 });

  const emailMap = new Map((authUsers || []).map((u) => [u.id, { email: u.email, last_sign_in_at: u.last_sign_in_at }]));

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

  // Also: any auth users WITHOUT a role row (orphans, can be cleaned up)
  const roleUserIds = new Set(rows.map((r) => r.user_id));
  const orphans = (authUsers || [])
    .filter((u) => !roleUserIds.has(u.id))
    .map((u) => ({
      user_id: u.id,
      email: u.email || "(unknown)",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    }));

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1">Users</h1>
      <p className="text-sm text-slate-500 mb-6">
        Manage admin and staff accounts. Staff can only access Bookings, Inventory, Availability, and Dashboard.
      </p>

      <UsersManager users={rows} orphans={orphans} currentUserId={me.id} />
    </div>
  );
}
