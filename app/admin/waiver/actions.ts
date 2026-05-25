"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";

export async function saveWaiver(formData: FormData) {
  await requireAdmin();
  const enabled = formData.get("waiver_enabled") === "on";
  const title = String(formData.get("waiver_title") || "").trim();
  const text = String(formData.get("waiver_text") || "").trim();

  if (!title) return { error: "Title required" };
  if (!text || text.length < 50) {
    return { error: "Waiver text is too short — provide the full agreement (50+ chars)" };
  }

  const supabase = createAdminClient();
  const updates = [
    { key: "waiver_enabled", value: enabled ? "true" : "false" },
    { key: "waiver_title", value: title },
    { key: "waiver_text", value: text },
  ];
  for (const u of updates) {
    const { error } = await supabase
      .from("site_settings")
      .upsert(u, { onConflict: "key" });
    if (error) return { error: `Failed to save ${u.key}: ${error.message}` };
  }

  revalidatePath("/admin/waiver");
  revalidatePath("/order-by-date");
  revalidatePath("/info/waiver");
  return { success: true };
}
