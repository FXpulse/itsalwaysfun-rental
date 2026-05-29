// app/superadmin/email/labels/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSuperadminUser } from "@/lib/auth/superadmin";

async function requireAuth() {
  const user = await getSuperadminUser();
  if (!user) throw new Error("Unauthorized");
}

export async function createLabel(account_id: string, name: string, color: string) {
  await requireAuth();
  const supabase = createAdminClient({ unscoped: true });
  const { error } = await supabase.from("email_labels").insert({ account_id, name, color });
  if (error) return { error: error.message };
  revalidatePath("/superadmin/email/labels");
}

export async function updateLabel(id: string, name: string, color: string) {
  await requireAuth();
  const supabase = createAdminClient({ unscoped: true });
  await supabase.from("email_labels").update({ name, color }).eq("id", id);
  revalidatePath("/superadmin/email/labels");
}

export async function deleteLabel(id: string) {
  await requireAuth();
  const supabase = createAdminClient({ unscoped: true });
  await supabase.from("email_labels").delete().eq("id", id);
  revalidatePath("/superadmin/email/labels");
}
