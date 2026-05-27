"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";

async function requireSuperadmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const admin = createAdminClient({ unscoped: true });
  const { data } = await admin
    .from("user_roles")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .eq("is_superadmin", true)
    .maybeSingle();
  if (!data) throw new Error("Not a superadmin");
  return { id: user.id, email: user.email || "unknown" };
}

const InviteSchema = z.object({
  email: z.string().email(),
  note: z.string().max(200).optional().nullable(),
});

// IAF tenant ID — used for new superadmin user_roles rows (every user_role
// requires a tenant_id; superadmins are conceptually cross-tenant but the
// row needs to belong SOMEWHERE)
const PLATFORM_TENANT_ID = "11111111-1111-1111-1111-111111111111";

export async function inviteSuperadmin(formData: FormData) {
  const me = await requireSuperadmin();
  const parsed = InviteSchema.safeParse({
    email: String(formData.get("email") || "").trim().toLowerCase(),
    note: String(formData.get("note") || "").trim() || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const admin = createAdminClient({ unscoped: true });

  // Check if user already exists in auth
  const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let userId =
    usersList?.users.find((u) => u.email?.toLowerCase() === parsed.data.email)?.id ||
    null;

  if (!userId) {
    // Create new user with random temp password + send invite/magic link
    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      email_confirm: true,
      user_metadata: { invited_as_superadmin_by: me.email },
    });
    if (createErr || !newUser?.user) {
      return { error: `Could not create user: ${createErr?.message || "unknown"}` };
    }
    userId = newUser.user.id;

    // Generate a recovery/magic link so they can set their own password
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: parsed.data.email,
    });
    // (Email is sent automatically by Supabase if SMTP is configured;
    //  otherwise the link is returned but no email goes out — log it for
    //  superadmin to share manually.)
    if (linkData?.properties?.action_link) {
      console.log("[invite link for", parsed.data.email, "]:", linkData.properties.action_link);
    }
  }

  // Upsert user_roles row marking them superadmin
  const { error: roleErr } = await admin
    .from("user_roles")
    .upsert(
      {
        user_id: userId,
        tenant_id: PLATFORM_TENANT_ID,
        role: "admin",
        is_active: true,
        is_superadmin: true,
      },
      { onConflict: "user_id,tenant_id" },
    );
  if (roleErr) return { error: `Role assignment failed: ${roleErr.message}` };

  await logAuditEvent({
    userEmail: me.email,
    action: "superadmin.invited",
    entityType: "user",
    entityId: userId,
    details: { invitee_email: parsed.data.email, note: parsed.data.note },
  });

  revalidatePath("/superadmin/team");
  return { success: true, email: parsed.data.email };
}

export async function removeSuperadmin(userId: string) {
  const me = await requireSuperadmin();
  if (userId === me.id) {
    return { error: "You can't remove yourself. Ask another superadmin to demote you." };
  }
  const admin = createAdminClient({ unscoped: true });
  const { error } = await admin
    .from("user_roles")
    .update({ is_superadmin: false })
    .eq("user_id", userId)
    .eq("is_superadmin", true);
  if (error) return { error: error.message };

  await logAuditEvent({
    userEmail: me.email,
    action: "superadmin.removed",
    entityType: "user",
    entityId: userId,
  });

  revalidatePath("/superadmin/team");
  return { success: true };
}
