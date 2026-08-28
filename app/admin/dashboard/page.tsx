import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getTenantInfo } from "@/lib/tenant/business";
import { formatDateTimeInTz, formatDateInTz } from "@/lib/tenant/timezone";
import { AutoRefresh } from "@/components/AutoRefresh";
import {
  AlertCircle,
  ArrowRight,
  Truck,
  AlertTriangle,
  FileText,
  Sparkles,
  Smartphone,
  Package,
  Inbox,
  Mail,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  // Explicit tenant scoping (defense-in-depth vs the auto-injecting proxy —
  // see feedback_scoped_proxy_promise_all.md: helper functions invoked
  // inside Promise.all can silently lose scope. Being explicit here means
  // every one of the 11 parallel queries below carries an unambiguous
  // tenant_id filter even if the enclosing helper is refactored later.)
  const tenantId = getCurrentTenantId();
  const supabase = createAdminClient({ unscoped: true });
  const tenant = await getTenantInfo();
  const tz = tenant.timezone;

  const todayDt = new Date();
  const today = todayDt.toISOString().split("T")[0];
  const tomorrow = new Date(todayDt);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];
  const inSevenDays = new Date(todayDt);
  inSevenDays.setDate(inSevenDays.getDate() + 7);
  const sevenDaysISO = inSevenDays.toISOString().split("T")[0];

  // Run all in parallel
  const [
    { count: pendingPaymentCount, data: pendingList },
    { count: bookingsTodayCount },
    { data: weekBookings, count: bookingsWeekCount },
    { data: recentBookings },
    { data: todayRoutes },
    { data: tomorrowRoutes },
    { data: unresolvedDamages, count: damageCount },
    { data: payoutReady },
    { data: pendingQuotes },
    { data: thresholdRow },
    { data: unresolvedMessages, count: unresolvedMessagesCount },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, customer_first_name, customer_last_name, product_name, event_date, total_amount, created_at",
        { count: "exact" },
      )
      .eq("tenant_id", tenantId)
      .eq("booking_status", "pending_payment")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("event_date", today)
      .in("booking_status", ["confirmed", "delivered"]),
    supabase
      .from("bookings")
      .select("total_amount", { count: "exact" })
      .eq("tenant_id", tenantId)
      .gte("event_date", today)
      .lte("event_date", sevenDaysISO)
      .in("booking_status", ["confirmed", "delivered"]),
    supabase
      .from("bookings")
      .select(
        "id, customer_first_name, customer_last_name, product_name, event_date, booking_status, stripe_payment_status, total_amount, created_at",
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("dispatch_routes")
      .select("id, route_type, status, driver_name, vehicles (name), trailers (name)")
      .eq("tenant_id", tenantId)
      .eq("route_date", today)
      .order("created_at"),
    supabase
      .from("dispatch_routes")
      .select("id, route_type, status, driver_name, vehicles (name), trailers (name)")
      .eq("tenant_id", tenantId)
      .eq("route_date", tomorrowStr)
      .order("created_at"),
    supabase
      .from("booking_damages")
      .select(
        "id, booking_id, description, severity, cost_cents, customer_responsible, charged_to_customer, recorded_at",
        { count: "exact" },
      )
      .eq("tenant_id", tenantId)
      .eq("resolved", false)
      .order("recorded_at", { ascending: false })
      .limit(5),
    supabase
      .from("customer_profiles")
      .select("user_id, commission_pending_cents")
      .eq("tenant_id", tenantId)
      .gte("commission_pending_cents", 5000) // hardcoded threshold; reads dynamic in /admin/loyalty
      .order("commission_pending_cents", { ascending: false })
      .limit(5),
    supabase
      .from("quotes")
      .select("id, quote_number, customer_first_name, customer_last_name, total_cents, sent_at, expires_at")
      .eq("tenant_id", tenantId)
      .in("status", ["sent", "viewed"])
      .order("sent_at", { ascending: false })
      .limit(5),
    supabase
      .from("site_settings")
      .select("value")
      .eq("tenant_id", tenantId)
      .eq("key", "commission_payout_threshold_cents")
      .maybeSingle(),
    supabase
      .from("contact_messages")
      .select("id, first_name, last_name, email, subject, source, created_at", {
        count: "exact",
      })
      .eq("tenant_id", tenantId)
      .eq("is_resolved", false)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const revenueThisWeek =
    (weekBookings || []).reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;

  const thresholdCents = parseInt((thresholdRow?.value as string) || "5000", 10);
  const payoutReadyFiltered = (payoutReady || []).filter(
    (p: any) => p.commission_pending_cents >= thresholdCents,
  );

  const cards = [
    {
      label: "⏳ Pending payment",
      value: pendingPaymentCount ?? 0,
      href: "/admin/bookings?status=pending_payment",
      color: "border-l-amber-500",
      highlight: (pendingPaymentCount ?? 0) > 0,
    },
    {
      label: "📦 Bookings today",
      value: bookingsTodayCount ?? 0,
      href: "/admin/calendar",
      color: "border-l-blue-500",
    },
    {
      label: "📅 Bookings this week",
      value: bookingsWeekCount ?? 0,
      href: "/admin/bookings",
      color: "border-l-brand-yellow",
    },
    {
      label: "💰 Revenue this week",
      value: formatCurrency(revenueThisWeek),
      href: "/admin/reports",
      color: "border-l-emerald-500",
    },
  ];

  // Total alert count (for header)
  const totalAlerts =
    (pendingPaymentCount ?? 0) +
    (damageCount ?? 0) +
    payoutReadyFiltered.length +
    (pendingQuotes?.length || 0) +
    (unresolvedMessagesCount ?? 0);

  return (
    <div>
      <AutoRefresh />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy mb-1">
            Dashboard{totalAlerts > 0 && <span className="ml-2 text-sm bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">{totalAlerts} need attention</span>}
          </h1>
          <p className="text-sm text-slate-500">
            {todayDt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <Link href="/admin/bookings/new" className="btn-accent inline-flex items-center gap-2">
          + New booking
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`card border-l-4 ${c.color} hover:shadow-md transition ${c.highlight ? "ring-2 ring-amber-300" : ""}`}
          >
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
              {c.label}
            </div>
            <div className="text-3xl font-bold text-brand-navy">{c.value}</div>
          </Link>
        ))}
      </div>

      {/* Today's routes (delivery + pickup) */}
      {(todayRoutes && todayRoutes.length > 0) || (tomorrowRoutes && tomorrowRoutes.length > 0) ? (
        <div className="card border-l-4 border-l-blue-500 mb-6">
          <h2 className="text-lg font-semibold text-brand-navy mb-3 flex items-center gap-2">
            <Truck className="h-5 w-5" /> Routes
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <RouteListColumn label="Today" routes={(todayRoutes as any[]) || []} />
            <RouteListColumn label="Tomorrow" routes={(tomorrowRoutes as any[]) || []} />
          </div>
        </div>
      ) : null}

      {/* Contact inbox alert (new messages need attention) */}
      {unresolvedMessages && unresolvedMessages.length > 0 && (
        <AlertPanel
          tone="amber"
          icon={Inbox}
          title={`${unresolvedMessagesCount} unread message${(unresolvedMessagesCount ?? 0) === 1 ? "" : "s"} in Contact Inbox`}
          subtitle="From the website contact form or inbound emails. Reply directly from the inbox."
        >
          {unresolvedMessages.map((m: any) => (
            <Link
              key={m.id}
              href={`/admin/inbox`}
              className="flex items-start justify-between gap-3 p-3 bg-amber-50 rounded hover:bg-amber-100 transition border border-amber-200"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <strong className="text-brand-navy text-sm">
                    {m.first_name} {m.last_name}
                  </strong>
                  <span className="text-xs text-slate-500 truncate">· {m.email}</span>
                  {m.source === "inbound-email" && (
                    <span className="text-[10px] bg-blue-100 text-blue-800 rounded px-1.5 py-0.5 inline-flex items-center gap-0.5">
                      <Mail className="h-2.5 w-2.5" /> Email
                    </span>
                  )}
                </div>
                {m.subject && (
                  <div className="text-xs text-slate-600 truncate mt-0.5">
                    <strong>Subject:</strong> {m.subject}
                  </div>
                )}
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {formatDateTimeInTz(m.created_at, tz)}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
            </Link>
          ))}
          <Link
            href="/admin/inbox"
            className="block text-center text-xs text-amber-700 hover:underline mt-2"
          >
            Open Contact Inbox →
          </Link>
        </AlertPanel>
      )}

      {/* Pending payment alert */}
      {pendingList && pendingList.length > 0 && (
        <AlertPanel
          tone="amber"
          icon={AlertCircle}
          title={`${pendingPaymentCount} pending payment${(pendingPaymentCount ?? 0) === 1 ? "" : "s"} need attention`}
          subtitle="From public site but not yet paid. Mark as paid manually if customer paid offline."
        >
          {pendingList.map((b: any) => (
            <Link
              key={b.id}
              href={`/admin/bookings/${b.id}`}
              className="flex items-center justify-between p-3 bg-amber-50 rounded hover:bg-amber-100 transition border border-amber-200"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">
                  {b.customer_first_name} {b.customer_last_name} · {b.product_name}
                </div>
                <div className="text-xs text-slate-500">
                  Event: {formatDate(b.event_date)} · Created{" "}
                  {formatDateTimeInTz(b.created_at, tz)}
                </div>
              </div>
              <div className="flex items-center gap-3 ml-3">
                <span className="font-bold text-brand-navy">
                  {formatCurrency(b.total_amount)}
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </div>
            </Link>
          ))}
        </AlertPanel>
      )}

      {/* Damages unresolved */}
      {unresolvedDamages && unresolvedDamages.length > 0 && (
        <AlertPanel
          tone="red"
          icon={AlertTriangle}
          title={`${damageCount} unresolved damage${damageCount === 1 ? "" : "s"}`}
          subtitle="Items damaged on a booking that haven't been repaired/resolved yet."
        >
          {unresolvedDamages.map((d: any) => (
            <Link
              key={d.id}
              href={`/admin/bookings/${d.booking_id}`}
              className="flex items-center justify-between p-3 bg-red-50 rounded hover:bg-red-100 transition border border-red-200"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm flex items-center gap-2">
                  <span className="text-xs bg-white border border-red-300 rounded px-1 capitalize">
                    {d.severity}
                  </span>
                  {d.description}
                </div>
                <div className="text-xs text-slate-500">
                  Recorded {formatDateInTz(d.recorded_at, tz)}
                  {d.customer_responsible && !d.charged_to_customer && (
                    <span className="text-amber-700 font-semibold ml-2">
                      · chargeable to customer
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 ml-3">
                <span className="font-bold text-red-700">
                  {formatCurrency(d.cost_cents)}
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </div>
            </Link>
          ))}
        </AlertPanel>
      )}

      {/* Quotes awaiting customer */}
      {pendingQuotes && pendingQuotes.length > 0 && (
        <AlertPanel
          tone="blue"
          icon={FileText}
          title={`${pendingQuotes.length} quote${pendingQuotes.length === 1 ? "" : "s"} awaiting customer`}
          subtitle="Sent but not yet approved or declined."
        >
          {pendingQuotes.map((q: any) => (
            <Link
              key={q.id}
              href={`/admin/quotes/${q.id}`}
              className="flex items-center justify-between p-3 bg-blue-50 rounded hover:bg-blue-100 transition border border-blue-200"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">
                  <span className="font-mono text-xs mr-2">{q.quote_number}</span>
                  {q.customer_first_name} {q.customer_last_name}
                </div>
                <div className="text-xs text-slate-500">
                  Sent {q.sent_at && formatDateInTz(q.sent_at, tz)} · Expires{" "}
                  {q.expires_at && formatDateInTz(q.expires_at, tz)}
                </div>
              </div>
              <div className="flex items-center gap-3 ml-3">
                <span className="font-bold text-brand-navy">
                  {formatCurrency(q.total_cents)}
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </div>
            </Link>
          ))}
        </AlertPanel>
      )}

      {/* Loyalty payouts ready */}
      {payoutReadyFiltered.length > 0 && (
        <AlertPanel
          tone="purple"
          icon={Sparkles}
          title={`${payoutReadyFiltered.length} customer${payoutReadyFiltered.length === 1 ? "" : "s"} ready for commission payout`}
          subtitle={`Pending commission ≥ ${formatCurrency(thresholdCents)} (your threshold)`}
        >
          {payoutReadyFiltered.map((p: any) => (
            <Link
              key={p.user_id}
              href={`/admin/loyalty/${p.user_id}`}
              className="flex items-center justify-between p-3 bg-purple-50 rounded hover:bg-purple-100 transition border border-purple-200"
            >
              <div className="flex-1 text-sm">View customer detail</div>
              <div className="flex items-center gap-3 ml-3">
                <span className="font-bold text-purple-700">
                  {formatCurrency(p.commission_pending_cents)}
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </div>
            </Link>
          ))}
        </AlertPanel>
      )}

      {/* Recent bookings */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-brand-navy">Recent bookings</h2>
          <Link href="/admin/bookings" className="text-sm text-brand-navy hover:underline">
            View all →
          </Link>
        </div>
        {!recentBookings || recentBookings.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">No bookings yet.</p>
        ) : (
          <div className="space-y-2">
            {recentBookings.map((b: any) => (
              <Link
                key={b.id}
                href={`/admin/bookings/${b.id}`}
                className="flex items-center justify-between p-3 bg-slate-50 rounded hover:bg-slate-100 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">
                    {b.customer_first_name} {b.customer_last_name} · {b.product_name}
                  </div>
                  <div className="text-xs text-slate-500">
                    Event: {formatDate(b.event_date)} ·{" "}
                    {b.booking_status.replace(/_/g, " ")}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3">
                  <span className="text-sm font-semibold">
                    {formatCurrency(b.total_amount)}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AlertPanel({
  tone,
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  tone: "amber" | "red" | "blue" | "purple";
  icon: any;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const borderTone: Record<string, string> = {
    amber: "border-l-amber-500",
    red: "border-l-red-500",
    blue: "border-l-blue-500",
    purple: "border-l-purple-500",
  };
  const iconTone: Record<string, string> = {
    amber: "text-amber-600",
    red: "text-red-600",
    blue: "text-blue-600",
    purple: "text-purple-600",
  };
  return (
    <div className={`card border-l-4 ${borderTone[tone]} mb-6`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-5 w-5 ${iconTone[tone]}`} />
        <h2 className="text-lg font-semibold text-brand-navy">{title}</h2>
      </div>
      {subtitle && <p className="text-sm text-slate-500 mb-3">{subtitle}</p>}
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function RouteListColumn({
  label,
  routes,
}: {
  label: string;
  routes: any[];
}) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
        {label}
      </h3>
      {routes.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No routes planned</p>
      ) : (
        <div className="space-y-1">
          {routes.map((r: any) => (
            <Link
              key={r.id}
              href={`/admin/dispatch/route/${r.id}`}
              className="flex items-center justify-between p-2 bg-slate-50 rounded hover:bg-slate-100 transition text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px]">
                  {r.route_type === "pickup" ? "📦" : "🚚"}
                </span>
                <span className="font-semibold truncate">
                  {r.vehicles?.name || "—"}
                  {r.trailers?.name && ` + ${r.trailers.name}`}
                </span>
                {r.driver_name && (
                  <span className="text-slate-500">· {r.driver_name}</span>
                )}
              </div>
              <span
                className={`text-[10px] rounded px-1.5 py-0.5 ${
                  r.status === "completed"
                    ? "bg-green-100 text-green-800"
                    : r.status === "out"
                      ? "bg-blue-100 text-blue-800"
                      : r.status === "loaded"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-200 text-slate-600"
                }`}
              >
                {r.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
