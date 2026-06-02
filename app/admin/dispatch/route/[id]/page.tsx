import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { getRouteLoad } from "@/lib/dispatch-aggregator";
import { ArrowLeft, Truck, Link as LinkIcon, Package } from "lucide-react";
import { DriverRouteClient } from "./DriverRouteClient";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  planned: "Planned",
  loaded: "Loaded — ready to go",
  out: "Out for delivery",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-slate-100 text-slate-700",
  loaded: "bg-amber-100 text-amber-900",
  out: "bg-blue-100 text-blue-900",
  completed: "bg-green-100 text-green-900",
  cancelled: "bg-red-100 text-red-900",
};

export default async function DriverRouteViewPage({
  params,
}: {
  params: { id: string };
}) {
  const me = await getCurrentUserRole();
  if (!me) redirect("/admin/login");

  const supabase = createAdminClient();
  const { data: route } = await supabase
    .from("dispatch_routes")
    .select(`
      id, route_date, route_type, vehicle_id, trailer_id, driver_name, notes, status,
      vehicles (id, name, vehicle_type, requires_trailer),
      trailers (id, name)
    `)
    .eq("id", params.id)
    .single();
  if (!route) notFound();

  const r: any = route;

  // Two-step fetch because PostgREST's nested embed (bookings (...)) on
  // dispatch_stops fails — schema cache doesn't have the FK relationship.
  const unscopedAdmin = createAdminClient({ unscoped: true });
  const { data: rawStops, error: stopsErr } = await unscopedAdmin
    .from("dispatch_stops")
    .select("id, booking_id, stop_order, delivered_at")
    .eq("route_id", params.id)
    .order("stop_order");
  if (stopsErr) {
    console.error("[driver route view] stops query failed:", stopsErr);
  }

  const bookingIds = Array.from(new Set(((rawStops as any[]) || []).map((s) => s.booking_id)));
  let bookingsById = new Map<string, any>();
  if (bookingIds.length > 0) {
    const { data: bookingRows } = await supabase
      .from("bookings")
      .select(
        "id, customer_first_name, customer_last_name, customer_phone, customer_address, product_name, start_time, end_time, surface_type, needs_power_supply, notes",
      )
      .in("id", bookingIds);
    for (const b of (bookingRows as any[]) || []) {
      bookingsById.set(b.id, b);
    }
  }

  const stops = ((rawStops as any[]) || []).map((s) => ({
    ...s,
    bookings: bookingsById.get(s.booking_id) || null,
  }));

  const load = await getRouteLoad(params.id);

  const dateObj = new Date(r.route_date + "T00:00:00");
  const dateLabel = dateObj.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="max-w-2xl">
      <Link
        href={`/admin/dispatch/${r.route_date}${r.route_type === "pickup" ? "?type=pickup" : ""}`}
        className="text-sm text-slate-500 hover:text-brand-navy inline-flex items-center gap-1 mb-3"
      >
        <ArrowLeft className="h-3 w-3" /> Back to {r.route_type === "pickup" ? "pickup" : "delivery"} dispatch
      </Link>

      {/* Header */}
      <div className="card mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">
              {dateLabel} · {r.route_type === "pickup" ? "📦 PICKUP" : "🚚 DELIVERY"}
            </div>
            <h1 className="text-xl font-bold text-brand-navy flex items-center gap-2 flex-wrap">
              <Truck className="h-5 w-5" />
              {r.vehicles?.name || "Unknown"}
              {r.trailers && (
                <>
                  <LinkIcon className="h-4 w-4 text-slate-400" />
                  {r.trailers.name}
                </>
              )}
            </h1>
            {r.driver_name && (
              <p className="text-sm text-slate-600 mt-1">
                Driver: <strong>{r.driver_name}</strong>
              </p>
            )}
            {r.notes && (
              <p className="text-xs text-slate-500 italic mt-1">{r.notes}</p>
            )}
          </div>
          <span
            className={`text-xs font-semibold rounded-full px-3 py-1 whitespace-nowrap ${STATUS_COLORS[r.status]}`}
          >
            {STATUS_LABEL[r.status] || r.status}
          </span>
        </div>
      </div>

      {/* Truck load — collapsible */}
      {load.items.length > 0 && (
        <details className="card mb-4">
          <summary className="cursor-pointer font-bold text-brand-navy flex items-center gap-2">
            <Package className="h-4 w-4" /> Truck load ({load.items.length} items)
            <span className="text-xs text-slate-400 ml-auto">tap to expand</span>
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            {load.items.map((it) => (
              <div key={it.inventory_item_id} className="flex items-baseline gap-2">
                <span className="font-mono font-bold text-brand-navy">
                  {it.total_quantity}×
                </span>
                <span className="text-slate-700">{it.inventory_name}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Stops */}
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2 px-1">
        Stops ({stops?.length || 0})
      </h2>

      {(!stops || stops.length === 0) ? (
        <div className="card text-center text-slate-400 py-8">
          No stops assigned to this route yet.
        </div>
      ) : (
        <DriverRouteClient routeId={r.id} stops={(stops as any[]) || []} />
      )}
    </div>
  );
}
