"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { z } from "zod";

const PayoutSchema = z.object({
  user_id: z.string().uuid(),
  amount_dollars: z.number().min(0.01),
  note: z.string().max(500).optional().nullable(),
});

/** Record a manual commission payout. Subtracts from pending, adds to paid,
 *  inserts a ledger row. */
export async function recordCommissionPayout(formData: FormData) {
  const me = await requireAdmin();

  const parsed = PayoutSchema.safeParse({
    user_id: String(formData.get("user_id") || ""),
    amount_dollars: parseFloat(String(formData.get("amount_dollars") || "0")),
    note: String(formData.get("note") || "") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const amountCents = Math.round(parsed.data.amount_dollars * 100);
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("customer_profiles")
    .select("commission_pending_cents, commission_paid_cents")
    .eq("user_id", parsed.data.user_id)
    .single();
  if (!profile) return { error: "Customer profile not found" };

  if (amountCents > profile.commission_pending_cents) {
    return {
      error: `Cannot payout $${parsed.data.amount_dollars.toFixed(2)} — only $${(profile.commission_pending_cents / 100).toFixed(2)} pending`,
    };
  }

  // Ledger row (negative commission = payout)
  await supabase.from("loyalty_transactions").insert({
    user_id: parsed.data.user_id,
    type: "commission_payout",
    commission_cents: -amountCents,
    description: `Payout recorded by ${me.email}${parsed.data.note ? ` — ${parsed.data.note}` : ""}`,
  });

  // Update balances
  await supabase
    .from("customer_profiles")
    .update({
      commission_pending_cents: profile.commission_pending_cents - amountCents,
      commission_paid_cents: profile.commission_paid_cents + amountCents,
    })
    .eq("user_id", parsed.data.user_id);

  revalidatePath("/admin/loyalty");
  revalidatePath(`/admin/loyalty/${parsed.data.user_id}`);
  return { success: true };
}

const AdjustmentSchema = z.object({
  user_id: z.string().uuid(),
  type: z.enum(["points", "commission"]),
  delta: z.number().int(), // can be negative
  note: z.string().min(1).max(500),
});

/** Manual adjustment to a customer's points or commission. */
export async function recordAdjustment(formData: FormData) {
  const me = await requireAdmin();

  const parsed = AdjustmentSchema.safeParse({
    user_id: String(formData.get("user_id") || ""),
    type: String(formData.get("type") || "points") as any,
    delta: parseInt(String(formData.get("delta") || "0"), 10),
    note: String(formData.get("note") || "").trim(),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }
  if (parsed.data.delta === 0) return { error: "Delta must be non-zero" };

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("customer_profiles")
    .select("loyalty_points, commission_pending_cents")
    .eq("user_id", parsed.data.user_id)
    .single();
  if (!profile) return { error: "Customer profile not found" };

  if (parsed.data.type === "points") {
    const newBalance = (profile.loyalty_points || 0) + parsed.data.delta;
    if (newBalance < 0) return { error: "Cannot go below 0 points" };

    await supabase.from("loyalty_transactions").insert({
      user_id: parsed.data.user_id,
      type: "admin_adjustment",
      points: parsed.data.delta,
      description: `Adjustment by ${me.email} — ${parsed.data.note}`,
    });

    await supabase
      .from("customer_profiles")
      .update({ loyalty_points: newBalance })
      .eq("user_id", parsed.data.user_id);
  } else {
    // commission adjustment (cents)
    const newBalance = (profile.commission_pending_cents || 0) + parsed.data.delta;
    if (newBalance < 0) return { error: "Cannot go below 0 commission" };

    await supabase.from("loyalty_transactions").insert({
      user_id: parsed.data.user_id,
      type: "admin_adjustment",
      commission_cents: parsed.data.delta,
      description: `Adjustment by ${me.email} — ${parsed.data.note}`,
    });

    await supabase
      .from("customer_profiles")
      .update({ commission_pending_cents: newBalance })
      .eq("user_id", parsed.data.user_id);
  }

  revalidatePath("/admin/loyalty");
  revalidatePath(`/admin/loyalty/${parsed.data.user_id}`);
  return { success: true };
}
