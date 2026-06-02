"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant/db";
import { requireStaffOrAdmin } from "@/lib/auth/roles";

export async function importGoogleReview(input: {
  author: string;
  rating: number;
  text: string;
  publishTime: string | null;
  sourceUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireStaffOrAdmin();
    const tenantId = getCurrentTenantId();
    if (!input.text?.trim() || !input.author?.trim()) {
      return { ok: false, error: "Review missing author or text" };
    }
    if (!input.rating || input.rating < 1 || input.rating > 5) {
      return { ok: false, error: "Rating must be 1-5" };
    }

    const supabase = createAdminClient({ unscoped: true });

    // Defensive dedup — don't import same review twice
    const { data: existing } = await supabase
      .from("customer_reviews")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("customer_name", input.author.trim())
      .eq("review_text", input.text.trim())
      .maybeSingle();
    if (existing) {
      return { ok: false, error: "Already imported" };
    }

    const reviewedAt = input.publishTime
      ? new Date(input.publishTime).toISOString()
      : new Date().toISOString();

    const { error } = await supabase.from("customer_reviews").insert({
      tenant_id: tenantId,
      customer_name: input.author.trim(),
      review_text: input.text.trim(),
      rating: input.rating,
      source: "google",
      source_url: input.sourceUrl || null,
      reviewed_at: reviewedAt,
      is_active: true,
      is_featured: false,
      sort_order: 0,
    });
    if (error) {
      console.error("importGoogleReview error:", error);
      return { ok: false, error: error.message };
    }

    revalidatePath("/admin/reviews");
    revalidatePath("/reviews");
    revalidatePath("/");
    return { ok: true };
  } catch (e: any) {
    console.error("importGoogleReview threw:", e);
    return { ok: false, error: e?.message || String(e) };
  }
}
