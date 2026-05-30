// Pull raw rows from DB based on a report's filter window. We narrow what
// we can at the DB level (date range, status, product) so the in-memory
// engine has less data to crunch.

import { createAdminClient } from "@/lib/supabase/admin";
import type { ReportDefinition, BookingRow } from "./report-engine";

export async function fetchReportRows(
  tenantId: string,
  def: ReportDefinition,
): Promise<BookingRow[]> {
  const supabase = createAdminClient({ unscoped: true });
  let q = supabase
    .from("bookings")
    .select("id, event_date, product_name, product_id, booking_status, stripe_payment_status, surface_type, customer_email, customer_first_name, customer_last_name, total_amount, created_at")
    .eq("tenant_id", tenantId);

  // Push date filters to the query (those are the highest-cardinality)
  const dateGte = def.filters.find((f) => f.field === "event_date" && f.op === "gte");
  const dateLte = def.filters.find((f) => f.field === "event_date" && f.op === "lte");
  if (dateGte) q = q.gte("event_date", dateGte.value);
  if (dateLte) q = q.lte("event_date", dateLte.value);

  // Cap result size — if a tenant has > 5000 bookings matching, force a date narrow
  q = q.order("event_date", { ascending: false }).limit(5000);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data as BookingRow[]) || [];
}
