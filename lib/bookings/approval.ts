// Approval workflow for high-ticket bookings.
//
// When a tenant sets `tenants.approval_threshold_cents` to a value, any
// CUSTOMER-INITIATED booking (NOT admin-created) whose total_amount exceeds
// the threshold lands in `approval_status='pending'` instead of going to
// the normal confirmed flow:
//   - Stripe charge is captured (the customer DID pay)
//   - But the booking sits as pending until an admin approves or rejects
//   - sendBookingConfirmation is SKIPPED until approved
//   - If rejected, the admin can refund manually
//
// Admin-created bookings (from /admin/bookings/new) bypass approval entirely
// — the operator already approved by creating it.

import { createAdminClient } from "@/lib/supabase/admin";

export interface ApprovalCheckResult {
  required: boolean;
  thresholdCents: number | null;
  totalCents: number;
}

/** Check whether a booking total triggers the approval workflow.
 *  Returns required=true only if tenant has a threshold AND booking
 *  total >= threshold. */
export async function shouldRequireApproval(args: {
  tenantId: string | null;
  totalCents: number;
  source: "customer" | "admin"; // admin path bypasses
}): Promise<ApprovalCheckResult> {
  if (args.source === "admin" || !args.tenantId) {
    return { required: false, thresholdCents: null, totalCents: args.totalCents };
  }
  const supabase = createAdminClient({ unscoped: true });
  const { data: t } = await supabase
    .from("tenants")
    .select("approval_threshold_cents")
    .eq("id", args.tenantId)
    .maybeSingle();
  const threshold = (t as { approval_threshold_cents: number | null } | null)
    ?.approval_threshold_cents ?? null;
  if (threshold == null || threshold <= 0) {
    return { required: false, thresholdCents: null, totalCents: args.totalCents };
  }
  return {
    required: args.totalCents >= threshold,
    thresholdCents: threshold,
    totalCents: args.totalCents,
  };
}

/** Mark a booking as pending approval. Called from the Stripe webhook /
 *  paid-by-cash flow once the payment is confirmed. */
export async function markBookingPendingApproval(
  bookingId: string,
): Promise<void> {
  const supabase = createAdminClient({ unscoped: true });
  await supabase
    .from("bookings")
    .update({
      approval_status: "pending",
      approval_requested_at: new Date().toISOString(),
    })
    .eq("id", bookingId);
}

export interface ApprovalDecisionInput {
  bookingId: string;
  decidedByEmail: string;
  notes?: string;
}

/** Approve a pending booking. Returns the row so the caller can fire
 *  the confirmation email + downstream effects. */
export async function approveBooking(
  input: ApprovalDecisionInput,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient({ unscoped: true });
  const { error } = await supabase
    .from("bookings")
    .update({
      approval_status: "approved",
      approval_decided_at: new Date().toISOString(),
      approval_decided_by: input.decidedByEmail,
      approval_notes: input.notes || null,
    })
    .eq("id", input.bookingId)
    .eq("approval_status", "pending"); // idempotency: only flip pending → approved
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Reject a pending booking. Does NOT refund automatically — the operator
 *  follows up via the standard refund path. */
export async function rejectBooking(
  input: ApprovalDecisionInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!input.notes || input.notes.trim().length < 3) {
    return { ok: false, error: "Rejection requires a reason (notes)." };
  }
  const supabase = createAdminClient({ unscoped: true });
  const { error } = await supabase
    .from("bookings")
    .update({
      approval_status: "rejected",
      approval_decided_at: new Date().toISOString(),
      approval_decided_by: input.decidedByEmail,
      approval_notes: input.notes,
    })
    .eq("id", input.bookingId)
    .eq("approval_status", "pending");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
