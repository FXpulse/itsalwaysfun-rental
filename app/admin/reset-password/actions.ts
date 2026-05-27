"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function resetAdminPassword(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
}> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const secret = String(formData.get("secret") || "");

  // Gate by CRON_SECRET (already configured in Vercel env vars)
  if (!process.env.CRON_SECRET) {
    return { ok: false, error: "CRON_SECRET env var not set on the server" };
  }
  if (secret !== process.env.CRON_SECRET) {
    return { ok: false, error: "Invalid secret" };
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
