"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Allowed code shape: 3–20 chars, A–Z 0–9 and dash. We uppercase before
// store so MARIA-FAV and maria-fav can't both exist (same human intent).
// The DB unique constraint coupons_tenant_code_uniq(tenant_id, code) catches
// collisions; we just give a friendly error message before the DB hit.
const CODE_RE = /^[A-Z0-9-]{3,20}$/;

const RenameSchema = z.object({
  couponId: z.string().uuid(),
  newCode: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .pipe(z.string().regex(CODE_RE, "3–20 chars, letters, numbers, dashes only")),
});

/** Customer renames their own referral coupon. Discount value/type stays
 *  fixed (set by tenant); they're only personalizing the share code. */
export async function renameOwnReferralCoupon(
  input: z.infer<typeof RenameSchema>,
): Promise<{ ok: true; newCode: string } | { error: string }> {
  const parsed = RenameSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid code" };
  }
  const { couponId, newCode } = parsed.data;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient({ unscoped: true });

  // Verify the coupon belongs to THIS user. Without this check, any portal
  // user could rename anyone's coupon. Defense-in-depth even though portal
  // RLS would also block this.
  const { data: existing } = await admin
    .from("coupons")
    .select("id, code, referrer_user_id, tenant_id, is_active")
    .eq("id", couponId)
    .maybeSingle();
  if (!existing) return { error: "Coupon not found" };
  if ((existing as any).referrer_user_id !== user.id) {
    return { error: "Not your coupon" };
  }
  if (!(existing as any).is_active) {
    return { error: "Coupon is no longer active" };
  }
  if ((existing as any).code === newCode) {
    return { ok: true, newCode }; // no-op
  }

  // Update ONLY the code column. discount_type/value never touched.
  const { error } = await admin
    .from("coupons")
    .update({ code: newCode, updated_at: new Date().toISOString() })
    .eq("id", couponId)
    .eq("referrer_user_id", user.id); // belt + suspenders

  if (error) {
    // 23505 = unique violation (Postgres). Means newCode already taken on
    // this tenant. Show a friendly message.
    if (error.code === "23505" || /duplicate/.test(error.message)) {
      return { error: `Code "${newCode}" is already in use. Try another.` };
    }
    return { error: error.message };
  }

  revalidatePath("/portal/referrals");
  return { ok: true, newCode };
}
