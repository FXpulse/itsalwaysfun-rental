import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { getRouteLoad } from "@/lib/dispatch-aggregator";
import { getTenantInfo } from "@/lib/tenant/business";
import { formatDateLongInTz } from "@/lib/tenant/timezone";
import { DispatchClient } from "./DispatchClient";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DispatchDatePage({
  params,
  searchParams,
}: {
  params: { date: string };
  searchParams: { type?: string };
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) notFound();
  const me = await getCurrentUserRole();
  if (!me) redirect("/admin/login");

  const routeType: "delivery" | "pickup" =
    searchParams.type === "pickup" ? "pickup" : "delivery";

  const supabase = createAdminClient();

  // Delivery candidates: bookings whose event_date = today
  // Pickup candidates: bookings whose event_end_date = today (or event_date if single-day)
  const bookingsQuery =
    routeType === "delivery"
      ? supabase
          .from("bookings")
          .select(
            "id, customer_first_name, customer_last_name, customer_email, customer_phone, customer_address, product_name, event_date, event_end_date, start_time, end_time, surface_type, needs_power_supply, booking_status, stripe_payment_status, total_amount",
          )
          .eq("event_date", params.date)
          .neq("booking_status", "cancelled")
          .order("start_time", { ascending: true, nullsFirst: false })
      : supabase
          .from("bookings")
          .select(
            "id, customer_first_name, customer_last_name, customer_email, customer_phone, customer_address, product_name, event_date, event_end_date, start_time, end_time, surface_type, needs_power_supply, booking_status, stripe_payment_status, total_amount",
          )
          .or(
            `event_end_date.eq.${params.date},and(event_end_date.is.null,event_date.eq.${params.date})`,
          )
          .neq("booking_status", "cancelled")
          .order("end_time", { ascending: true, nullsFirst: false });

  const [
    { data: bookings },
    { data: routes },
    { data: vehicles },
    { data: trailers },
    { data: driverRoles },
  ] = await Promise.all([
    bookingsQuery,
    supabase
      .from("dispatch_routes")
      .select(`
        id, vehicle_id, trailer_id, driver_name, notes, status, route_type, created_at,
        vehicles (id, name, vehicle_type, requires_trailer),
        trailers (id, name)
      `)
      .eq("route_date", params.date)
      .eq("route_type", routeType)
      .order("created_at"),
    supabase.from("vehicles").select("*").eq("is_active", true).order("name"),
    supabase.from("trailers").select("*").eq("is_active", true).order("name"),
    supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "driver")
      .eq("is_active", true),
  ]);

  // Resolve driver names from auth.users metadata
  let drivers: { user_id: string; name: string; email: string }[] = [];
  const driverUserIds = (driverRoles as any[] || []).map((r) => r.user_id);
  if (driverUserIds.length > 0) {
    try {
      const adminClient = createAdminClient({ unscoped: true });
      const { data: usersPage } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      const userMap = new Map((usersPage?.users || []).map((u) => [u.id, u]));
      for (const uid of driverUserIds) {
        const u = userMap.get(uid);
        if (!u) continue;
        const md = (u.user_metadata || {}) as any;
        const first = md.first_name?.trim() || "";
        const last = md.last_name?.trim() || "";
        const fullName = [first, last].filter(Boolean).join(" ");
        const display = fullName || (u.email?.split("@")[0] || "Driver");
        drivers.push({
          user_id: uid,
          name: display,
          email: u.email || "",
        });
      }
      drivers.sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
      console.error("[failed to load drivers]", e);
    }
  }

  // For each route, fetch stops + compute load.
  // PostgREST's nested embed (bookings (...)) fails on dispatch_stops
  // because the schema cache doesn't have the FK relationship. Do two
  // separate queries and join in code.
  const routeIds = (routes || []).map((r: any) => r.id);
  let stopsByRoute = new Map<string, any[]>();
  if (routeIds.length > 0) {
    const unscopedAdmin = createAdminClient({ unscoped: true });
    const { data: stops, error: stopsErr } = await unscopedAdmin
      .from("dispatch_stops")
      .select("id, route_id, booking_id, stop_order")
      .in("route_id", routeIds)
      .order("stop_order");
    if (stopsErr) {
      console.error("[dispatch page] stops query failed:", stopsErr, "routeIds:", routeIds);
    }

    const bookingIds = Array.from(new Set(((stops as any[]) || []).map((s) => s.booking_id)));
    let bookingsById = new Map<string, any>();
    if (bookingIds.length > 0) {
      const { data: bookingRows, error: bErr } = await supabase
        .from("bookings")
        .select("id, customer_first_name, customer_last_name, product_name, start_time, end_time, customer_address")
        .in("id", bookingIds);
      if (bErr) {
        console.error("[dispatch page] bookings join query failed:", bErr);
      }
      for (const b of (bookingRows as any[]) || []) {
        bookingsById.set(b.id, b);
      }
    }

    for (const s of (stops as any[]) || []) {
      const enriched = { ...s, bookings: bookingsById.get(s.booking_id) || null };
      if (!stopsByRoute.has(s.route_id)) stopsByRoute.set(s.route_id, []);
      stopsByRoute.get(s.route_id)!.push(enriched);
    }
  }

  const loadByRoute = new Map<string, any>();
  for (const rid of routeIds) {
    loadByRoute.set(rid, await getRouteLoad(rid));
  }

  // Per-unit data: which units are assigned to each route + which units are
  // available for each inventory_item the truck load needs.
  // Collect inventory_item_ids needed across all routes (those with tracks_units)
  const neededItemIds = new Set<string>();
  for (const load of loadByRoute.values()) {
    for (const it of load.items || []) neededItemIds.add(it.inventory_item_id);
  }
  let trackedItemIds = new Set<string>();
  let unitsByItem = new Map<string, any[]>();      // inventory_item_id → all units
  let assignmentsByRoute = new Map<string, any[]>(); // route_id → assigned units (with tag/condition/item)
  let unitToBlockingRoute = new Map<string, { route_id: string; route_date: string }>();
  if (neededItemIds.size > 0) {
    const { data: trackedItems } = await supabase
      .from("inventory_items")
      .select("id")
      .in("id", Array.from(neededItemIds))
      .eq("tracks_units", true);
    trackedItemIds = new Set((trackedItems || []).map((r: any) => r.id));

    if (trackedItemIds.size > 0) {
      const { data: allUnits } = await supabase
        .from("inventory_units")
        .select("id, inventory_item_id, tag, condition, is_active")
        .in("inventory_item_id", Array.from(trackedItemIds))
        .eq("is_active", true)
        .order("tag");
      for (const u of (allUnits as any[]) || []) {
        if (!unitsByItem.has(u.inventory_item_id)) unitsByItem.set(u.inventory_item_id, []);
        unitsByItem.get(u.inventory_item_id)!.push(u);
      }

      // Active assignments across ALL routes (so we can flag which units are taken elsewhere)
      const unitIds = (allUnits || []).map((u: any) => u.id);
      if (unitIds.length > 0) {
        const { data: assigns } = await supabase
          .from("dispatch_route_units")
          .select("route_id, unit_id, dispatch_routes(route_date)")
          .is("returned_at", null)
          .in("unit_id", unitIds);
        for (const a of (assigns as any[]) || []) {
          // Bucket by route for "what's assigned to MY route"
          if (!assignmentsByRoute.has(a.route_id)) assignmentsByRoute.set(a.route_id, []);
          const unit = (allUnits || []).find((u: any) => u.id === a.unit_id);
          if (unit) {
            assignmentsByRoute.get(a.route_id)!.push({
              unit_id: a.unit_id,
              tag: unit.tag,
              condition: unit.condition,
              inventory_item_id: unit.inventory_item_id,
            });
          }
          // Track which units are blocked on OTHER routes (different from this date)
          if (a.dispatch_routes?.route_date && a.dispatch_routes.route_date !== params.date) {
            unitToBlockingRoute.set(a.unit_id, {
              route_id: a.route_id,
              route_date: a.dispatch_routes.route_date,
            });
          }
        }
      }
    }
  }

  // Per-route, per-item: list of available units (includes blocked-elsewhere flag)
  // Shape: routeUnits[route_id][inventory_item_id] = { assigned: [], available: [] }
  const routeUnits: Record<string, Record<string, { assigned: any[]; available: any[] }>> = {};
  for (const rid of routeIds) {
    routeUnits[rid] = {};
    const load = loadByRoute.get(rid);
    const myAssignments = assignmentsByRoute.get(rid) || [];
    for (const it of load?.items || []) {
      if (!trackedItemIds.has(it.inventory_item_id)) continue;
      const allUnitsForItem = unitsByItem.get(it.inventory_item_id) || [];
      const assignedHere = myAssignments.filter((a) => a.inventory_item_id === it.inventory_item_id);
      const assignedHereIds = new Set(assignedHere.map((a) => a.unit_id));
      const available = allUnitsForItem.map((u: any) => {
        const blocking = unitToBlockingRoute.get(u.id);
        return {
          unit_id: u.id,
          tag: u.tag,
          condition: u.condition,
          // Block if assigned to a route on a different date AND not assigned here
          blocked_on_other_route_id: !assignedHereIds.has(u.id) && blocking ? blocking.route_id : null,
          blocked_on_other_route_date: !assignedHereIds.has(u.id) && blocking ? blocking.route_date : null,
        };
      });
      routeUnits[rid][it.inventory_item_id] = {
        assigned: assignedHere,
        available,
      };
    }
  }

  // Map booking → assigned route ID (for THIS route_type only — booking can be
  // in delivery + pickup independently)
  const bookingRouteMap = new Map<string, string>();
  for (const [routeId, stops] of stopsByRoute) {
    for (const s of stops) bookingRouteMap.set(s.booking_id, routeId);
  }

  const tenant = await getTenantInfo();
  const tz = tenant.timezone;
  const dateLabel = formatDateLongInTz(params.date + "T12:00:00Z", tz);

  return (
    <div className="max-w-6xl">
      <Link
        href="/admin/dispatch"
        className="text-sm text-slate-500 hover:text-brand-navy inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-3 w-3" /> Back to dispatch
      </Link>

      <h1 className="text-2xl font-bold text-brand-navy mb-1">
        Dispatch — {dateLabel}
      </h1>
      <p className="text-sm text-slate-500 mb-3">
        {bookings?.length || 0} {routeType === "pickup" ? "pickup" : "delivery"} candidate
        {bookings?.length === 1 ? "" : "s"} ·{" "}
        {routes?.length || 0} {routeType} route{routes?.length === 1 ? "" : "s"} planned
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        <Link
          href={`/admin/dispatch/${params.date}`}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
            routeType === "delivery"
              ? "border-brand-navy text-brand-navy"
              : "border-transparent text-slate-500 hover:text-brand-navy"
          }`}
        >
          🚚 Delivery
        </Link>
        <Link
          href={`/admin/dispatch/${params.date}?type=pickup`}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
            routeType === "pickup"
              ? "border-brand-navy text-brand-navy"
              : "border-transparent text-slate-500 hover:text-brand-navy"
          }`}
        >
          📦 Pickup
        </Link>
      </div>

      <DispatchClient
        routeDate={params.date}
        routeType={routeType}
        bookings={(bookings as any[]) || []}
        routes={
          (routes as any[] || []).map((r) => ({
            ...r,
            stops: stopsByRoute.get(r.id) || [],
            load: loadByRoute.get(r.id) || { items: [], total_bookings: 0 },
          }))
        }
        vehicles={(vehicles as any[]) || []}
        trailers={(trailers as any[]) || []}
        drivers={drivers}
        bookingRouteMap={Object.fromEntries(bookingRouteMap)}
        routeUnits={routeUnits}
      />
    </div>
  );
}
