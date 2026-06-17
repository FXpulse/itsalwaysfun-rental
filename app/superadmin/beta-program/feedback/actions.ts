"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireSuperadmin(): Promise<{ email: string | null }> {
  const user = (await createClient().auth.getUser()).data.user;
  if (!user) throw new Error("unauthorized");
  const admin = createAdminClient({ unscoped: true });
  const { data } = await admin
    .from("user_roles")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .eq("is_superadmin", true)
    .maybeSingle();
  if (!data) throw new Error("not_superadmin");
  return { email: user.email ?? null };
}

export async function resolveBetaFeedback(formData: FormData) {
  const me = await requireSuperadmin();
  const id = (formData.get("id") || "").toString();
  const note = (formData.get("note") || "").toString().slice(0, 500) || null;
  if (!id) return;

  const admin = createAdminClient({ unscoped: true });
  await admin
    .from("beta_feedback")
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by_email: me.email,
      resolution_note: note,
    })
    .eq("id", id);

  revalidatePath("/superadmin/beta-program/feedback");
}

export async function unresolveBetaFeedback(id: string) {
  await requireSuperadmin();
  const admin = createAdminClient({ unscoped: true });
  await admin
    .from("beta_feedback")
    .update({
      resolved: false,
      resolved_at: null,
      resolved_by_email: null,
      resolution_note: null,
    })
    .eq("id", id);
  revalidatePath("/superadmin/beta-program/feedback");
}
