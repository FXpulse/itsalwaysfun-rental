import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { CalendarView } from "./CalendarView";

export const dynamic = "force-dynamic";

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const me = await getCurrentUserRole();
  if (!me) redirect("/admin/login");

  const now = new Date();
  // ?month=YYYY-MM (defaults to current month)
  const monthParam = searchParams.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [yearStr, monthStr] = monthParam.split("-");
  const year = parseInt(yearStr, 10);
  const monthIdx = parseInt(monthStr, 10) - 1; // 0-indexed

  // Build month boundaries for query (include adjacent days that bleed into the grid)
  const firstOfMonth = new Date(year, monthIdx, 1);
  const lastOfMonth = new Date(year, monthIdx + 1, 0); // last day of month

  // Grid covers 6 weeks max — include up to 7 days before + 7 days after
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - 7);
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(gridEnd.getDate() + 7);

  const gridStartStr = gridStart.toISOString().split("T")[0];
  const gridEndStr = gridEnd.toISOString().split("T")[0];

  const supabase = createAdminClient();
  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      "id, customer_first_name, customer_last_name, product_name, event_date, event_end_date, start_time, booking_status, stripe_payment_status",
    )
    .gte("event_date", gridStartStr)
    .lte("event_date", gridEndStr)
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: false });

  // Expand multi-day bookings into one entry per day in range
  const expanded: Array<{
    id: string;
    date: string; // YYYY-MM-DD
    title: string;
    subtitle: string;
    status: string;
    paymentStatus: string;
    startTime: string | null;
    multiDay: boolean;
    isStart: boolean;
    isEnd: boolean;
  }> = [];
  for (const b of (bookings as any[]) || []) {
    const start = b.event_date;
    const end = b.event_end_date || b.event_date;
    const startDt = new Date(start + "T00:00:00");
    const endDt = new Date(end + "T00:00:00");
    const cur = new Date(startDt);
    while (cur <= endDt) {
      const d = cur.toISOString().split("T")[0];
      expanded.push({
        id: b.id,
        date: d,
        title: b.product_name,
        subtitle: `${b.customer_first_name} ${b.customer_last_name[0] || ""}`.trim(),
        status: b.booking_status,
        paymentStatus: b.stripe_payment_status,
        startTime: b.start_time,
        multiDay: end !== start,
        isStart: d === start,
        isEnd: d === end,
      });
      cur.setDate(cur.getDate() + 1);
    }
  }

  // Group by date
  const byDate = new Map<string, typeof expanded>();
  for (const e of expanded) {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date)!.push(e);
  }

  // Build calendar grid (6 weeks × 7 days = 42 cells)
  const gridDates: { date: string; inMonth: boolean }[] = [];
  // Find Sunday before/at firstOfMonth
  const firstDayOfWeek = firstOfMonth.getDay(); // 0 = Sun
  const calStart = new Date(firstOfMonth);
  calStart.setDate(calStart.getDate() - firstDayOfWeek);
  for (let i = 0; i < 42; i++) {
    const d = new Date(calStart);
    d.setDate(calStart.getDate() + i);
    const ds = d.toISOString().split("T")[0];
    gridDates.push({ date: ds, inMonth: d.getMonth() === monthIdx });
  }

  // Prev/next month
  const prevMonth = new Date(year, monthIdx - 1, 1);
  const nextMonth = new Date(year, monthIdx + 1, 1);
  const prevParam = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
  const nextParam = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;
  const todayParam = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const monthLabel = firstOfMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const todayStr = now.toISOString().split("T")[0];

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-brand-navy">{monthLabel}</h1>
        <div className="flex gap-2">
          <Link
            href={`/admin/calendar?month=${prevParam}`}
            className="text-sm border border-slate-300 rounded-md px-3 py-1.5 hover:bg-slate-50"
          >
            ← Prev
          </Link>
          <Link
            href={`/admin/calendar?month=${todayParam}`}
            className="text-sm bg-brand-navy text-white rounded-md px-3 py-1.5 hover:bg-brand-navy-dark"
          >
            Today
          </Link>
          <Link
            href={`/admin/calendar?month=${nextParam}`}
            className="text-sm border border-slate-300 rounded-md px-3 py-1.5 hover:bg-slate-50"
          >
            Next →
          </Link>
        </div>
      </div>

      <CalendarView
        gridDates={gridDates}
        byDate={Object.fromEntries(byDate)}
        todayStr={todayStr}
      />

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-amber-200"></span> Pending payment
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-blue-200"></span> Confirmed
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-purple-200"></span> Delivered
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-green-200"></span> Completed
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-slate-300"></span> Cancelled
        </span>
        <span className="inline-flex items-center gap-1 ml-4 text-slate-400">
          Multi-day shown across multiple cells
        </span>
      </div>
    </div>
  );
}
