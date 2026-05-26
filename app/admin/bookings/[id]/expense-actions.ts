"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";

const ExpenseInput = z.object({
  booking_id: z.string().uuid(),
  // Dynamic key from booking_expense_categories (guard against tampering —
  // the form dropdown only shows active rows)
  category: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/),
  description: z.string().max(500).optional().nullable(),
  amount_dollars: z.number().min(0),
  driver_hours: z.number().min(0).max(48).optional().nullable(),
  driver_email: z.string().email().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

function parseForm(formData: FormData) {
  const driverHoursStr = String(formData.get("driver_hours") || "").trim();
  const driverEmail = String(formData.get("driver_email") || "").trim();
  return {
    booking_id: String(formData.get("booking_id") || ""),
    category: String(formData.get("category") || "other") as any,
    description: String(formData.get("description") || "") || null,
    amount_dollars: parseFloat(String(formData.get("amount_dollars") || "0")) || 0,
    driver_hours: driverHoursStr ? parseFloat(driverHoursStr) : null,
    driver_email: driverEmail || null,
    notes: (formData.get("notes") as string) || null,
  };
}

export async function addBookingExpense(formData: FormData) {
  const me = await requireAdmin();
  const parsed = ExpenseInput.safeParse(parseForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }
  const supabase = createAdminClient();
  const row = {
    booking_id: parsed.data.booking_id,
    category: parsed.data.category,
    description: parsed.data.description,
    amount_cents: Math.round(parsed.data.amount_dollars * 100),
    driver_hours: parsed.data.driver_hours,
    driver_email: parsed.data.driver_email,
    notes: parsed.data.notes,
    recorded_by: me.email || "unknown",
  };
  const { data: inserted, error } = await supabase
    .from("booking_expenses")
    .insert(row)
    .select("id")
    .single();
  if (error) return { error: error.message };
  await logAuditEvent({
    userEmail: me.email || "unknown",
    action: `expense.${parsed.data.category}`,
    entityType: "booking",
    entityId: parsed.data.booking_id,
    details: {
      expense_id: inserted?.id,
      amount_cents: row.amount_cents,
      driver_hours: row.driver_hours,
      driver_email: row.driver_email,
    },
  });
  revalidatePath(`/admin/bookings/${parsed.data.booking_id}`);
  return { success: true };
}

export async function deleteBookingExpense(expenseId: string, bookingId: string) {
  const me = await requireAdmin();
  const supabase = createAdminClient();
  const { data: expense } = await supabase
    .from("booking_expenses")
    .select("category, amount_cents")
    .eq("id", expenseId)
    .single();
  const { error } = await supabase.from("booking_expenses").delete().eq("id", expenseId);
  if (error) return { error: error.message };
  await logAuditEvent({
    userEmail: me.email || "unknown",
    action: "expense.deleted",
    entityType: "booking",
    entityId: bookingId,
    details: {
      expense_id: expenseId,
      category: expense?.category,
      amount_cents: expense?.amount_cents,
    },
  });
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { success: true };
}
