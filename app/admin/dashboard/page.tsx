import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = createAdminClient();

  // Today's bookings
  const today = new Date().toISOString().split("T")[0];
  const { count: bookingsTodayCount } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("event_date", today)
    .in("booking_status", ["confirmed", "delivered"]);

  // This week (next 7 days)
  const inSevenDays = new Date();
  inSevenDays.setDate(inSevenDays.getDate() + 7);
  const sevenDaysISO = inSevenDays.toISOString().split("T")[0];

  const { data: weekBookings, count: bookingsWeekCount } = await supabase
    .from("bookings")
    .select("total_amount", { count: "exact" })
    .gte("event_date", today)
    .lte("event_date", sevenDaysISO)
    .in("booking_status", ["confirmed", "delivered"]);

  const revenueThisWeek =
    (weekBookings || []).reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;

  // Items currently rented out (event_date = today, status = delivered)
  const { count: rentedNowCount } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("event_date", today)
    .eq("booking_status", "delivered");

  const cards = [
    { label: "Bookings today", value: bookingsTodayCount ?? 0 },
    { label: "Bookings this week", value: bookingsWeekCount ?? 0 },
    { label: "Revenue this week", value: formatCurrency(revenueThisWeek) },
    { label: "Currently rented out", value: rentedNowCount ?? 0 },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-navy mb-1">Dashboard</h1>
      <p className="text-sm text-slate-500 mb-8">
        Operational overview — bookings, revenue, rentals in progress.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="card border-l-4 border-l-brand-yellow">
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
              {c.label}
            </div>
            <div className="text-3xl font-bold text-brand-navy">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-2">Coming next</h2>
        <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
          <li>Monthly calendar with booking density per day</li>
          <li>Recent bookings table with quick actions</li>
          <li>Low-availability alerts (products booked >= 50% of upcoming weekends)</li>
        </ul>
        <p className="text-xs text-slate-400 mt-4">
          Built incrementally — see Products / Bookings / Availability pages in the sidebar.
        </p>
      </div>
    </div>
  );
}
