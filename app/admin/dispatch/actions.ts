"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffOrAdmin, requireDriverOrAbove } from "@/lib/auth/roles";
import { z } from "zod";

const CreateRouteSchema = z.object({
  route_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vehicle_id: z.string().uuid(),
  trailer_id: z.string().uuid().optional().nullable(),
  driver_name: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  route_type: z.enum(["delivery", "pickup"]).default("delivery"),
});

export async function createRoute(formData: FormData) {
  await requireStaffOrAdmin();
  const parsed = CreateRouteSchema.safeParse({
    route_date: String(formData.get("route_date") || ""),
    vehicle_id: String(formData.get("vehicle_id") || ""),
    trailer_id: (formData.get("trailer_id") as string) || null,
    driver_name: (formData.get("driver_name") as string) || null,
    notes: (formData.get("notes") as string) || null,
    route_type: (formData.get("route_type") as string) || "delivery",
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
      route_type: parsed.data.route_type,
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

  // Get target route_type so we only remove SAME-TYPE existing stops
  const { data: targetRoute } = await supabase
    .from("dispatch_routes")
    .select("route_type")
    .eq("id", routeId)
    .single();
  if (!targetRoute) return { error: "Route not found" };
  const targetType = targetRoute.route_type;

  // Find existing stops for this booking + their route_type
  const { data: existingStops } = await supabase
    .from("dispatch_stops")
    .select("id, dispatch_routes!inner(route_type)")
    .eq("booking_id", bookingId);

  const sameTypeIds = ((existingStops as any[]) || [])
    .filter((s) => s.dispatch_routes?.route_type === targetType)
    .map((s) => s.id);
  if (sameTypeIds.length > 0) {
    await supabase.from("dispatch_stops").delete().in("id", sameTypeIds);
  }

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

/** Unassign from ONE route — pass routeId to remove only that specific stop.
 *  If routeId omitted, removes ALL stops for the booking (any type). */
export async function unassignBookingFromRoute(
  bookingId: string,
  routeDate: string,
  routeId?: string,
) {
  await requireStaffOrAdmin();
  const supabase = createAdminClient();
  let query = supabase.from("dispatch_stops").delete().eq("booking_id", bookingId);
  if (routeId) query = query.eq("route_id", routeId);
  const { error } = await query;
  if (error) return { error: error.message };
  revalidatePath(`/admin/dispatch/${routeDate}`);
  return { success: true };
}

export async function markStopDelivered(stopId: string, routeId: string) {
  await requireDriverOrAbove();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("dispatch_stops")
    .update({ delivered_at: new Date().toISOString() })
    .eq("id", stopId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/dispatch/route/${routeId}`);
  return { success: true };
}

export async function clearStopDelivered(stopId: string, routeId: string) {
  await requireDriverOrAbove();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("dispatch_stops")
    .update({ delivered_at: null })
    .eq("id", stopId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/dispatch/route/${routeId}`);
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
