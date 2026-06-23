// Accounting helpers — compute Profit & Loss for a date range.
// Server-only (uses admin Supabase client to bypass RLS for reports).

import { createAdminClient } from "@/lib/supabase/admin";

export interface PnLSummary {
  from: string;
  to: string;
  bookings_count: number;
  revenue_cents: number;
  direct_costs_cents: number;
  gross_profit_cents: number;
  overhead_allocated_cents: number;
  /** Transactional non-booking expenses (marketing, contractor payroll,
   *  supplies, services, etc.) — pulled from business_expenses by
   *  expense_date in [from, to]. */
  operating_expenses_cents: number;
  net_profit_cents: number;
  margin_pct: number;                       // net_profit / revenue (0 if revenue=0)
  expenses_by_category: Record<string, number>;
  overhead_by_category: Record<string, number>;
  /** business_expenses summed per category key in the date window. */
  operating_by_category: Record<string, number>;
}

/** Compute P&L for a date range.
 *  - Revenue = sum of bookings.total_amount where event_date in [from, to]
 *    AND stripe_payment_status='paid' AND booking_status != 'cancelled'
 *  - Direct costs = sum of booking_expenses for those bookings
 *  - Overhead = monthly overhead in effect during the period, prorated
 *    by days the cost was active within [from, to]
 *  - Allocated overhead = full overhead amount (shown as a separate line —
 *    customers think of overhead as "burden" not per-booking)
 */
export async function computePnL(from: string, to: string): Promise<PnLSummary> {
  const supabase = createAdminClient();

  // 1. Paid bookings in period (revenue)
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, total_amount, event_date")
    .gte("event_date", from)
    .lte("event_date", to)
    .eq("stripe_payment_status", "paid")
    .neq("booking_status", "cancelled");

  const bookingIds = (bookings || []).map((b: any) => b.id);
  const revenue_cents = (bookings || []).reduce(
    (s: number, b: any) => s + (b.total_amount || 0),
    0,
  );

  // 2. Direct costs (booking_expenses for those bookings)
  let direct_costs_cents = 0;
  const expenses_by_category: Record<string, number> = {};
  if (bookingIds.length > 0) {
    const { data: expenses } = await supabase
      .from("booking_expenses")
      .select("category, amount_cents")
      .in("booking_id", bookingIds);
    for (const e of (expenses as any[]) || []) {
      direct_costs_cents += e.amount_cents || 0;
      expenses_by_category[e.category] =
        (expenses_by_category[e.category] || 0) + (e.amount_cents || 0);
    }
  }

  // 3. Overhead — prorate by days the cost was active in [from, to]
  const { data: overhead } = await supabase
    .from("overhead_costs")
    .select("monthly_cents, category, effective_from, effective_to");

  const periodStart = new Date(from + "T00:00:00").getTime();
  const periodEnd = new Date(to + "T23:59:59").getTime();

  let overhead_allocated_cents = 0;
  const overhead_by_category: Record<string, number> = {};
  for (const o of (overhead as any[]) || []) {
    const effStart = new Date((o.effective_from || from) + "T00:00:00").getTime();
    const effEnd = o.effective_to
      ? new Date(o.effective_to + "T23:59:59").getTime()
      : Number.MAX_SAFE_INTEGER;
    const overlapStart = Math.max(periodStart, effStart);
    const overlapEnd = Math.min(periodEnd, effEnd);
    if (overlapEnd <= overlapStart) continue;
    const overlapDays = Math.ceil((overlapEnd - overlapStart) / 86400000);
    // Daily rate = monthly / 30; total = daily × overlap days
    const dailyRate = o.monthly_cents / 30;
    const cost = Math.round(dailyRate * overlapDays);
    overhead_allocated_cents += cost;
    overhead_by_category[o.category] =
      (overhead_by_category[o.category] || 0) + cost;
  }

  // 4. Operating expenses — transactional business_expenses by expense_date
  //    in the window. Covers marketing, supplies, contractor payroll
  //    (non-driver), insurance, services, travel, etc.
  let operating_expenses_cents = 0;
  const operating_by_category: Record<string, number> = {};
  {
    const { data: ops } = await supabase
      .from("business_expenses")
      .select("category, amount_cents")
      .gte("expense_date", from)
      .lte("expense_date", to);
    for (const e of (ops as any[]) || []) {
      operating_expenses_cents += e.amount_cents || 0;
      operating_by_category[e.category] =
        (operating_by_category[e.category] || 0) + (e.amount_cents || 0);
    }
  }

  const gross_profit_cents = revenue_cents - direct_costs_cents;
  const net_profit_cents = gross_profit_cents - overhead_allocated_cents - operating_expenses_cents;
  const margin_pct = revenue_cents > 0 ? net_profit_cents / revenue_cents : 0;

  return {
    from,
    to,
    bookings_count: bookings?.length || 0,
    revenue_cents,
    direct_costs_cents,
    gross_profit_cents,
    overhead_allocated_cents,
    operating_expenses_cents,
    operating_by_category,
    net_profit_cents,
    margin_pct,
    expenses_by_category,
    overhead_by_category,
  };
}
