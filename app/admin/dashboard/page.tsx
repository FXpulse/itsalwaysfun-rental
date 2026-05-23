import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Clock, CheckCircle, Truck, DollarSign, AlertCircle, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = createAdminClient();

  const today = new Date().toISOString().split("T")[0];
  const inSevenDays = new Date();
  inSevenDays.setDate(inSevenDays.getDate() + 7);
  const sevenDaysISO = inSevenDays.toISOString().split("T")[0];

  // ── PENDING PAYMENT (new — important for admin attention) ───
  const { count: pendingPaymentCount, data: pendingList } = await supabase
    .from("bookings")
    .select("id, customer_first_name, customer_last_name, product_name, event_date, total_amount, created_at", { count: "exact" })
    .eq("booking_status", "pending_payment")
    .order("created_at", { ascending: false })
    .limit(5);

  // ── BOOKINGS TODAY ───────────────────────────────────────────
  const { count: bookingsTodayCount } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("event_date", today)
    .in("booking_status", ["confirmed", "delivered"]);

  // ── BOOKINGS THIS WEEK ──────────────────────────────────────
  const { data: weekBookings, count: bookingsWeekCount } = await supabase
    .from("bookings")
    .select("total_amount", { count: "exact" })
    .gte("event_date", today)
    .lte("event_date", sevenDaysISO)
    .in("booking_status", ["confirmed", "delivered"]);

  const revenueThisWeek =
    (weekBookings || []).reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;

  // ── DELIVERED TODAY (currently out) ──────────────────────────
  const { count: rentedNowCount } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("event_date", today)
    .eq("booking_status", "delivered");

  // ── RECENT 5 bookings (any status) ───────────────────────────
  const { data: recentBookings } = await supabase
    .from("bookings")
    .select("id, customer_first_name, customer_last_name, product_name, event_date, booking_status, stripe_payment_status, total_amount, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

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
      href: "/admin/bookings",
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
      href: "/admin/bookings",
      color: "border-l-emerald-500",
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy mb-1">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Operational overview — pending payments, bookings, revenue.
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

      {/* Pending payment quick-action panel */}
      {pendingList && pendingList.length > 0 && (
        <div className="card border-l-4 border-l-amber-500 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-brand-navy">
              {pendingPaymentCount} pending payment{(pendingPaymentCount ?? 0) === 1 ? "" : "s"} need attention
            </h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            These bookings are from the public site but haven't been paid yet
            (or hold expired). Mark as paid manually if customer paid offline.
          </p>
          <div className="space-y-2">
            {pendingList.map((b) => (
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
                    Event: {formatDate(b.event_date)} · Created {new Date(b.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3">
                  <span className="font-bold text-brand-navy">{formatCurrency(b.total_amount)}</span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </div>
              </Link>
            ))}
          </div>
        </div>
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
            {recentBookings.map((b) => (
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
                    Event: {formatDate(b.event_date)} · {b.booking_status.replace(/_/g, " ")}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3">
                  <span className="text-sm font-semibold">{formatCurrency(b.total_amount)}</span>
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
