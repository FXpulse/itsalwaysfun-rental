// lib/auth/superadmin.ts
//
// Centralized superadmin auth check for /superadmin/* pages and APIs.
//
// Superadmin status is stored as `is_superadmin = true` on a user's row in
// `user_roles`. The role string (admin/staff/driver) is per-tenant scope —
// is_superadmin is the operator-level flag used by the marketing apex.
//
// All /superadmin pages should call this; throwing handled by callers.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getSuperadminUser(): Promise<
  { id: string; email: string } | null
> {
  const authClient = createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user?.id) return null;
  const admin = createAdminClient({ unscoped: true });
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .eq("is_superadmin", true)
    .maybeSingle();
  if (!roleRow) return null;
  return { id: user.id, email: user.email || "" };
}
