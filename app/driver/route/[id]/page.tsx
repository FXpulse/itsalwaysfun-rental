// Driver-friendly route view — mobile-first, Uber-style one-stop-at-a-time.
// Diferente del admin equivalente: optimizado para use-in-the-field con un
// teléfono en una mano y un cliente delante.
//
// Inspections + team chat live in the bottom-nav tabs (/driver/inbox and
// /driver/booking/[id]/chat). This page stays focused on the route itself.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { RouteHeader } from "./RouteHeader";
import { StopCard } from "./StopCard";

export const dynamic = "force-dynamic";

export default async function DriverRoutePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createAdminClient();
  const authClient = createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return (
      <div className="text-center py-12 text-slate-500">
        Please <Link href="/admin/login" className="text-brand-navy underline">sign in</Link> to continue.
      </div>
    );
  }

  const { data: route } = await supabase
    .from("dispatch_routes")
    .select(`
      id, route_date, route_type, status, driver_name, notes,
      vehicles (name),
      trailers (name)
    `)
    .eq("id", params.id)
    .maybeSingle();
  if (!route) notFound();

  const { data: stopsRaw } = await supabase
    .from("dispatch_stops")
    .select(`
      id, stop_order, delivered_at, notes,
      bookings (
        id, customer_first_name, customer_last_name, customer_phone, customer_address,
        product_name, event_date, start_time, end_time, surface_type, needs_power_supply, notes
      )
    `)
    .eq("route_id", params.id)
    .order("stop_order");

  const stops = ((stopsRaw as any[]) || []).filter((s) => s.bookings); // skip orphaned

  return (
    <div className="min-h-screen pb-16">
      {/* Top nav */}
      <div className="sticky top-0 bg-white border-b border-slate-200 z-10 px-4 py-3 flex items-center gap-3">
        <Link href="/driver" className="text-slate-500">
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-brand-navy text-lg truncate">
            {(route as any).vehicles?.name || "Route"}
          </h1>
          <p className="text-xs text-slate-500">
            {new Date((route as any).route_date + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}{" "}
            · {(route as any).route_type === "pickup" ? "Pickup" : "Delivery"}
          </p>
        </div>
      </div>

      <RouteHeader
        routeId={(route as any).id}
        routeDate={(route as any).route_date}
        status={(route as any).status}
        notes={(route as any).notes}
        totalStops={stops.length}
        completedStops={stops.filter((s) => s.delivered_at).length}
      />

      <div className="px-4 py-4 space-y-3">
        {stops.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm">
            No stops on this route yet.
          </div>
        ) : (
          stops.map((stop, idx) => (
            <StopCard
              key={(stop as any).id}
              stop={stop}
              routeId={(route as any).id}
              routeType={(route as any).route_type}
              stopNumber={idx + 1}
            />
          ))
        )}
      </div>
    </div>
  );
}
