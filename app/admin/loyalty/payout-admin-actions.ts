"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { sendTemplated } from "@/lib/email/send-template";
import { isEmailConfigured } from "@/lib/email/send";
import { getSignedUrl } from "@/lib/storage/upload";

/** Admin-only: returns a time-limited signed URL to view a W9 in the private bucket.
 *  Path is stored in payout_requests.w9_url / customer_profiles.w9_url. */
export async function getW9SignedUrl(requestId: string): Promise<{ url?: string; error?: string }> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: req } = await supabase
    .from("payout_requests")
    .select("w9_url")
    .eq("id", requestId)
    .single();
  if (!req?.w9_url) return { error: "No W9 on file" };
  const url = await getSignedUrl("w9-forms", req.w9_url, 600); // 10 min
  if (!url) return { error: "Could not generate signed URL" };
  return { url };
}

/** Admin approves a payout request.
 *  - credit type: auto-issues a gift card with the amount, decrements
 *    commission_pending, increments commission_paid, emails recipient
 *  - stripe type: marks approved; admin processes externally then calls
 *    markPayoutProcessed
 */
export async function approvePayoutRequest(requestId: string, adminNotes?: string) {
  const me = await requireAdmin();
  const supabase = createAdminClient();

  const { data: req } = await supabase
    .from("payout_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (!req) return { error: "Request not found" };
  if (req.status !== "pending") return { error: "Already processed" };

  // Verify commission balance is still sufficient
  const { data: profile } = await supabase
    .from("customer_profiles")
    .select("commission_pending_cents, commission_paid_cents")
    .eq("user_id", req.user_id)
    .single();
  if (!profile) return { error: "Profile not found" };
  if (req.amount_cents > profile.commission_pending_cents) {
    return {
      error: `Customer's pending commission is now $${(profile.commission_pending_cents / 100).toFixed(2)} — less than requested $${(req.amount_cents / 100).toFixed(2)}. Reject and ask customer to re-request.`,
    };
  }

  // Get customer email + name for gift card / Stripe notification
  const { data: userRes } = await supabase.auth.admin.getUserById(req.user_id);
  const customerEmail = userRes?.user?.email;
  const meta = (userRes?.user?.user_metadata as any) || {};
  if (!customerEmail) return { error: "Could not load customer email" };

  if (req.payout_type === "credit") {
    // Auto-issue gift card
    const { data: codeRow } = await supabase.rpc("generate_gift_card_code");
    const code = codeRow as string;
    if (!code) return { error: "Failed to generate gift card code" };

    const { data: card, error: cardErr } = await supabase
      .from("gift_cards")
      .insert({
        code,
        original_amount_cents: req.amount_cents,
        balance_cents: req.amount_cents,
        recipient_email: customerEmail,
        recipient_name: `${meta.first_name || ""} ${meta.last_name || ""}`.trim() || customerEmail,
        purchaser_name: "It's Always Fun (commission payout)",
        message: `Your commission payout as a credit toward your next rental. Code is single-use until exhausted.`,
        is_active: true,
      })
      .select("id, code")
      .single();
    if (cardErr) return { error: `Gift card creation failed: ${cardErr.message}` };

    // Update payout request
    await supabase
      .from("payout_requests")
      .update({
        status: "processed",
        approved_at: new Date().toISOString(),
        approved_by: me.email,
        processed_at: new Date().toISOString(),
        linked_gift_card_id: card.id,
        admin_notes: adminNotes || null,
      })
      .eq("id", requestId);

    // Move money from pending → paid + log ledger entry
    await supabase
      .from("customer_profiles")
      .update({
        commission_pending_cents: profile.commission_pending_cents - req.amount_cents,
        commission_paid_cents: profile.commission_paid_cents + req.amount_cents,
      })
      .eq("user_id", req.user_id);

    await supabase.from("loyalty_transactions").insert({
      user_id: req.user_id,
      type: "commission_payout",
      commission_cents: -req.amount_cents,
      description: `Payout via gift card ${code} (approved by ${me.email})`,
    });

    // Email customer the gift card
    if (isEmailConfigured()) {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "https://itsalwaysfun-rental.vercel.app";
      await sendTemplated({
        key: "gift_card_received",
        to: customerEmail,
        vars: {
          recipientName: meta.first_name || "there",
          purchaserName: "It's Always Fun",
          amount: (req.amount_cents / 100).toFixed(2),
          code: card.code,
          message: `This is your commission payout as a rental credit. Apply it at checkout when you book your next rental.`,
          bookingUrl: `${baseUrl}/order-by-date`,
          expiresAt: "",
        },
        fallback: () => ({
          subject: `🎁 Your $${(req.amount_cents / 100).toFixed(2)} commission credit is here!`,
          html: `<p>Hi ${meta.first_name || "there"},</p>
<p>Your commission payout has been issued as a gift card credit. Use it at checkout for any future rental.</p>
<p>Code: <strong style="font-family:monospace;font-size:18px;background:#FFD700;padding:6px 12px;border-radius:4px;">${card.code}</strong></p>
<p>Balance: <strong>$${(req.amount_cents / 100).toFixed(2)}</strong></p>
<p>Book at <a href="${baseUrl}/order-by-date">${baseUrl}/order-by-date</a> — enter the code in the 🎁 field at checkout.</p>
<p>— The It's Always Fun team</p>`,
          text: `Your commission credit: ${card.code} ($${(req.amount_cents / 100).toFixed(2)})\nUse it at ${baseUrl}/order-by-date`,
        }),
        tags: [{ name: "type", value: "commission_credit_issued" }],
      });
    }

    revalidatePath("/admin/loyalty");
    revalidatePath(`/admin/loyalty/${req.user_id}`);
    return { success: true, type: "credit_issued", code: card.code };
  } else {
    // Stripe / cash payout — mark approved, admin processes externally
    await supabase
      .from("payout_requests")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: me.email,
        admin_notes: adminNotes || null,
      })
      .eq("id", requestId);

    revalidatePath("/admin/loyalty");
    return {
      success: true,
      type: "approved_pending_payment",
      message: "Approved — process the payment externally then mark as paid",
    };
  }
}

/** After admin sent the Stripe/Venmo/Zelle payment, mark request as processed
 *  and move commission balance. */
export async function markPayoutProcessed(requestId: string, paymentNote: string) {
  const me = await requireAdmin();
  const supabase = createAdminClient();

  const { data: req } = await supabase
    .from("payout_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (!req) return { error: "Request not found" };
  if (req.status !== "approved") return { error: "Not in approved status" };

  const { data: profile } = await supabase
    .from("customer_profiles")
    .select("commission_pending_cents, commission_paid_cents")
    .eq("user_id", req.user_id)
    .single();
  if (!profile) return { error: "Profile not found" };

  await supabase
    .from("payout_requests")
    .update({
      status: "processed",
      processed_at: new Date().toISOString(),
      admin_notes: paymentNote
        ? `${req.admin_notes || ""}\nPaid: ${paymentNote}`.trim()
        : req.admin_notes,
    })
    .eq("id", requestId);

  await supabase
    .from("customer_profiles")
    .update({
      commission_pending_cents: Math.max(0, profile.commission_pending_cents - req.amount_cents),
      commission_paid_cents: profile.commission_paid_cents + req.amount_cents,
    })
    .eq("user_id", req.user_id);

  await supabase.from("loyalty_transactions").insert({
    user_id: req.user_id,
    type: "commission_payout",
    commission_cents: -req.amount_cents,
    description: `Cash payout (${paymentNote || "Stripe/Venmo/Zelle"}) — approved by ${me.email}`,
  });

  revalidatePath("/admin/loyalty");
  revalidatePath(`/admin/loyalty/${req.user_id}`);
  return { success: true };
}

export async function rejectPayoutRequest(requestId: string, reason: string) {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: req } = await supabase
    .from("payout_requests")
    .select("status")
    .eq("id", requestId)
    .single();
  if (!req) return { error: "Not found" };
  if (req.status !== "pending") return { error: "Already processed" };

  const { error } = await supabase
    .from("payout_requests")
    .update({
      status: "rejected",
      rejected_at: new Date().toISOString(),
      rejected_reason: reason,
    })
    .eq("id", requestId);
  if (error) return { error: error.message };

  revalidatePath("/admin/loyalty");
  return { success: true };
}
