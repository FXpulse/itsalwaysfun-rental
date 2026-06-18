"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaffOrAdmin } from "@/lib/auth/roles";
import { approveBooking, rejectBooking } from "@/lib/bookings/approval";
import { sendBookingConfirmation } from "@/lib/email/scheduled-emails";

const DecisionSchema = z.object({
  bookingId: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

export async function approveBookingAction(
  input: z.infer<typeof DecisionSchema>,
): Promise<{ success: true } | { error: string }> {
  const me = await requireStaffOrAdmin();
  const parsed = DecisionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input" };

  const r = await approveBooking({
    bookingId: parsed.data.bookingId,
    decidedByEmail: me.email || "unknown",
    notes: parsed.data.notes,
  });
  if (!r.ok) return { error: r.error || "Approval failed" };

  // Fire the confirmation email NOW (was held back when booking went pending).
  // Best-effort — failure here doesn't block approval since the row is updated.
  try {
    await sendBookingConfirmation(parsed.data.bookingId);
  } catch (e) {
    console.error("[approval] confirmation email failed", e);
  }

  revalidatePath(`/admin/bookings/${parsed.data.bookingId}`);
  revalidatePath("/admin/bookings");
  return { success: true };
}

const RejectSchema = z.object({
  bookingId: z.string().uuid(),
  notes: z.string().min(3, "Reason required").max(500),
});

export async function rejectBookingAction(
  input: z.infer<typeof RejectSchema>,
): Promise<{ success: true } | { error: string }> {
  const me = await requireStaffOrAdmin();
  const parsed = RejectSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Reason required" };

  const r = await rejectBooking({
    bookingId: parsed.data.bookingId,
    decidedByEmail: me.email || "unknown",
    notes: parsed.data.notes,
  });
  if (!r.ok) return { error: r.error || "Rejection failed" };

  revalidatePath(`/admin/bookings/${parsed.data.bookingId}`);
  revalidatePath("/admin/bookings");
  return { success: true };
}
