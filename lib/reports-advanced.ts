// Advanced report computations — server-only. Each function returns
// pre-shaped data for one card on /admin/reports.

import { createAdminClient } from "@/lib/supabase/admin";

// ─── Cash flow projection ────────────────────────────────────────────────
export interface CashFlowBucket {
  bucket_label: string;   // "Next 7d", "8-30d", "31-60d", "61-90d"
  from: string;
  to: string;
  confirmed_cents: number;     // paid bookings
  pending_cents: number;       // pending payment bookings (potential)
  bookings_confirmed: number;
  bookings_pending: number;
}

export async function computeCashFlowProjection(): Promise<CashFlowBucket[]> {
  const supabase = createAdminClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  const ranges = [
    { label: "Next 7 days", days: 7 },
    { label: "8–30 days", days: 30 },
    { label: "31–60 days", days: 60 },
    { label: "61–90 days", days: 90 },
  ];

  // Fetch all upcoming bookings in next 90 days once
  const max = new Date(today);
  max.setDate(max.getDate() + 90);
  const maxStr = max.toISOString().split("T")[0];

  const { data: rows } = await supabase
    .from("bookings")
    .select("event_date, total_amount, stripe_payment_status, booking_status")
    .gte("event_date", todayStr)
    .lte("event_date", maxStr)
    .neq("booking_status", "cancelled");

  const list = (rows as any[]) || [];

  const buckets: CashFlowBucket[] = [];
  let prevEnd = today;
  for (const r of ranges) {
    const end = new Date(today);
    end.setDate(end.getDate() + r.days);
    const fromStr = prevEnd.toISOString().split("T")[0];
    const toStr = end.toISOString().split("T")[0];

    let confirmed = 0;
    let pending = 0;
    let cConfirmed = 0;
    let cPending = 0;
    for (const b of list) {
      if (b.event_date < fromStr || b.event_date > toStr) continue;
      if (b.event_date === fromStr && fromStr !== todayStr) continue; // exclusive lower
      if (b.stripe_payment_status === "paid") {
        confirmed += b.total_amount || 0;
        cConfirmed++;
      } else {
        pending += b.total_amount || 0;
        cPending++;
      }
    }
    buckets.push({
      bucket_label: r.label,
      from: fromStr,
      to: toStr,
      confirmed_cents: confirmed,
      pending_cents: pending,
      bookings_confirmed: cConfirmed,
      bookings_pending: cPending,
    });
    prevEnd = end;
  }
  return buckets;
}

// ─── Monthly P&L (last 12 months) ───────────────────────────────────────
export interface MonthlyPnLRow {
  month: string;         // "2026-03"
  label: string;         // "Mar 2026"
  revenue_cents: number;
  direct_costs_cents: number;
  gross_profit_cents: number;
  overhead_cents: number;
  net_profit_cents: number;
  bookings: number;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(yyyy_mm: string): string {
  const [y, m] = yyyy_mm.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export async function computeMonthlyPnL(): Promise<MonthlyPnLRow[]> {
  const supabase = createAdminClient();

  // Build last 12 months (oldest first)
  const months: { key: string; label: string; start: Date; end: Date }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0); // last day of that month
    const key = monthKey(start);
    months.push({ key, label: monthLabel(key), start, end });
  }

  const fromStr = months[0].start.toISOString().split("T")[0];
  const toStr = months[months.length - 1].end.toISOString().split("T")[0];

  const [{ data: bookings }, { data: overheadAll }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, event_date, total_amount")
      .gte("event_date", fromStr)
      .lte("event_date", toStr)
      .eq("stripe_payment_status", "paid")
      .neq("booking_status", "cancelled"),
    supabase
      .from("overhead_costs")
      .select("monthly_cents, effective_from, effective_to"),
  ]);

  // Per-month: revenue + booking count + expense ids
  const byMonth = new Map<string, MonthlyPnLRow>();
  for (const m of months) {
    byMonth.set(m.key, {
      month: m.key,
      label: m.label,
      revenue_cents: 0,
      direct_costs_cents: 0,
      gross_profit_cents: 0,
      overhead_cents: 0,
      net_profit_cents: 0,
      bookings: 0,
    });
  }

  const bookingIdsByMonth = new Map<string, string[]>();
  for (const b of (bookings as any[]) || []) {
    const key = (b.event_date || "").slice(0, 7);
    const row = byMonth.get(key);
    if (!row) continue;
    row.revenue_cents += b.total_amount || 0;
    row.bookings += 1;
    if (!bookingIdsByMonth.has(key)) bookingIdsByMonth.set(key, []);
    bookingIdsByMonth.get(key)!.push(b.id);
  }

  // Direct costs per month: sum booking_expenses for that month's booking ids
  // Batch all booking ids into one query then bucket back
  const allBookingIds = Array.from(bookingIdsByMonth.values()).flat();
  if (allBookingIds.length > 0) {
    const { data: expenses } = await supabase
      .from("booking_expenses")
      .select("booking_id, amount_cents")
      .in("booking_id", allBookingIds);
    // Map booking_id → month
    const bidToMonth = new Map<string, string>();
    for (const [mKey, ids] of bookingIdsByMonth) {
      for (const id of ids) bidToMonth.set(id, mKey);
    }
    for (const e of (expenses as any[]) || []) {
      const mKey = bidToMonth.get(e.booking_id);
      if (!mKey) continue;
      const row = byMonth.get(mKey);
      if (!row) continue;
      row.direct_costs_cents += e.amount_cents || 0;
    }
  }

  // Overhead per month: prorate by days the cost was active in that month
  for (const m of months) {
    const startMs = m.start.getTime();
    const endMs = m.end.getTime() + 86400000; // include the last day
    const daysInMonth = Math.max(1, Math.round((endMs - startMs) / 86400000));
    let monthOverhead = 0;
    for (const o of (overheadAll as any[]) || []) {
      const effStart = new Date((o.effective_from || "1970-01-01") + "T00:00:00").getTime();
      const effEnd = o.effective_to
        ? new Date(o.effective_to + "T23:59:59").getTime()
        : Number.MAX_SAFE_INTEGER;
      const overlapStart = Math.max(startMs, effStart);
      const overlapEnd = Math.min(endMs, effEnd);
      if (overlapEnd <= overlapStart) continue;
      const overlapDays = Math.ceil((overlapEnd - overlapStart) / 86400000);
      const dailyRate = o.monthly_cents / 30;
      monthOverhead += Math.round(dailyRate * overlapDays);
    }
    const row = byMonth.get(m.key)!;
    row.overhead_cents = monthOverhead;
    row.gross_profit_cents = row.revenue_cents - row.direct_costs_cents;
    row.net_profit_cents = row.gross_profit_cents - row.overhead_cents;
  }

  return Array.from(byMonth.values());
}

// ─── Top drivers (hours + payroll dollars) ──────────────────────────────
export interface DriverRow {
  driver_email: string;
  total_hours: number;
  total_payroll_cents: number;
  bookings: number;          // distinct booking_ids
  expense_lines: number;     // total expense rows
}

export async function computeTopDrivers(
  from: string,
  to: string,
): Promise<DriverRow[]> {
  const supabase = createAdminClient();

  // Active labor categories (supports_payroll_hours = true)
  const { data: cats } = await supabase
    .from("booking_expense_categories")
    .select("key")
    .eq("supports_payroll_hours", true);
  const laborKeys = ((cats as any[]) || []).map((c) => c.key);
  if (laborKeys.length === 0) return [];

  // Payroll expenses in date range with driver_email set
  const { data: rows } = await supabase
    .from("booking_expenses")
    .select("driver_email, driver_hours, amount_cents, booking_id, category, recorded_at")
    .in("category", laborKeys)
    .not("driver_email", "is", null)
    .gte("recorded_at", `${from}T00:00:00`)
    .lte("recorded_at", `${to}T23:59:59`);

  const byDriver = new Map<string, DriverRow & { bookingSet: Set<string> }>();
  for (const r of (rows as any[]) || []) {
    const email = (r.driver_email || "").trim().toLowerCase();
    if (!email) continue;
    if (!byDriver.has(email)) {
      byDriver.set(email, {
        driver_email: email,
        total_hours: 0,
        total_payroll_cents: 0,
        bookings: 0,
        expense_lines: 0,
        bookingSet: new Set(),
      });
    }
    const d = byDriver.get(email)!;
    d.total_hours += r.driver_hours || 0;
    d.total_payroll_cents += r.amount_cents || 0;
    d.expense_lines += 1;
    if (r.booking_id) d.bookingSet.add(r.booking_id);
  }

  return Array.from(byDriver.values())
    .map((d) => ({
      driver_email: d.driver_email,
      total_hours: Math.round(d.total_hours * 100) / 100,
      total_payroll_cents: d.total_payroll_cents,
      bookings: d.bookingSet.size,
      expense_lines: d.expense_lines,
    }))
    .sort((a, b) => b.total_payroll_cents - a.total_payroll_cents);
}

// ─── Customer LTV (all-time, ignores date range) ────────────────────────
export interface CustomerLTVRow {
  email: string;
  name: string;
  bookings: number;
  total_revenue_cents: number;
  first_booking_date: string;
  last_booking_date: string;
  days_since_last: number;
  avg_booking_cents: number;
}

export async function computeCustomerLTV(limit = 25): Promise<CustomerLTVRow[]> {
  const supabase = createAdminClient();

  // All paid bookings ever (capped at 5000 — practical for years of data)
  const { data: rows } = await supabase
    .from("bookings")
    .select(
      "customer_email, customer_first_name, customer_last_name, total_amount, event_date",
    )
    .eq("stripe_payment_status", "paid")
    .neq("booking_status", "cancelled")
    .order("event_date", { ascending: false })
    .limit(5000);

  const byEmail = new Map<string, CustomerLTVRow>();
  for (const b of (rows as any[]) || []) {
    const email = (b.customer_email || "").toLowerCase().trim();
    if (!email) continue;
    if (!byEmail.has(email)) {
      byEmail.set(email, {
        email,
        name: `${b.customer_first_name || ""} ${b.customer_last_name || ""}`.trim(),
        bookings: 0,
        total_revenue_cents: 0,
        first_booking_date: b.event_date,
        last_booking_date: b.event_date,
        days_since_last: 0,
        avg_booking_cents: 0,
      });
    }
    const c = byEmail.get(email)!;
    c.bookings += 1;
    c.total_revenue_cents += b.total_amount || 0;
    if (b.event_date < c.first_booking_date) c.first_booking_date = b.event_date;
    if (b.event_date > c.last_booking_date) c.last_booking_date = b.event_date;
  }

  const today = Date.now();
  const out = Array.from(byEmail.values()).map((c) => {
    const last = new Date(c.last_booking_date + "T00:00:00").getTime();
    return {
      ...c,
      days_since_last: Math.max(0, Math.floor((today - last) / 86400000)),
      avg_booking_cents: c.bookings > 0 ? Math.round(c.total_revenue_cents / c.bookings) : 0,
    };
  });

  return out
    .sort((a, b) => b.total_revenue_cents - a.total_revenue_cents)
    .slice(0, limit);
}
