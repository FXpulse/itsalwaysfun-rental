import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { getTenantInfo } from "@/lib/tenant/business";
import { formatDateInTz } from "@/lib/tenant/timezone";
import { Calendar, Truck, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

function dateAddDays(d: Date, days: number): string {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x.toISOString().split("T")[0];
}

export default async function AdminDispatchPage() {
  const me = await getCurrentUserRole();
  if (!me) redirect("/admin/login");

  const supabase = createAdminClient();
  const tenant = await getTenantInfo();
  const tz = tenant.timezone;
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const tomorrowStr = dateAddDays(today, 1);
  const in7DaysStr = dateAddDays(today, 7);

  // Get upcoming bookings + route counts grouped by date
  const { data: upcoming } = await supabase
    .from("bookings")
    .select("event_date, booking_status")
    .gte("event_date", todayStr)
    .lte("event_date", in7DaysStr)
    .neq("booking_status", "cancelled")
    .order("event_date", { ascending: true });

  const byDate = new Map<string, { total: number; paid: number }>();
  for (const b of (upcoming as any[]) || []) {
    const entry = byDate.get(b.event_date) || { total: 0, paid: 0 };
    entry.total += 1;
    if (b.booking_status === "confirmed" || b.booking_status === "delivered") entry.paid += 1;
    byDate.set(b.event_date, entry);
  }

  // Get route counts per date
  const { data: routesPerDate } = await supabase
    .from("dispatch_routes")
    .select("route_date")
    .gte("route_date", todayStr)
    .lte("route_date", in7DaysStr);

  const routeCounts = new Map<string, number>();
  for (const r of (routesPerDate as any[]) || []) {
    routeCounts.set(r.route_date, (routeCounts.get(r.route_date) || 0) + 1);
  }

  // Build day list for next 7 days
  const days: string[] = [];
  for (let i = 0; i < 8; i++) days.push(dateAddDays(today, i));

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1">Dispatch</h1>
      <p className="text-sm text-slate-500 mb-6">
        Plan delivery routes per day. Each route = 1 vehicle (+ optional trailer)
        + multiple bookings to deliver. Aggregated load tells crew what to put
        on each truck.
      </p>

      <div className="flex gap-2 mb-4">
        <Link
          href={`/admin/dispatch/${tomorrowStr}`}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Calendar className="h-4 w-4" /> Plan tomorrow ({tomorrowStr})
        </Link>
        <Link
          href={`/admin/dispatch/${todayStr}`}
          className="inline-flex items-center gap-2 border border-slate-300 rounded-md px-4 py-2 text-slate-700 hover:bg-slate-50 text-sm"
        >
          Today
        </Link>
        <Link
          href="/admin/fleet"
          className="inline-flex items-center gap-2 border border-slate-300 rounded-md px-4 py-2 text-slate-700 hover:bg-slate-50 text-sm ml-auto"
        >
          <Truck className="h-4 w-4" /> Manage fleet
        </Link>
      </div>

      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">
        Next 7 days
      </h2>
      <div className="space-y-2">
        {days.map((d) => {
          const info = byDate.get(d);
          const routes = routeCounts.get(d) || 0;
          const isToday = d === todayStr;
          const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" }).format(new Date(d + "T12:00:00Z"));
          const monthDay = formatDateInTz(d + "T12:00:00Z", tz);
          return (
            <Link
              key={d}
              href={`/admin/dispatch/${d}`}
              className="card flex items-center justify-between hover:shadow-md transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">
                    {weekday}
                    {isToday && <span className="text-brand-yellow ml-1">★</span>}
                  </div>
                  <div className="font-bold text-brand-navy">{monthDay}</div>
                </div>
                <div className="text-sm text-slate-700">
                  {info ? (
                    <>
                      <strong>{info.total}</strong> booking{info.total === 1 ? "" : "s"}
                      {info.paid !== info.total && (
                        <span className="text-slate-500">
                          {" "}
                          ({info.paid} confirmed)
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-400">No bookings</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {routes > 0 ? (
                  <span className="text-xs bg-green-100 text-green-800 rounded-full px-3 py-1">
                    {routes} route{routes === 1 ? "" : "s"} planned
                  </span>
                ) : info && info.total > 0 ? (
                  <span className="text-xs bg-amber-100 text-amber-800 rounded-full px-3 py-1">
                    Not planned
                  </span>
                ) : null}
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
