"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadImage } from "@/lib/storage/upload";
import { z } from "zod";

const RequestSchema = z.object({
  amount_dollars: z.number().min(1),
  payout_type: z.enum(["stripe", "credit"]),
  notes: z.string().max(500).optional().nullable(),
});

/** Customer requests a payout. If 'stripe' type, W9 file must already be on
 *  file (uploaded separately) OR be in this request. */
export async function requestPayout(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  const parsed = RequestSchema.safeParse({
    amount_dollars: parseFloat(String(formData.get("amount_dollars") || "0")),
    payout_type: String(formData.get("payout_type") || "credit"),
    notes: (formData.get("notes") as string) || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("customer_profiles")
    .select("commission_pending_cents, w9_url")
    .eq("user_id", user.id)
    .single();
  if (!profile) return { error: "Profile not found" };

  const amountCents = Math.round(parsed.data.amount_dollars * 100);
  if (amountCents > profile.commission_pending_cents) {
    return {
      error: `You only have $${(profile.commission_pending_cents / 100).toFixed(2)} pending — can't request more`,
    };
  }

  // For Stripe type, need W9 on file
  let w9UrlForRequest: string | null = profile.w9_url || null;
  const w9File = formData.get("w9_file") as File | null;
  if (parsed.data.payout_type === "stripe") {
    if (w9File && w9File.size > 0) {
      // Upload new W9 to PRIVATE bucket. The returned `url` is actually the
      // storage path — view it via getSignedUrl() server-side.
      const r = await uploadImage({
        bucket: "w9-forms",
        file: w9File,
        pathPrefix: user.id,  // path = {user_id}/w9_<ts>.pdf (matches RLS policy)
        filenameHint: "w9",
      });
      if ("error" in r) return { error: r.error };
      w9UrlForRequest = r.path;  // store the path, not a public URL
      const currentYear = new Date().getFullYear();
      await admin
        .from("customer_profiles")
        .update({
          w9_url: r.path,
          w9_uploaded_at: new Date().toISOString(),
          w9_tax_year: currentYear,
        })
        .eq("user_id", user.id);
    } else if (!w9UrlForRequest) {
      return { error: "W9 form required for cash payouts — please upload" };
    }
  }

  // Check no pending request already for this user (1 pending at a time)
  const { data: existing } = await admin
    .from("payout_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) {
    return { error: "You already have a pending payout request. Wait for admin to process it." };
  }

  const { error } = await admin.from("payout_requests").insert({
    user_id: user.id,
    amount_cents: amountCents,
    payout_type: parsed.data.payout_type,
    status: "pending",
    w9_url: parsed.data.payout_type === "stripe" ? w9UrlForRequest : null,
    customer_notes: parsed.data.notes,
  });
  if (error) return { error: error.message };

  revalidatePath("/portal/referrals");
  return { success: true };
}

/** Customer cancels their own pending request */
export async function cancelPayoutRequest(requestId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("payout_requests")
    .select("user_id, status")
    .eq("id", requestId)
    .single();
  if (!req) return { error: "Not found" };
  if (req.user_id !== user.id) return { error: "Not yours" };
  if (req.status !== "pending") return { error: "Can only cancel pending requests" };

  const { error } = await admin
    .from("payout_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId);
  if (error) return { error: error.message };

  revalidatePath("/portal/referrals");
  return { success: true };
}
