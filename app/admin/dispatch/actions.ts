"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffOrAdmin } from "@/lib/auth/roles";
import { z } from "zod";

const CreateRouteSchema = z.object({
  route_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vehicle_id: z.string().uuid(),
  trailer_id: z.string().uuid().optional().nullable(),
  driver_name: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function createRoute(formData: FormData) {
  await requireStaffOrAdmin();
  const parsed = CreateRouteSchema.safeParse({
    route_date: String(formData.get("route_date") || ""),
    vehicle_id: String(formData.get("vehicle_id") || ""),
    trailer_id: (formData.get("trailer_id") as string) || null,
    driver_name: (formData.get("driver_name") as string) || null,
    notes: (formData.get("notes") as string) || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const supabase = createAdminClient();
  const { data: route, error } = await supabase
    .from("dispatch_routes")
    .insert({
      route_date: parsed.data.route_date,
      vehicle_id: parsed.data.vehicle_id,
      trailer_id: parsed.data.trailer_id,
      driver_name: parsed.data.driver_name,
      notes: parsed.data.notes,
      status: "planned",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath(`/admin/dispatch/${parsed.data.route_date}`);
  return { success: true, route_id: route?.id };
}

export async function deleteRoute(routeId: string, routeDate: string) {
  await requireStaffOrAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("dispatch_routes").delete().eq("id", routeId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/dispatch/${routeDate}`);
  return { success: true };
}

export async function updateRouteStatus(routeId: string, routeDate: string, status: string) {
  await requireStaffOrAdmin();
  const valid = ["planned", "loaded", "out", "completed", "cancelled"];
  if (!valid.includes(status)) return { error: "Invalid status" };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("dispatch_routes")
    .update({ status })
    .eq("id", routeId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/dispatch/${routeDate}`);
  return { success: true };
}

export async function assignBookingToRoute(
  bookingId: string,
  routeId: string,
  routeDate: string,
) {
  await requireStaffOrAdmin();
  const supabase = createAdminClient();

  // Remove from any existing route first (unique on booking_id)
  await supabase.from("dispatch_stops").delete().eq("booking_id", bookingId);

  // Get the max order in this route + 1
  const { data: maxRow } = await supabase
    .from("dispatch_stops")
    .select("stop_order")
    .eq("route_id", routeId)
    .order("stop_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.stop_order ?? -1) + 1;

  const { error } = await supabase.from("dispatch_stops").insert({
    route_id: routeId,
    booking_id: bookingId,
    stop_order: nextOrder,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/dispatch/${routeDate}`);
  return { success: true };
}

export async function unassignBookingFromRoute(bookingId: string, routeDate: string) {
  await requireStaffOrAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("dispatch_stops").delete().eq("booking_id", bookingId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/dispatch/${routeDate}`);
  return { success: true };
}

export async function reorderStop(
  stopId: string,
  direction: "up" | "down",
  routeId: string,
  routeDate: string,
) {
  await requireStaffOrAdmin();
  const supabase = createAdminClient();

  const { data: stops } = await supabase
    .from("dispatch_stops")
    .select("id, stop_order")
    .eq("route_id", routeId)
    .order("stop_order");
  if (!stops || stops.length < 2) return { success: true };

  const idx = stops.findIndex((s: any) => s.id === stopId);
  if (idx === -1) return { error: "Stop not found" };
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= stops.length) return { success: true };

  const a = stops[idx] as any;
  const b = stops[swapIdx] as any;
  await supabase.from("dispatch_stops").update({ stop_order: b.stop_order }).eq("id", a.id);
  await supabase.from("dispatch_stops").update({ stop_order: a.stop_order }).eq("id", b.id);

  revalidatePath(`/admin/dispatch/${routeDate}`);
  return { success: true };
}
