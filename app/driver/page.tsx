import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Truck,
  Link as LinkIcon,
  CheckCircle2,
  Package,
  ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  planned: "Not started",
  loaded: "Loaded — ready",
  out: "Out for delivery",
  completed: "Done ✓",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<string, string> = {
  planned: "bg-slate-200 text-slate-700",
  loaded: "bg-amber-100 text-amber-900",
  out: "bg-blue-100 text-blue-900",
  completed: "bg-green-100 text-green-900",
  cancelled: "bg-red-100 text-red-900",
};

function dateAddDays(d: Date, days: number): string {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x.toISOString().split("T")[0];
}

export default async function DriverHomePage() {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const tomorrowStr = dateAddDays(today, 1);

  const supabase = createAdminClient();

  const authClient = createClient();
  const { data: { user } } = await authClient.auth.getUser();
  const meta = (user?.user_metadata as any) || {};
  const driverFirstName = (meta.first_name as string) || "";

  // Fetch today + tomorrow routes (drivers care about these)
  const [{ data: todayRoutes }, { data: tomorrowRoutes }] = await Promise.all([
    supabase
      .from("dispatch_routes")
      .select(`
        id, route_type, status, driver_name, notes,
        vehicles (name), trailers (name)
      `)
      .eq("route_date", todayStr)
      .order("created_at"),
    supabase
      .from("dispatch_routes")
      .select(`
        id, route_type, status, driver_name, notes,
        vehicles (name), trailers (name)
      `)
      .eq("route_date", tomorrowStr)
      .order("created_at"),
  ]);

  // Count stops per route
  const allRouteIds = [
    ...((todayRoutes as any[]) || []).map((r) => r.id),
    ...((tomorrowRoutes as any[]) || []).map((r) => r.id),
  ];

  const stopCounts = new Map<string, { total: number; delivered: number }>();
  if (allRouteIds.length > 0) {
    const { data: stops } = await supabase
      .from("dispatch_stops")
      .select("route_id, delivered_at")
      .in("route_id", allRouteIds);
    for (const s of (stops as any[]) || []) {
      const entry = stopCounts.get(s.route_id) || { total: 0, delivered: 0 };
      entry.total += 1;
      if (s.delivered_at) entry.delivered += 1;
      stopCounts.set(s.route_id, entry);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-navy mb-1">
        {driverFirstName ? `Hi ${driverFirstName}!` : "Welcome"}
      </h1>
      <p className="text-sm text-slate-500 mb-4">
        {today.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </p>

      {/* Today's routes */}
      <Section title="Today's routes" routes={(todayRoutes as any[]) || []} stopCounts={stopCounts} driverFirstName={driverFirstName} />

      {/* Tomorrow's routes (preview) */}
      <div className="mt-6">
        <Section title="Tomorrow" routes={(tomorrowRoutes as any[]) || []} stopCounts={stopCounts} driverFirstName={driverFirstName} />
      </div>

      <p className="text-xs text-slate-400 text-center mt-8">
        Need a route added or details changed? Call admin.
      </p>
    </div>
  );
}

function Section({
  title,
  routes,
  stopCounts,
  driverFirstName,
}: {
  title: string;
  routes: any[];
  stopCounts: Map<string, { total: number; delivered: number }>;
  driverFirstName: string;
}) {
  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
        {title}
      </h2>
      {routes.length === 0 ? (
        <div className="card text-center text-slate-400 py-6 text-sm">
          No routes planned.
        </div>
      ) : (
        <div className="space-y-2">
          {routes.map((r: any) => {
            const counts = stopCounts.get(r.id) || { total: 0, delivered: 0 };
            const isMine =
              driverFirstName &&
              r.driver_name &&
              r.driver_name.toLowerCase().includes(driverFirstName.toLowerCase());
            const complete = counts.total > 0 && counts.delivered === counts.total;
            return (
              <Link
                key={r.id}
                href={`/admin/dispatch/route/${r.id}`}
                className={`card flex items-center gap-3 hover:shadow-md transition ${complete ? "opacity-70" : ""} ${isMine ? "ring-2 ring-brand-yellow" : ""}`}
              >
                <div className="flex-shrink-0">
                  <div className="text-2xl">
                    {r.route_type === "pickup" ? "📦" : "🚚"}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-brand-navy flex items-center gap-2 flex-wrap">
                    {r.vehicles?.name || "—"}
                    {r.trailers && (
                      <>
                        <LinkIcon className="h-3 w-3 text-slate-400" />
                        <span className="text-slate-700">{r.trailers.name}</span>
                      </>
                    )}
                    {isMine && (
                      <span className="text-[10px] bg-brand-yellow text-brand-navy font-bold rounded px-1.5 py-0.5">
                        YOURS
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    {r.driver_name && <span>Driver: {r.driver_name}</span>}
                    <span className="inline-flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {counts.delivered}/{counts.total} stops
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span
                    className={`text-[10px] rounded px-2 py-0.5 ${STATUS_STYLES[r.status]}`}
                  >
                    {STATUS_LABEL[r.status] || r.status}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400 mt-2 ml-auto" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
