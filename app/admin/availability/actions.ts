"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BlockDateInputSchema } from "@/lib/validation";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function blockDate(input: {
  product_id: string;
  blocked_date: string;
  reason?: string | null;
}) {
  const user = await requireAdmin();
  const parsed = BlockDateInputSchema.safeParse({
    product_id: input.product_id,
    blocked_date: input.blocked_date,
    reason: input.reason || null,
  });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("blocked_dates").insert({
    product_id: parsed.data.product_id,
    blocked_date: parsed.data.blocked_date,
    reason: parsed.data.reason,
    created_by: user.email,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "This date is already blocked for this product." };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/availability");
  return { success: true };
}

export async function unblockDate(blockId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("blocked_dates").delete().eq("id", blockId);
  if (error) return { error: error.message };
  revalidatePath("/admin/availability");
  return { success: true };
}
