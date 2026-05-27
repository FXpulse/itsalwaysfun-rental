"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendBookingCancelled } from "@/lib/email/booking-lifecycle";
import { sendTemplated } from "@/lib/email/send-template";
import { isEmailConfigured } from "@/lib/email/send";
import { getTenantBusinessName } from "@/lib/tenant/business";
import { z } from "zod";

const CUTOFF_HOURS = 48;

/** Returns the booking if the current user owns it (email match). */
async function loadOwnBooking(bookingId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    throw new Error("Not authenticated");
  }

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();
  if (!booking) {
    throw new Error("Booking not found");
  }
  if (booking.customer_email.toLowerCase() !== user.email.toLowerCase()) {
    throw new Error("Not your booking");
  }
  return { user, admin, booking };
}

/** Returns hours until event start. start_time defaults to 09:00 if unset. */
function hoursUntilEvent(b: { event_date: string; start_time: string | null }): number {
  const time = b.start_time || "09:00:00";
  const eventDt = new Date(`${b.event_date}T${time}`);
  return (eventDt.getTime() - Date.now()) / (1000 * 60 * 60);
}

/** Customer confirms event details — sets customer_confirmed_at. */
export async function confirmBookingByCustomer(bookingId: string) {
  try {
    const { admin, booking } = await loadOwnBooking(bookingId);

    if (booking.booking_status === "cancelled") {
      return { error: "Booking is cancelled" };
    }
    if (booking.customer_confirmed_at) {
      return { success: true, alreadyConfirmed: true };
    }

    const { error } = await admin
      .from("bookings")
      .update({ customer_confirmed_at: new Date().toISOString() })
      .eq("id", bookingId);
    if (error) return { error: error.message };

    revalidatePath(`/portal/bookings/${bookingId}`);
    return { success: true };
  } catch (e: any) {
    return { error: e.message || "Failed to confirm" };
  }
}

const ModifyDateSchema = z.object({
  new_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  new_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

/** Customer changes the event date(s). Validates availability. */
export async function modifyBookingDate(bookingId: string, formData: FormData) {
  try {
    const parsed = ModifyDateSchema.safeParse({
      new_start_date: String(formData.get("new_start_date") || ""),
      new_end_date: String(formData.get("new_end_date") || "") || null,
    });
    if (!parsed.success) {
      return { error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const { admin, booking } = await loadOwnBooking(bookingId);

    if (booking.booking_status === "cancelled") {
      return { error: "Booking is cancelled — can't modify" };
    }

    if (hoursUntilEvent(booking) < CUTOFF_HOURS) {
      return {
        error: `Changes locked — event is less than ${CUTOFF_HOURS}h away. Call us at (904) 584-3047 if urgent.`,
      };
    }

    const newStart = parsed.data.new_start_date;
    const newEnd = parsed.data.new_end_date || newStart;

    if (newEnd < newStart) return { error: "End date must be on or after start date" };

    // Must be a future date (at least 48h out — give us setup time)
    const newEventDate = new Date(`${newStart}T${booking.start_time || "09:00:00"}`);
    if ((newEventDate.getTime() - Date.now()) / (1000 * 60 * 60) < CUTOFF_HOURS) {
      return { error: `New date must be at least ${CUTOFF_HOURS}h from now` };
    }

    // Availability check — for each day in the new range, count conflicts
    // (excluding THIS booking itself)
    function datesInRange(start: string, end: string): string[] {
      const out: string[] = [];
      const s = new Date(start + "T00:00:00");
      const e = new Date(end + "T00:00:00");
      const cur = new Date(s);
      while (cur <= e) {
        out.push(cur.toISOString().split("T")[0]);
        cur.setDate(cur.getDate() + 1);
      }
      return out;
    }
    const days = datesInRange(newStart, newEnd);
    if (days.length === 0 || days.length > 14) {
      return { error: "Date range must be 1–14 days" };
    }

    // Conflicts: blocked_dates + other active bookings for same product
    const { data: blocked } = await admin
      .from("blocked_dates")
      .select("blocked_date")
      .eq("product_id", booking.product_id)
      .in("blocked_date", days);
    if ((blocked || []).length > 0) {
      return {
        error: `Some days are blocked: ${(blocked as any[]).map((b) => b.blocked_date).join(", ")}`,
      };
    }

    const { data: otherBookings } = await admin
      .from("bookings")
      .select("id, event_date, event_end_date")
      .eq("product_id", booking.product_id)
      .in("booking_status", ["pending_payment", "confirmed", "delivered"])
      .neq("id", bookingId);

    for (const ob of (otherBookings as any[]) || []) {
      const obDays = datesInRange(ob.event_date, ob.event_end_date || ob.event_date);
      const overlap = obDays.some((d) => days.includes(d));
      if (overlap) {
        return {
          error: `Some days are already booked. Try different dates.`,
        };
      }
    }

    // Update
    const auditNote = `[${new Date().toISOString().split("T")[0]}] Date changed by customer from ${booking.event_date}${booking.event_end_date && booking.event_end_date !== booking.event_date ? `→${booking.event_end_date}` : ""} to ${newStart}${newEnd !== newStart ? `→${newEnd}` : ""}`;
    const newNotes = booking.notes ? `${booking.notes}\n${auditNote}` : auditNote;

    const { error } = await admin
      .from("bookings")
      .update({
        event_date: newStart,
        event_end_date: newEnd,
        notes: newNotes,
        // Clear customer_confirmed_at since they need to re-confirm new date
        customer_confirmed_at: null,
      })
      .eq("id", bookingId);
    if (error) return { error: error.message };

    revalidatePath(`/portal/bookings/${bookingId}`);
    revalidatePath(`/admin/bookings/${bookingId}`);
    return { success: true, new_event_date: newStart };
  } catch (e: any) {
    return { error: e.message || "Failed to modify date" };
  }
}

const CancelSchema = z.object({
  reason: z.string().max(500).optional().nullable(),
});

/** Customer cancels their own booking. */
export async function cancelBookingByCustomer(bookingId: string, formData: FormData) {
  try {
    const parsed = CancelSchema.safeParse({
      reason: String(formData.get("reason") || "") || null,
    });

    const { admin, booking } = await loadOwnBooking(bookingId);

    if (booking.booking_status === "cancelled") {
      return { error: "Already cancelled" };
    }

    if (hoursUntilEvent(booking) < CUTOFF_HOURS) {
      return {
        error: `Cancellation locked — event is less than ${CUTOFF_HOURS}h away. Call (904) 584-3047 if urgent.`,
      };
    }

    const reason = (parsed.success ? parsed.data.reason : null) || null;
    const auditNote = `[${new Date().toISOString().split("T")[0]}] Cancelled by customer${reason ? ` — ${reason}` : ""}`;
    const newNotes = booking.notes ? `${booking.notes}\n${auditNote}` : auditNote;

    const updates: any = {
      booking_status: "cancelled",
      notes: newNotes,
    };
    // If never paid, mark as failed so admin knows it wasn't refunded
    if (booking.stripe_payment_status === "pending") {
      updates.stripe_payment_status = "failed";
    }

    const { error } = await admin.from("bookings").update(updates).eq("id", bookingId);
    if (error) return { error: error.message };

    // Send cancellation email to customer
    try {
      await sendBookingCancelled(bookingId, reason);
    } catch (e) {
      console.error("[cancellation email failed, non-fatal]", e);
    }

    revalidatePath(`/portal/bookings/${bookingId}`);
    revalidatePath(`/portal/bookings`);
    revalidatePath(`/admin/bookings/${bookingId}`);
    return { success: true };
  } catch (e: any) {
    return { error: e.message || "Failed to cancel" };
  }
}

/** Weather cancellation: customer self-cancels close to event due to unsafe
 *  weather. Auto-issues a gift card for the paid amount (revenue preserved,
 *  customer can rebook). Different cutoff than regular cancellation (configurable,
 *  default 6h) since weather is decided last-minute. */
export async function cancelBookingDueToWeather(bookingId: string) {
  try {
    const { admin, booking } = await loadOwnBooking(bookingId);

    if (booking.booking_status === "cancelled") {
      return { error: "Already cancelled" };
    }

    // Load weather settings
    const { data: settingRows } = await admin
      .from("site_settings")
      .select("key, value")
      .in("key", ["weather_cancellation_enabled", "weather_cancellation_cutoff_hours"]);
    const settingMap = new Map(
      (settingRows as { key: string; value: string }[] | null || []).map((s) => [s.key, s.value]),
    );
    const enabled = (settingMap.get("weather_cancellation_enabled") || "true").toLowerCase() !== "false";
    if (!enabled) {
      return { error: "Weather cancellation is not available — call (904) 584-3047." };
    }
    const cutoff = parseInt(settingMap.get("weather_cancellation_cutoff_hours") || "6", 10) || 6;

    const hoursLeft = hoursUntilEvent(booking);
    if (hoursLeft < cutoff) {
      return {
        error: `Weather cancellation closes ${cutoff}h before event. You're inside that window — call (904) 584-3047.`,
      };
    }
    if (hoursLeft < 0) {
      return { error: "Event has already started" };
    }

    // Only paid bookings get a credit. Unpaid → just cancel.
    const paidCents = booking.stripe_payment_status === "paid" ? booking.total_amount : 0;
    if (paidCents <= 0) {
      // Just cancel without credit
      const auditNote = `[${new Date().toISOString().split("T")[0]}] Weather cancellation (no payment to credit)`;
      const newNotes = booking.notes ? `${booking.notes}\n${auditNote}` : auditNote;
      await admin
        .from("bookings")
        .update({
          booking_status: "cancelled",
          cancelled_due_to_weather: true,
          notes: newNotes,
        })
        .eq("id", bookingId);
      revalidatePath(`/portal/bookings/${bookingId}`);
      return { success: true, credited: false };
    }

    // Issue gift card for the paid amount (good for 1 year)
    const { data: codeRow } = await admin.rpc("generate_gift_card_code");
    const code = codeRow as string;
    if (!code) return { error: "Failed to generate credit code — try again or call us." };

    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    const { data: card, error: cardErr } = await admin
      .from("gift_cards")
      .insert({
        code,
        original_amount_cents: paidCents,
        balance_cents: paidCents,
        recipient_email: booking.customer_email,
        recipient_name: `${booking.customer_first_name} ${booking.customer_last_name}`.trim(),
        purchaser_name: `${(await getTenantBusinessName()) || "Rental Company"} (weather cancellation credit)`,
        message: `Credit for your ${booking.event_date} booking that was cancelled due to weather. Apply at checkout when you rebook.`,
        expires_at: oneYearFromNow.toISOString(),
        is_active: true,
      })
      .select("id, code")
      .single();
    if (cardErr || !card) {
      return { error: `Failed to issue credit: ${cardErr?.message}` };
    }

    // Update booking
    const auditNote = `[${new Date().toISOString().split("T")[0]}] Weather cancellation — gift card ${card.code} issued for $${(paidCents / 100).toFixed(2)}`;
    const newNotes = booking.notes ? `${booking.notes}\n${auditNote}` : auditNote;
    await admin
      .from("bookings")
      .update({
        booking_status: "cancelled",
        cancelled_due_to_weather: true,
        weather_credit_gift_card_id: card.id,
        weather_credit_cents: paidCents,
        notes: newNotes,
      })
      .eq("id", bookingId);

    // Email customer
    if (isEmailConfigured()) {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "https://itsalwaysfun-rental.vercel.app";
      const amountDollars = (paidCents / 100).toFixed(2);
      try {
        await sendTemplated({
          key: "weather_cancellation_credit",
          to: booking.customer_email,
          vars: {
            firstName: booking.customer_first_name,
            eventDate: booking.event_date,
            amount: amountDollars,
            code: card.code,
            expiresAt: oneYearFromNow.toLocaleDateString(),
            bookingUrl: `${baseUrl}/order-by-date`,
          },
          fallback: () => ({
            subject: `Weather credit issued — $${amountDollars} for ${booking.event_date}`,
            html: `<p>Hi ${booking.customer_first_name},</p>
<p>Sorry the weather isn't cooperating for your ${booking.event_date} booking. We've cancelled it and issued you a gift card credit:</p>
<p>Code: <strong style="font-family:monospace;font-size:18px;background:#FFD700;padding:6px 12px;border-radius:4px;">${card.code}</strong></p>
<p>Amount: <strong>$${amountDollars}</strong> · Expires: ${oneYearFromNow.toLocaleDateString()}</p>
<p>Use it at checkout when you rebook: <a href="${baseUrl}/order-by-date">${baseUrl}/order-by-date</a></p>
<p>Stay safe — we look forward to setting you up on a better day.</p>
<p>— Your rental team</p>`,
            text: `Weather credit: ${card.code} ($${amountDollars}) — valid 1 year. Use at ${baseUrl}/order-by-date`,
          }),
          tags: [{ name: "type", value: "weather_cancellation_credit" }],
        });
      } catch (e) {
        console.error("[weather credit email failed, non-fatal]", e);
      }
    }

    revalidatePath(`/portal/bookings/${bookingId}`);
    revalidatePath(`/portal/bookings`);
    revalidatePath(`/admin/bookings/${bookingId}`);
    return { success: true, credited: true, code: card.code, amount_cents: paidCents };
  } catch (e: any) {
    return { error: e.message || "Failed to cancel" };
  }
}
