import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { getRouteLoad } from "@/lib/dispatch-aggregator";
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

  const [{ data: bookings }, { data: routes }, { data: vehicles }, { data: trailers }] =
    await Promise.all([
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
    ]);

  // For each route, fetch stops + compute load
  const routeIds = (routes || []).map((r: any) => r.id);
  let stopsByRoute = new Map<string, any[]>();
  if (routeIds.length > 0) {
    const { data: stops } = await supabase
      .from("dispatch_stops")
      .select(`
        id, route_id, booking_id, stop_order,
        bookings (id, customer_first_name, customer_last_name, product_name, start_time, end_time, customer_address)
      `)
      .in("route_id", routeIds)
      .order("stop_order");
    for (const s of (stops as any[]) || []) {
      if (!stopsByRoute.has(s.route_id)) stopsByRoute.set(s.route_id, []);
      stopsByRoute.get(s.route_id)!.push(s);
    }
  }

  const loadByRoute = new Map<string, any>();
  for (const rid of routeIds) {
    loadByRoute.set(rid, await getRouteLoad(rid));
  }

  // Map booking → assigned route ID (for THIS route_type only — booking can be
  // in delivery + pickup independently)
  const bookingRouteMap = new Map<string, string>();
  for (const [routeId, stops] of stopsByRoute) {
    for (const s of stops) bookingRouteMap.set(s.booking_id, routeId);
  }

  const dateObj = new Date(params.date + "T00:00:00");
  const dateLabel = dateObj.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

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
        bookingRouteMap={Object.fromEntries(bookingRouteMap)}
      />
    </div>
  );
}
