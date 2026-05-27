"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function resetAdminPassword(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
}> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const secret = String(formData.get("secret") || "");

  // One-time hard-coded token — this endpoint exists ONLY while this token
  // matches what the user pastes. After the user resets, the endpoint is
  // deleted in a follow-up commit, making the token useless.
  const ONE_TIME_TOKEN = "iaf-reset-2026-a7Kx9pL2mQ8nR4vT";
  if (secret !== ONE_TIME_TOKEN) {
    return { ok: false, error: "Invalid token" };
  }

  if (!email || !email.includes("@")) {
    return { ok: false, error: "Invalid email" };
  }
  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters" };
  }

  const supabase = createAdminClient();

  // Only allow resetting passwords for users that already have an active
  // role in user_roles (admin / staff / driver) — prevents this endpoint
  // from being used to create accounts or attack arbitrary auth users.
  const { data: users } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const target = users?.users.find((u) => u.email?.toLowerCase() === email);
  if (!target) {
    return { ok: false, error: `No auth user found for ${email}` };
  }
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role, is_active")
    .eq("user_id", target.id)
    .maybeSingle();
  if (!roleRow || !roleRow.is_active) {
    return { ok: false, error: `${email} has no active admin/staff/driver role` };
  }

  const { error } = await supabase.auth.admin.updateUserById(target.id, {
    password,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
