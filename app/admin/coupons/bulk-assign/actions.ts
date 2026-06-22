"use server";

import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendCouponAssignedEmail } from "@/lib/email/coupon-assigned";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

interface BulkInput {
  customer_user_ids: string[];
  prefix: string;                     // optional, e.g. "SUMMER"
  discount_type: "percent" | "fixed";
  discount_value: number;             // percent: 0-100; fixed: dollars (we convert to cents)
  max_uses: number | null;
  expires_at: string | null;          // ISO or empty
  description: string | null;
}

// 6-char random suffix using a clean alphabet (no 0/O/1/I confusion).
// crypto.randomInt is cryptographically strong — Math.random() would make
// codes predictable after observing a handful.
function randomSuffix(len = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += alphabet[crypto.randomInt(alphabet.length)];
  return s;
}

export async function bulkAssignCoupons(input: BulkInput): Promise<
  { ok: true; created: number; failed: number; emails_sent: number } | { error: string }
> {
  await requireAdmin();

  if (input.customer_user_ids.length === 0) return { error: "Pick at least one customer" };
  if (input.customer_user_ids.length > 100) return { error: "Limit 100 customers per bulk" };

  if (input.discount_type === "percent") {
    if (input.discount_value < 1 || input.discount_value > 100) return { error: "Percent must be 1-100" };
  } else {
    if (input.discount_value < 1) return { error: "Discount must be at least $1" };
  }

  const prefix = (input.prefix || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const discountValueDb = input.discount_type === "percent"
    ? Math.round(input.discount_value)
    : Math.round(input.discount_value * 100);

  const supabase = createAdminClient();
  let created = 0;
  let failed = 0;
  let emailsSent = 0;

  for (const userId of input.customer_user_ids) {
    // Generate code with collision retry
    let code = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `${prefix}${prefix ? "-" : ""}${randomSuffix(6)}`;
      const { data: existing } = await supabase
        .from("coupons").select("id").eq("code", candidate).maybeSingle();
      if (!existing) { code = candidate; break; }
    }
    if (!code) { failed++; continue; }

    const { error } = await supabase.from("coupons").insert({
      code,
      description: input.description,
      discount_type: input.discount_type,
      discount_value: discountValueDb,
      max_uses: input.max_uses,
      expires_at: input.expires_at,
      is_active: true,
      referrer_user_id: userId,
    });
    if (error) { failed++; continue; }
    created++;

    // Fire email (don't await — sequential network would be slow for 100)
    sendCouponAssignedEmail({
      coupon_code: code,
      discount_type: input.discount_type,
      discount_value: discountValueDb,
      description: input.description,
      customer_user_id: userId,
    }).then(() => { emailsSent++; }).catch(() => {});
  }

  revalidatePath("/admin/coupons");
  return { ok: true, created, failed, emails_sent: emailsSent };
}
