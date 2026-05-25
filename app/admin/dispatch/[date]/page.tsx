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
}: {
  params: { date: string };
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) notFound();
  const me = await getCurrentUserRole();
  if (!me) redirect("/admin/login");

  const supabase = createAdminClient();

  const [{ data: bookings }, { data: routes }, { data: vehicles }, { data: trailers }] =
    await Promise.all([
      supabase
        .from("bookings")
        .select(
          "id, customer_first_name, customer_last_name, customer_email, customer_phone, customer_address, product_name, event_date, event_end_date, start_time, end_time, surface_type, needs_power_supply, booking_status, stripe_payment_status, total_amount",
        )
        .eq("event_date", params.date)
        .neq("booking_status", "cancelled")
        .order("start_time", { ascending: true, nullsFirst: false }),
      supabase
        .from("dispatch_routes")
        .select(`
          id, vehicle_id, trailer_id, driver_name, notes, status, created_at,
          vehicles (id, name, vehicle_type, requires_trailer),
          trailers (id, name)
        `)
        .eq("route_date", params.date)
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

  // Compute load for each route
  const loadByRoute = new Map<string, any>();
  for (const rid of routeIds) {
    loadByRoute.set(rid, await getRouteLoad(rid));
  }

  // Map booking → assigned route (if any)
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
      <p className="text-sm text-slate-500 mb-6">
        {bookings?.length || 0} active booking{bookings?.length === 1 ? "" : "s"} ·{" "}
        {routes?.length || 0} route{routes?.length === 1 ? "" : "s"} planned
      </p>

      <DispatchClient
        routeDate={params.date}
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
