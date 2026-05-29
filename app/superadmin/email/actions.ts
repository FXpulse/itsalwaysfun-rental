// app/superadmin/email/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSuperadminUser } from "@/lib/auth/superadmin";

export async function bulkArchive(threadIds: string[]) {
  if (threadIds.length === 0) return;
  const user = await getSuperadminUser();
  if (!user) throw new Error("Unauthorized");
  const supabase = createAdminClient({ unscoped: true });
  const { error } = await supabase.from("email_threads")
    .update({ archived_at: new Date().toISOString() })
    .in("id", threadIds);
  if (error) return { error: error.message };
  revalidatePath("/superadmin/email");
}

export async function bulkMarkRead(threadIds: string[], read: boolean) {
  if (threadIds.length === 0) return;
  const user = await getSuperadminUser();
  if (!user) throw new Error("Unauthorized");
  const supabase = createAdminClient({ unscoped: true });
  for (const id of threadIds) {
    await supabase.from("email_messages")
      .update({ is_read: read }).eq("thread_id", id);
    await supabase.from("email_threads")
      .update({ unread_count: read ? 0 : 1 }).eq("id", id);
  }
  revalidatePath("/superadmin/email");
}
