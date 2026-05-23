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

const CouponInput = z.object({
  code: z.string().min(2).max(50).regex(/^[A-Z0-9_-]+$/, "Use uppercase letters, numbers, _ or -"),
  description: z.string().max(500).optional().nullable(),
  discount_type: z.enum(["percent", "fixed"]),
  discount_value: z.number().int().min(0),
  max_uses: z.number().int().min(0).optional().nullable(),
  expires_at: z.string().optional().nullable(),
  is_active: z.boolean(),
});

function parseForm(formData: FormData) {
  const maxUsesRaw = String(formData.get("max_uses") || "");
  const expiresAtRaw = String(formData.get("expires_at") || "");
  return {
    code: String(formData.get("code") || "").trim().toUpperCase(),
    description: String(formData.get("description") || "") || null,
    discount_type: String(formData.get("discount_type") || "percent") as "percent" | "fixed",
    discount_value: (() => {
      const t = String(formData.get("discount_type") || "percent");
      const raw = parseFloat(String(formData.get("discount_value") || "0"));
      // percent → keep as int (0-100); fixed dollars → convert to cents
      return t === "percent" ? Math.round(raw) : Math.round(raw * 100);
    })(),
    max_uses: maxUsesRaw ? parseInt(maxUsesRaw, 10) : null,
    expires_at: expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null,
    is_active: formData.get("is_active") === "on",
  };
}

export async function createCoupon(formData: FormData) {
  await requireAdmin();
  const raw = parseForm(formData);
  const parsed = CouponInput.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }
  if (parsed.data.discount_type === "percent" && parsed.data.discount_value > 100) {
    return { error: "Percent discount cannot exceed 100" };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("coupons").insert(parsed.data);
  if (error) {
    if (error.code === "23505") return { error: "Coupon code already exists" };
    return { error: error.message };
  }
  revalidatePath("/admin/coupons");
  return { success: true };
}

export async function updateCoupon(id: string, formData: FormData) {
  await requireAdmin();
  const raw = parseForm(formData);
  const parsed = CouponInput.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("coupons").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/coupons");
  return { success: true };
}

export async function deleteCoupon(id: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("coupons").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/coupons");
  return { success: true };
}

export async function toggleCouponActive(id: string, currentlyActive: boolean) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("coupons")
    .update({ is_active: !currentlyActive })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/coupons");
  return { success: true };
}
