// Role-based access helpers. Used in server actions, layout, and admin pages.
//
// Roles:
//   admin → full access
//   staff → bookings + inventory only

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type UserRole = "admin" | "staff" | "driver";

export interface UserWithRole {
  id: string;
  email: string | null;
  role: UserRole;
  is_active: boolean;
}

/** Returns the role for the currently-authenticated user, or null if unauthed/no role. */
export async function getCurrentUserRole(): Promise<UserWithRole | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Use admin client to bypass RLS recursion when reading own role
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_roles")
    .select("role, is_active")
    .eq("user_id", user.id)
    .single();

  if (!data || !data.is_active) return null;

  return {
    id: user.id,
    email: user.email ?? null,
    role: data.role as UserRole,
    is_active: data.is_active,
  };
}

/** Throws if user is not authenticated. Returns user. */
export async function requireAuth() {
  const role = await getCurrentUserRole();
  if (!role) throw new Error("Unauthorized");
  return role;
}

/** Throws if user is not an active admin. Returns user. */
export async function requireAdmin() {
  const role = await getCurrentUserRole();
  if (!role || role.role !== "admin") {
    throw new Error("Admin access required");
  }
  return role;
}

/** Throws if user is not an active admin or staff. Returns user. */
export async function requireStaffOrAdmin() {
  const role = await getCurrentUserRole();
  if (!role || (role.role !== "admin" && role.role !== "staff")) {
    throw new Error("Staff or admin access required");
  }
  return role;
}

/** Throws if user is not driver/staff/admin. Used for dispatch operations
 *  drivers need to perform from the field (mark stops delivered, capture proofs). */
export async function requireDriverOrAbove() {
  const role = await getCurrentUserRole();
  if (!role) throw new Error("Sign in required");
  return role; // any active role passes
}

/** True if the current user is allowed to access a given admin route. */
export function canAccessRoute(role: UserRole, path: string): boolean {
  if (role === "admin") return true;
  if (role === "driver") {
    // Drivers can ONLY access: their /driver landing + dispatch route view +
    // individual booking detail (for proof capture)
    const allowed = [
      "/driver",
      "/admin/dispatch/route",
      "/admin/bookings",
    ];
    return allowed.some((p) => path === p || path.startsWith(p + "/"));
  }
  // Staff scope: bookings + inventory + dashboard (read-only data they need)
  const staffAllowedPrefixes = [
    "/admin/dashboard",
    "/admin/bookings",
    "/admin/inventory",
    "/admin/availability",
  ];
  return staffAllowedPrefixes.some((p) => path === p || path.startsWith(p + "/"));
}
