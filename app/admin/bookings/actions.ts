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

const BookingStatusSchema = z.enum([
  "pending_payment",
  "confirmed",
  "delivered",
  "completed",
  "cancelled",
]);

export async function updateBookingStatus(bookingId: string, newStatus: string) {
  const user = await requireAdmin();
  const parsed = BookingStatusSchema.safeParse(newStatus);
  if (!parsed.success) {
    return { error: "Invalid status" };
  }
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bookings")
    .update({ booking_status: parsed.data })
    .eq("id", bookingId);
  if (error) return { error: error.message };
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { success: true };
}

const PaymentMethodSchema = z.enum(["cash", "venmo", "zelle", "check", "other"]);

/** Mark a booking as manually paid (cash/Venmo/Zelle/check/other). */
export async function markAsPaidManually(
  bookingId: string,
  method: string,
  note: string,
) {
  const user = await requireAdmin();
  const parsed = PaymentMethodSchema.safeParse(method);
  if (!parsed.success) return { error: "Invalid payment method" };

  const supabase = createAdminClient();

  // Build a note line so audit trail is preserved
  const { data: existing } = await supabase
    .from("bookings")
    .select("notes")
    .eq("id", bookingId)
    .single();

  const paidNote = `[${new Date().toISOString().split("T")[0]}] Marked paid (${parsed.data}) by ${user.email}${note ? ` — ${note}` : ""}`;
  const newNotes = existing?.notes ? `${existing.notes}\n${paidNote}` : paidNote;

  const { error } = await supabase
    .from("bookings")
    .update({
      stripe_payment_status: "paid",
      booking_status: "confirmed",
      payment_method: parsed.data,
      notes: newNotes,
    })
    .eq("id", bookingId);

  if (error) return { error: error.message };
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { success: true };
}

export async function updateBookingNotes(bookingId: string, notes: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bookings")
    .update({ notes })
    .eq("id", bookingId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { success: true };
}

const NewBookingSchema = z.object({
  product_id: z.string().uuid(),
  customer_first_name: z.string().min(1),
  customer_last_name: z.string().min(1),
  customer_email: z.string().email(),
  customer_phone: z.string().min(1),
  customer_address: z.string().optional().nullable(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().optional().nullable(),
  end_time: z.string().optional().nullable(),
  total_amount_dollars: z.number().int().min(0),
  payment_method: z.enum(["cash", "venmo", "zelle", "check", "other", "none"]),
  booking_status: z.enum(["pending_payment", "confirmed", "delivered", "completed"]),
  notes: z.string().optional().nullable(),
});

export async function createManualBooking(formData: FormData) {
  const user = await requireAdmin();

  const raw = {
    product_id: String(formData.get("product_id") || ""),
    customer_first_name: String(formData.get("customer_first_name") || ""),
    customer_last_name: String(formData.get("customer_last_name") || ""),
    customer_email: String(formData.get("customer_email") || ""),
    customer_phone: String(formData.get("customer_phone") || ""),
    customer_address: String(formData.get("customer_address") || "") || null,
    event_date: String(formData.get("event_date") || ""),
    start_time: String(formData.get("start_time") || "") || null,
    end_time: String(formData.get("end_time") || "") || null,
    total_amount_dollars: parseInt(String(formData.get("total_amount_dollars") || "0"), 10),
    payment_method: String(formData.get("payment_method") || "none") as any,
    booking_status: String(formData.get("booking_status") || "confirmed") as any,
    notes: String(formData.get("notes") || "") || null,
  };

  const parsed = NewBookingSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ") };
  }

  const supabase = createAdminClient();

  // Get product name
  const { data: product } = await supabase
    .from("products")
    .select("name")
    .eq("id", parsed.data.product_id)
    .single();
  if (!product) return { error: "Product not found" };

  // Determine stripe_payment_status from payment_method
  const stripe_payment_status =
    parsed.data.payment_method === "none" ? "pending" : "paid";

  const auditNote = `[${new Date().toISOString().split("T")[0]}] Created manually by ${user.email} (${parsed.data.payment_method})`;
  const finalNotes = parsed.data.notes
    ? `${parsed.data.notes}\n${auditNote}`
    : auditNote;

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      customer_first_name: parsed.data.customer_first_name,
      customer_last_name: parsed.data.customer_last_name,
      customer_email: parsed.data.customer_email,
      customer_phone: parsed.data.customer_phone,
      customer_address: parsed.data.customer_address,
      event_date: parsed.data.event_date,
      start_time: parsed.data.start_time,
      end_time: parsed.data.end_time,
      product_id: parsed.data.product_id,
      product_name: product.name,
      total_amount: parsed.data.total_amount_dollars * 100,
      stripe_payment_status,
      booking_status: parsed.data.booking_status,
      payment_method: parsed.data.payment_method,
      notes: finalNotes,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/admin/bookings");
  return { success: true, booking_id: booking?.id };
}
