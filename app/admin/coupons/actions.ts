"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendCouponAssignedEmail } from "@/lib/email/coupon-assigned";
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
  discount_type: z.enum(["percent", "fixed", "overnight_free"]),
  discount_value: z.number().int().min(0),
  max_uses: z.number().int().min(0).optional().nullable(),
  expires_at: z.string().optional().nullable(),
  is_active: z.boolean(),
  referrer_user_id: z.string().uuid().optional().nullable(),
});

function parseForm(formData: FormData) {
  const maxUsesRaw = String(formData.get("max_uses") || "");
  const expiresAtRaw = String(formData.get("expires_at") || "");
  const discountType = String(formData.get("discount_type") || "percent") as
    | "percent"
    | "fixed"
    | "overnight_free";
  return {
    code: String(formData.get("code") || "").trim().toUpperCase(),
    description: String(formData.get("description") || "") || null,
    discount_type: discountType,
    discount_value: (() => {
      if (discountType === "overnight_free") return 0; // ignored — computed at booking time
      const raw = parseFloat(String(formData.get("discount_value") || "0"));
      // percent → keep as int (0-100); fixed dollars → convert to cents
      return discountType === "percent" ? Math.round(raw) : Math.round(raw * 100);
    })(),
    max_uses: maxUsesRaw ? parseInt(maxUsesRaw, 10) : null,
    expires_at: expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null,
    is_active: formData.get("is_active") === "on",
    referrer_user_id: (String(formData.get("referrer_user_id") || "").trim() || null) as string | null,
  };
}

/** Find-or-create a customer by email. Used when admin types an email that
 *  doesn't appear in search results — creates the auth.user (email_confirmed)
 *  so the coupon can be attributed, then customer can sign in any time. */
export async function findOrCreateCustomerByEmail(email: string): Promise<{ user_id?: string; email?: string; error?: string }> {
  try {
    await requireAdmin();
    const normalized = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
      return { error: "Invalid email" };
    }
    const supabase = createAdminClient();

    // Try create first — Supabase returns error if user exists
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: normalized,
      email_confirm: true,
    });
    if (created?.user) {
      return { user_id: created.user.id, email: normalized };
    }
    // Already exists — find them
    if (createErr && /already.*registered|already.*exists|duplicate/i.test(createErr.message)) {
      const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const existing = (usersData?.users || []).find((u) => (u.email || "").toLowerCase() === normalized);
      if (existing) {
        return { user_id: existing.id, email: normalized };
      }
      // Try paginating
      let page = 2;
      while (page < 20) {
        const { data: pageData } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
        const found = pageData?.users?.find((u) => (u.email || "").toLowerCase() === normalized);
        if (found) return { user_id: found.id, email: normalized };
        if (!pageData?.users || pageData.users.length < 1000) break;
        page++;
      }
      return { error: "User exists but could not be found in pagination" };
    }
    return { error: createErr?.message || "Failed to create user" };
  } catch (e: any) {
    console.error("findOrCreateCustomerByEmail error:", e);
    return { error: e?.message || String(e) };
  }
}

/** Search customers by email. Used by admin coupon form to assign a referrer.
 *  customer_profiles doesn't store email/name — those live in auth.users.
 *  We list users via admin SDK then filter to those that have a customer_profile. */
export async function searchCustomers(query: string): Promise<Array<{ user_id: string; email: string; referral_code: string | null }>> {
  await requireAdmin();
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const supabase = createAdminClient();

  // Get up to 1000 users (paginate if you ever have more) — RentalFlow tenants
  // typically have far fewer customers in scope.
  const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const matchingUsers = (usersData?.users || []).filter((u) =>
    (u.email || "").toLowerCase().includes(q),
  );
  if (matchingUsers.length === 0) return [];

  // Look up customer_profile to enrich the referral_code badge, but do NOT
  // filter by it — admin can assign coupons to any auth user (whether they've
  // logged into the portal yet or not). When the customer earns their first
  // commission, ensureCustomerProfile() auto-creates the missing profile.
  const userIds = matchingUsers.map((u) => u.id);
  const { data: profiles } = await supabase
    .from("customer_profiles")
    .select("user_id, referral_code")
    .in("user_id", userIds);
  const profileMap = new Map<string, string | null>(
    ((profiles as any[]) || []).map((p) => [p.user_id, p.referral_code]),
  );

  return matchingUsers
    .slice(0, 10)
    .map((u) => ({
      user_id: u.id,
      email: u.email || "",
      referral_code: profileMap.get(u.id) || null,
    }));
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

  // If assigned to a customer, notify them (fire-and-forget)
  if (parsed.data.referrer_user_id) {
    sendCouponAssignedEmail({
      coupon_code: parsed.data.code,
      discount_type: parsed.data.discount_type,
      discount_value: parsed.data.discount_value,
      description: parsed.data.description ?? null,
      customer_user_id: parsed.data.referrer_user_id,
    }).catch(() => {});
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
  // Read current referrer to detect if assignment is new
  const { data: prev } = await supabase
    .from("coupons").select("referrer_user_id").eq("id", id).maybeSingle();
  const prevReferrer = (prev as any)?.referrer_user_id || null;

  const { error } = await supabase.from("coupons").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };

  // Only notify if assignment is NEW or CHANGED to a different customer
  if (
    parsed.data.referrer_user_id &&
    parsed.data.referrer_user_id !== prevReferrer
  ) {
    sendCouponAssignedEmail({
      coupon_code: parsed.data.code,
      discount_type: parsed.data.discount_type,
      discount_value: parsed.data.discount_value,
      description: parsed.data.description ?? null,
      customer_user_id: parsed.data.referrer_user_id,
    }).catch(() => {});
  }

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
