"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";

export async function markResolved(messageId: string, note: string) {
  const me = await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("contact_messages")
    .update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: me.email,
      admin_notes: note || null,
    })
    .eq("id", messageId);
  if (error) return { error: error.message };
  revalidatePath("/admin/inbox");
  return { success: true };
}

export async function reopenMessage(messageId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("contact_messages")
    .update({
      is_resolved: false,
      resolved_at: null,
      resolved_by: null,
    })
    .eq("id", messageId);
  if (error) return { error: error.message };
  revalidatePath("/admin/inbox");
  return { success: true };
}

export async function deleteMessage(messageId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("contact_messages").delete().eq("id", messageId);
  if (error) return { error: error.message };
  revalidatePath("/admin/inbox");
  return { success: true };
}
