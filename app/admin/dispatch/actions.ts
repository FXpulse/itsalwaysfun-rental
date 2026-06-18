"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffOrAdmin, requireDriverOrAbove } from "@/lib/auth/roles";
import { z } from "zod";

// ── Per-unit dispatch assignment ─────────────────────────────────
/** Assign physical inventory units to a route. Replaces any prior assignment
 *  for these units (unassigns from old routes if any). */
export async function assignUnitsToRoute(routeId: string, unitIds: string[]) {
  const me = await requireStaffOrAdmin();
  if (unitIds.length === 0) return { success: true, count: 0 };
  const supabase = createAdminClient();

  // Verify route exists + get date for revalidation
  const { data: route } = await supabase
    .from("dispatch_routes")
    .select("id, route_date")
    .eq("id", routeId)
    .single();
  if (!route) return { error: "Route not found" };

  // Find any existing active assignments for these units on OTHER routes,
  // mark them as returned (clean handoff)
  await supabase
    .from("dispatch_route_units")
    .update({ returned_at: new Date().toISOString(), return_condition: "good" })
    .in("unit_id", unitIds)
    .is("returned_at", null)
    .neq("route_id", routeId);

  // Insert new assignments (upsert ignores duplicates on (route_id, unit_id))
  const rows = unitIds.map((unit_id) => ({
    route_id: routeId,
    unit_id,
    assigned_by: me.email,
  }));
  const { error } = await supabase
    .from("dispatch_route_units")
    .upsert(rows, { onConflict: "route_id,unit_id" });
  if (error) return { error: error.message };

  revalidatePath(`/admin/dispatch/${route.route_date}`);
  return { success: true, count: unitIds.length };
}

/** Unassign units from a route (removes the row entirely — use only if you
 *  picked the wrong unit by mistake. For "returned with damage" use the
 *  markUnitsReturned action instead). */
export async function unassignUnitsFromRoute(routeId: string, unitIds: string[]) {
  await requireStaffOrAdmin();
  if (unitIds.length === 0) return { success: true };
  const supabase = createAdminClient();
  const { data: route } = await supabase
    .from("dispatch_routes")
    .select("route_date")
    .eq("id", routeId)
    .single();
  const { error } = await supabase
    .from("dispatch_route_units")
    .delete()
    .eq("route_id", routeId)
    .in("unit_id", unitIds);
  if (error) return { error: error.message };
  if (route?.route_date) revalidatePath(`/admin/dispatch/${route.route_date}`);
  return { success: true };
}

/** Mark units returned with optional condition + note. Used after pickup. */
export async function markUnitsReturned(
  routeId: string,
  returns: { unit_id: string; condition: "good" | "needs_repair" | "broken"; note?: string }[],
) {
  await requireDriverOrAbove();
  if (returns.length === 0) return { success: true };
  const supabase = createAdminClient();
  const { data: route } = await supabase
    .from("dispatch_routes")
    .select("route_date")
    .eq("id", routeId)
    .single();
  const now = new Date().toISOString();
  for (const r of returns) {
    await supabase
      .from("dispatch_route_units")
      .update({
        returned_at: now,
        return_condition: r.condition,
        return_note: r.note || null,
      })
      .eq("route_id", routeId)
      .eq("unit_id", r.unit_id)
      .is("returned_at", null);
    // If returned condition is not 'good', also update the unit's own condition
    if (r.condition !== "good") {
      await supabase
        .from("inventory_units")
        .update({ condition: r.condition })
        .eq("id", r.unit_id);
    }
  }
  if (route?.route_date) revalidatePath(`/admin/dispatch/${route.route_date}`);
  return { success: true };
}

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
  // Drivers update route status from the field (out → completed)
  await requireDriverOrAbove();
  const valid = ["planned", "loaded", "out", "completed", "cancelled"];
  if (!valid.includes(status)) return { error: "Invalid status" };
  const supabase = createAdminClient({ unscoped: true });

  const { data: route, error } = await supabase
    .from("dispatch_routes")
    .update({ status })
    .eq("id", routeId)
    .select("route_type")
    .maybeSingle();
  if (error) return { error: error.message };

  // When a route is marked completed, propagate to all its bookings:
  //   delivery route → bookings "confirmed" become "delivered"
  //   pickup route   → bookings "delivered" become "completed"
  if (status === "completed" && route?.route_type) {
    const { data: stops } = await supabase
      .from("dispatch_stops")
      .select("booking_id")
      .eq("route_id", routeId);
    const bookingIds = Array.from(new Set(((stops as any[]) || []).map((s) => s.booking_id)));
    if (bookingIds.length > 0) {
      const newStatus = route.route_type === "pickup" ? "completed" : "delivered";
      const allowedPrior = route.route_type === "pickup"
        ? ["delivered", "confirmed"]
        : ["confirmed"];
      await supabase
        .from("bookings")
        .update({ booking_status: newStatus })
        .in("id", bookingIds)
        .in("booking_status", allowedPrior);
    }
  }

  // Revalidate all surfaces (Fix 2026-06-17: driver-side status changes
  // weren't visible in admin until manual refresh)
  revalidatePath(`/admin/dispatch/${routeDate}`);
  revalidatePath(`/admin/dispatch/route/${routeId}`);
  revalidatePath(`/driver/route/${routeId}`);
  revalidatePath(`/driver`);
  revalidatePath(`/admin/dashboard`);
  if (status === "completed" && route?.route_type) {
    // Bookings just propagated — clear their cache too
    const { data: stops2 } = await supabase
      .from("dispatch_stops")
      .select("booking_id")
      .eq("route_id", routeId);
    for (const s of (stops2 as any[]) || []) {
      if (s?.booking_id) revalidatePath(`/admin/bookings/${s.booking_id}`);
    }
  }
  return { success: true };
}

export async function assignBookingToRoute(
  bookingId: string,
  routeId: string,
  routeDate: string,
) {
  try {
    await requireStaffOrAdmin();
    const supabase = createAdminClient();

    // Get target route_type + the rest of its config so we can mirror to pickup later
    const { data: targetRoute, error: routeErr } = await supabase
      .from("dispatch_routes")
      .select("route_type, vehicle_id, trailer_id, driver_name")
      .eq("id", routeId)
      .single();
    if (routeErr || !targetRoute) {
      console.error("[assignBookingToRoute] route lookup failed:", routeErr);
      return { error: routeErr?.message || "Route not found" };
    }
    const targetType = targetRoute.route_type;

    // Find existing stops for this booking + their route_type
    const { data: existingStops, error: stopsErr } = await supabase
      .from("dispatch_stops")
      .select("id, route_id, dispatch_routes!inner(route_type)")
      .eq("booking_id", bookingId);
    if (stopsErr) {
      console.error("[assignBookingToRoute] existingStops lookup failed:", stopsErr);
      return { error: stopsErr.message };
    }

    // If the booking is ALREADY in this exact route, nothing to do
    const alreadyInRoute = ((existingStops as any[]) || []).find((s) => s.route_id === routeId);
    if (alreadyInRoute) {
      revalidatePath(`/admin/dispatch/${routeDate}`);
      return { success: true, already: true };
    }

    // Delete same-type stops in OTHER routes (move booking, not duplicate)
    const sameTypeIds = ((existingStops as any[]) || [])
      .filter((s) => s.dispatch_routes?.route_type === targetType && s.route_id !== routeId)
      .map((s) => s.id);
    if (sameTypeIds.length > 0) {
      const { error: delErr } = await supabase.from("dispatch_stops").delete().in("id", sameTypeIds);
      if (delErr) {
        console.error("[assignBookingToRoute] delete same-type failed:", delErr);
        return { error: delErr.message };
      }
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
    if (error) {
      console.error("[assignBookingToRoute] insert failed:", error);
      return { error: error.message };
    }

  // Auto-mirror to a pickup route when assigning to a DELIVERY route.
  // - Find/create a pickup route on the booking's end date with same vehicle+driver
  // - Only assigns if no manual pickup stop already exists for this booking
  // - Silent skip on any error — never block the delivery assignment
  let mirrored: { route_id: string; route_date: string; created: boolean } | null = null;
  if (targetType === "delivery") {
    mirrored = await mirrorBookingToPickupRoute(supabase, bookingId, targetRoute);
    if (mirrored) {
      revalidatePath(`/admin/dispatch/${mirrored.route_date}`);
    }
  }

    revalidatePath(`/admin/dispatch/${routeDate}`);
    return { success: true, pickup_mirrored: mirrored };
  } catch (e: any) {
    console.error("[assignBookingToRoute] threw:", e);
    return { error: e?.message || String(e) };
  }
}

/** Find or create the pickup route on the booking's end date with the same
 *  vehicle/trailer/driver as the delivery route, then assign the booking. */
async function mirrorBookingToPickupRoute(
  supabase: ReturnType<typeof createAdminClient>,
  bookingId: string,
  deliveryRoute: { vehicle_id: string | null; trailer_id: string | null; driver_name: string | null },
): Promise<{ route_id: string; route_date: string; created: boolean } | null> {
  try {
    // Booking's end date — for 1-day rentals, pickup is same day evening
    const { data: booking } = await supabase
      .from("bookings")
      .select("event_date, event_end_date")
      .eq("id", bookingId)
      .single();
    if (!booking) return null;
    const pickupDate = booking.event_end_date || booking.event_date;

    // Already in a pickup stop? Respect manual assignment — skip
    const { data: existingPickup } = await supabase
      .from("dispatch_stops")
      .select("id, dispatch_routes!inner(route_type, route_date)")
      .eq("booking_id", bookingId);
    const alreadyInPickup = ((existingPickup as any[]) || []).find(
      (s) => s.dispatch_routes?.route_type === "pickup",
    );
    if (alreadyInPickup) return null;

    // Find existing pickup route on that date with same vehicle
    const { data: existingRoute } = await supabase
      .from("dispatch_routes")
      .select("id, route_date")
      .eq("route_date", pickupDate)
      .eq("route_type", "pickup")
      .eq("vehicle_id", deliveryRoute.vehicle_id)
      .maybeSingle();

    let pickupRouteId: string;
    let created = false;
    if (existingRoute) {
      pickupRouteId = existingRoute.id;
    } else {
      // Create one mirroring the delivery setup
      const { data: newRoute, error: createErr } = await supabase
        .from("dispatch_routes")
        .insert({
          route_date: pickupDate,
          vehicle_id: deliveryRoute.vehicle_id,
          trailer_id: deliveryRoute.trailer_id,
          driver_name: deliveryRoute.driver_name,
          route_type: "pickup",
          status: "planned",
          notes: "Auto-created from delivery route (admin can reassign vehicle/driver manually)",
        })
        .select("id")
        .single();
      if (createErr || !newRoute) return null;
      pickupRouteId = newRoute.id;
      created = true;
    }

    // Append the booking as a stop in that pickup route
    const { data: maxOrder } = await supabase
      .from("dispatch_stops")
      .select("stop_order")
      .eq("route_id", pickupRouteId)
      .order("stop_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (maxOrder?.stop_order ?? -1) + 1;

    await supabase.from("dispatch_stops").insert({
      route_id: pickupRouteId,
      booking_id: bookingId,
      stop_order: nextOrder,
    });

    return { route_id: pickupRouteId, route_date: pickupDate, created };
  } catch (e) {
    console.error("[mirrorBookingToPickupRoute failed, non-fatal]", e);
    return null;
  }
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
  const supabase = createAdminClient({ unscoped: true });
  const { data: stop, error } = await supabase
    .from("dispatch_stops")
    .update({ delivered_at: new Date().toISOString() })
    .eq("id", stopId)
    .select("booking_id, route_id")
    .maybeSingle();
  if (error) return { error: error.message };

  // Propagate to the booking based on route type
  if (stop?.booking_id && stop?.route_id) {
    const { data: route } = await supabase
      .from("dispatch_routes")
      .select("route_type")
      .eq("id", stop.route_id)
      .maybeSingle();
    if (route) {
      // delivery route → booking goes to "delivered" (only if currently confirmed)
      // pickup route   → booking goes to "completed" (only if currently delivered/confirmed)
      const newStatus = route.route_type === "pickup" ? "completed" : "delivered";
      const allowedPrior = route.route_type === "pickup"
        ? ["delivered", "confirmed"]
        : ["confirmed"];
      await supabase
        .from("bookings")
        .update({ booking_status: newStatus })
        .eq("id", stop.booking_id)
        .in("booking_status", allowedPrior);
    }
  }

  // Revalidate ALL surfaces that might show this booking's status
  // (Fix 2026-06-17: driver changed status but admin views showed stale data.)
  revalidatePath(`/admin/dispatch/route/${routeId}`);
  revalidatePath(`/driver/route/${routeId}`);
  if (stop?.booking_id) {
    revalidatePath(`/admin/bookings/${stop.booking_id}`);
  }
  revalidatePath(`/admin/dispatch`, "page");
  revalidatePath(`/admin/dashboard`);
  return { success: true };
}

export async function clearStopDelivered(stopId: string, routeId: string) {
  await requireDriverOrAbove();
  const supabase = createAdminClient({ unscoped: true });
  // Read booking_id first so we can revalidate its detail page too
  const { data: stopBefore } = await supabase
    .from("dispatch_stops")
    .select("booking_id")
    .eq("id", stopId)
    .maybeSingle();
  const { error } = await supabase
    .from("dispatch_stops")
    .update({ delivered_at: null })
    .eq("id", stopId);
  if (error) return { error: error.message };
  // Intentionally do NOT revert the booking status — admin may have updated
  // it manually; "undo delivered" is just a clerical fix on the stop.
  revalidatePath(`/admin/dispatch/route/${routeId}`);
  revalidatePath(`/driver/route/${routeId}`);
  if (stopBefore?.booking_id) {
    revalidatePath(`/admin/bookings/${stopBefore.booking_id}`);
  }
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

// ─── AI route optimizer ──────────────────────────────────────────
//
// Two actions: optimize (read-only, returns proposed plan) and apply
// (writes the plan to dispatch_routes + dispatch_stops). UI lives in
// /admin/dispatch/[date]/OptimizeButton.tsx — see lib/dispatch/optimize.ts
// for the LLM call.

import { proposeRoutePlan, type OptimizationResult } from "@/lib/dispatch/optimize";
import { getCurrentTenantId } from "@/lib/tenant/db";

const OptimizeInputSchema = z.object({
  route_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Returns a proposed plan from GPT-4o. Does NOT write anything. */
export async function optimizeRoutesForDate(
  input: z.infer<typeof OptimizeInputSchema>,
): Promise<{ result: OptimizationResult } | { error: string }> {
  await requireStaffOrAdmin();
  const parsed = OptimizeInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid date" };
  const tenantId = getCurrentTenantId();
  if (!tenantId) return { error: "No tenant context" };

  const result = await proposeRoutePlan({
    tenantId,
    routeDate: parsed.data.route_date,
  });
  if (!result) {
    return {
      error:
        "Optimizer unavailable. Check that OPENAI_API_KEY is set, or the AI provider may be down.",
    };
  }
  return { result };
}

const ApplyPlanSchema = z.object({
  route_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  routes: z.array(
    z.object({
      driver_email: z.string(),
      driver_name: z.string(),
      vehicle_id: z.string().nullable(),
      trailer_id: z.string().nullable(),
      stops: z.array(
        z.object({
          booking_id: z.string().uuid(),
          stop_order: z.number().int().positive(),
        }),
      ).min(1),
    }),
  ),
});

/** Apply a proposed plan. Inserts dispatch_routes + dispatch_stops for each
 *  route in the plan. Idempotent-ish: re-running won't dupe stops because
 *  the optimizer already excludes bookings on existing stops. */
export async function applyOptimizedPlan(
  input: z.infer<typeof ApplyPlanSchema>,
): Promise<{ success: true; routes_created: number; stops_created: number } | { error: string }> {
  await requireStaffOrAdmin();
  const parsed = ApplyPlanSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid plan" };
  const supabase = createAdminClient();

  let routesCreated = 0;
  let stopsCreated = 0;

  for (const r of parsed.data.routes) {
    const { data: route, error: routeErr } = await supabase
      .from("dispatch_routes")
      .insert({
        route_date: parsed.data.route_date,
        vehicle_id: r.vehicle_id,
        trailer_id: r.trailer_id,
        driver_name: r.driver_name,
        notes: `Auto-generated by optimizer for ${r.driver_email}`,
        route_type: "delivery",
        status: "planned",
      })
      .select("id")
      .single();
    if (routeErr || !route) {
      return { error: `Could not create route for ${r.driver_name}: ${routeErr?.message}` };
    }
    routesCreated++;

    for (const stop of r.stops) {
      const { error: stopErr } = await supabase.from("dispatch_stops").insert({
        route_id: (route as any).id,
        booking_id: stop.booking_id,
        stop_order: stop.stop_order,
      });
      if (stopErr) {
        // Continue with remaining stops — operator can fix the failures
        // by hand. The optimizer's job is best-effort.
        console.error("[applyOptimizedPlan] stop insert failed", stopErr);
        continue;
      }
      stopsCreated++;
    }
  }

  revalidatePath(`/admin/dispatch/${parsed.data.route_date}`);
  return { success: true, routes_created: routesCreated, stops_created: stopsCreated };
}
