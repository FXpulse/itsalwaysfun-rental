"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { z } from "zod";

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["admin", "staff", "driver"]),
});

export async function createUser(formData: FormData) {
  const me = await requireAdmin();

  const parsed = CreateUserSchema.safeParse({
    email: String(formData.get("email") || "").trim().toLowerCase(),
    password: String(formData.get("password") || ""),
    role: String(formData.get("role") || "staff"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const admin = createAdminClient();

  // 1. Create auth user (auto-confirmed so they can log in immediately)
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });

  if (authError || !created?.user) {
    return { error: authError?.message || "Failed to create user" };
  }

  // 2. Insert role row
  const { error: roleError } = await admin.from("user_roles").insert({
    user_id: created.user.id,
    role: parsed.data.role,
    is_active: true,
  });

  if (roleError) {
    // Best-effort rollback: delete the auth user so they can be re-created cleanly
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: `Created auth user but role insert failed: ${roleError.message}` };
  }

  revalidatePath("/admin/users");
  return { success: true, user_id: created.user.id };
}

const UpdateRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["admin", "staff", "driver"]),
});

export async function updateUserRole(formData: FormData) {
  const me = await requireAdmin();

  const parsed = UpdateRoleSchema.safeParse({
    user_id: String(formData.get("user_id") || ""),
    role: String(formData.get("role") || "staff"),
  });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  // Safety: prevent admin from demoting themselves (would lose access immediately)
  if (parsed.data.user_id === me.id && parsed.data.role !== "admin") {
    return { error: "You cannot demote yourself. Ask another admin." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_roles")
    .update({ role: parsed.data.role })
    .eq("user_id", parsed.data.user_id);

  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { success: true };
}

export async function toggleUserActive(userId: string, currentlyActive: boolean) {
  const me = await requireAdmin();

  // Safety: don't let an admin lock themselves out
  if (userId === me.id && currentlyActive) {
    return { error: "You cannot deactivate yourself." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_roles")
    .update({ is_active: !currentlyActive })
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { success: true };
}

export async function deleteUser(userId: string) {
  const me = await requireAdmin();

  if (userId === me.id) {
    return { error: "You cannot delete yourself." };
  }

  const admin = createAdminClient();

  // Delete auth user — cascade will remove user_roles row
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return { success: true };
}

const ResetPasswordSchema = z.object({
  user_id: z.string().uuid(),
  new_password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function resetUserPassword(formData: FormData) {
  await requireAdmin();

  const parsed = ResetPasswordSchema.safeParse({
    user_id: String(formData.get("user_id") || ""),
    new_password: String(formData.get("new_password") || ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(parsed.data.user_id, {
    password: parsed.data.new_password,
  });

  if (error) return { error: error.message };
  return { success: true };
}
