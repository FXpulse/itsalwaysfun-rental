"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

const FaqInput = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(5000),
  display_order: z.number().int().min(0).max(999),
  is_active: z.boolean(),
});

export async function createFaq(formData: FormData) {
  await requireAdmin();
  const parsed = FaqInput.safeParse({
    question: String(formData.get("question") || ""),
    answer: String(formData.get("answer") || ""),
    display_order: parseInt(String(formData.get("display_order") || "0"), 10),
    is_active: formData.get("is_active") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("faqs").insert(parsed.data);
  if (error) return { error: error.message };
  revalidatePath("/admin/faqs");
  revalidatePath("/info/faqs");
  return { success: true };
}

export async function updateFaq(id: string, formData: FormData) {
  await requireAdmin();
  const parsed = FaqInput.safeParse({
    question: String(formData.get("question") || ""),
    answer: String(formData.get("answer") || ""),
    display_order: parseInt(String(formData.get("display_order") || "0"), 10),
    is_active: formData.get("is_active") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("faqs").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/faqs");
  revalidatePath("/info/faqs");
  return { success: true };
}

export async function deleteFaq(id: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("faqs").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/faqs");
  revalidatePath("/info/faqs");
  return { success: true };
}

export async function toggleFaqActive(id: string, currentlyActive: boolean) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("faqs")
    .update({ is_active: !currentlyActive })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/faqs");
  revalidatePath("/info/faqs");
  return { success: true };
}
