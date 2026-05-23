// DELETE /api/bookings/release-hold
// Body: { hold_id }
// Releases a pending_payment hold (cancels the booking) so the slot opens up again.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BodySchema = z.object({ hold_id: z.string().uuid() });

export async function DELETE(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid hold_id" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, booking_status")
    .eq("id", parsed.data.hold_id)
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: "Hold not found" }, { status: 404 });
  }

  if (booking.booking_status !== "pending_payment") {
    return NextResponse.json(
      { error: "Cannot release — booking is not in pending_payment state" },
      { status: 409 }
    );
  }

  await supabase
    .from("bookings")
    .update({ booking_status: "cancelled" })
    .eq("id", booking.id);

  return NextResponse.json({ success: true });
}
