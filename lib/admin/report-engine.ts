// Custom report engine. Pure function: takes a report definition + raw
// bookings rows, returns aggregated rows ready for chart/table rendering.
//
// All logic in memory — bookings table is small per tenant (10s–10000s rows).
// If a tenant ever needs to query millions, switch to materialized views.

export type Dimension =
  | "event_date_day"
  | "event_date_week"
  | "event_date_month"
  | "product_name"
  | "booking_status"
  | "surface_type"
  | "customer_email";

export type Metric =
  | "count_bookings"
  | "sum_revenue"
  | "sum_paid"
  | "avg_booking_value"
  | "unique_customers"
  | "count_cancelled";

export type FilterOp = "eq" | "neq" | "gte" | "lte";

export interface ReportFilter {
  field: "event_date" | "booking_status" | "stripe_payment_status" | "product_id";
  op: FilterOp;
  value: string;
}

export interface ReportDefinition {
  dimensions: Dimension[];           // 1-2 dims, 1 is most common
  metrics: Metric[];                  // 1-3 metrics
  filters: ReportFilter[];
  chart_type: "bar" | "line" | "table";
  sort?: { by: "dimension" | "metric"; metric_index?: number; dir: "asc" | "desc" };
  limit?: number;                     // top N rows (default 100)
}

export interface BookingRow {
  id: string;
  event_date: string | null;
  product_name: string | null;
  product_id: string | null;
  booking_status: string | null;
  stripe_payment_status: string | null;
  surface_type: string | null;
  customer_email: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  total_amount: number | null;
  created_at: string;
}

export interface ReportResultRow {
  dimensions: Record<string, string>;  // { dim_name: value }
  metrics: Record<string, number>;     // { metric_name: value }
  label: string;                       // pre-built display label
}

export interface ReportResult {
  rows: ReportResultRow[];
  totals: Record<string, number>;
  row_count: number;
  filtered_count: number;             // rows after filters before aggregation
}

const METRIC_LABELS: Record<Metric, string> = {
  count_bookings: "Bookings",
  sum_revenue: "Revenue ($)",
  sum_paid: "Paid revenue ($)",
  avg_booking_value: "Avg booking ($)",
  unique_customers: "Unique customers",
  count_cancelled: "Cancelled",
};

const DIMENSION_LABELS: Record<Dimension, string> = {
  event_date_day: "Date",
  event_date_week: "Week",
  event_date_month: "Month",
  product_name: "Product",
  booking_status: "Status",
  surface_type: "Surface",
  customer_email: "Customer",
};

export function metricLabel(m: Metric): string { return METRIC_LABELS[m]; }
export function dimensionLabel(d: Dimension): string { return DIMENSION_LABELS[d]; }

/**
 * Apply filters (in-memory) so callers can fetch broadly and filter precisely.
 */
export function applyFilters(rows: BookingRow[], filters: ReportFilter[]): BookingRow[] {
  return rows.filter((row) => {
    for (const f of filters) {
      const v = (row as any)[f.field];
      if (v == null) return false;
      if (f.op === "eq" && String(v) !== f.value) return false;
      if (f.op === "neq" && String(v) === f.value) return false;
      if (f.op === "gte" && String(v) < f.value) return false;
      if (f.op === "lte" && String(v) > f.value) return false;
    }
    return true;
  });
}

function dimensionValue(row: BookingRow, dim: Dimension): string {
  if (dim === "event_date_day") return row.event_date || "(no date)";
  if (dim === "event_date_week") {
    if (!row.event_date) return "(no date)";
    const d = new Date(row.event_date);
    const day = d.getUTCDay();
    const mondayDiff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), mondayDiff));
    return monday.toISOString().slice(0, 10);
  }
  if (dim === "event_date_month") return (row.event_date || "").slice(0, 7);
  if (dim === "product_name") return row.product_name || "(no product)";
  if (dim === "booking_status") return row.booking_status || "(no status)";
  if (dim === "surface_type") return row.surface_type || "(unspecified)";
  if (dim === "customer_email") return row.customer_email || "(no email)";
  return "(unknown)";
}

export function runReport(
  rows: BookingRow[],
  def: ReportDefinition,
): ReportResult {
  const filtered = applyFilters(rows, def.filters);

  // Group by dimensions
  const groups = new Map<string, BookingRow[]>();
  for (const row of filtered) {
    const dimVals = def.dimensions.map((d) => dimensionValue(row, d));
    const key = dimVals.join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const result: ReportResultRow[] = [];
  for (const [key, groupRows] of groups.entries()) {
    const dimValues = key.split("|");
    const dimensions: Record<string, string> = {};
    def.dimensions.forEach((d, i) => {
      dimensions[DIMENSION_LABELS[d]] = dimValues[i];
    });

    const metrics: Record<string, number> = {};
    for (const m of def.metrics) {
      metrics[METRIC_LABELS[m]] = computeMetric(m, groupRows);
    }

    const label = dimValues.join(" · ");
    result.push({ dimensions, metrics, label });
  }

  // Sort
  const sortKey = def.sort?.by || "dimension";
  if (sortKey === "metric" && def.metrics.length > 0) {
    const mi = def.sort?.metric_index ?? 0;
    const mLabel = METRIC_LABELS[def.metrics[Math.min(mi, def.metrics.length - 1)]];
    result.sort((a, b) => (b.metrics[mLabel] || 0) - (a.metrics[mLabel] || 0));
  } else {
    result.sort((a, b) => a.label.localeCompare(b.label));
  }
  if (def.sort?.dir === "desc" && sortKey === "dimension") result.reverse();

  // Limit
  const limit = def.limit || 100;
  const trimmed = result.slice(0, limit);

  // Totals (only for sum/avg/count — not unique)
  const totals: Record<string, number> = {};
  for (const m of def.metrics) {
    const label = METRIC_LABELS[m];
    totals[label] = computeMetric(m, filtered);
  }

  return {
    rows: trimmed,
    totals,
    row_count: trimmed.length,
    filtered_count: filtered.length,
  };
}

function computeMetric(metric: Metric, rows: BookingRow[]): number {
  switch (metric) {
    case "count_bookings": return rows.length;
    case "sum_revenue":
      return Math.round(rows.reduce((s, r) => s + (r.total_amount || 0), 0) / 100);
    case "sum_paid":
      return Math.round(
        rows
          .filter((r) => r.stripe_payment_status === "paid")
          .reduce((s, r) => s + (r.total_amount || 0), 0) / 100,
      );
    case "avg_booking_value":
      if (rows.length === 0) return 0;
      return Math.round(rows.reduce((s, r) => s + (r.total_amount || 0), 0) / rows.length / 100);
    case "unique_customers":
      return new Set(rows.map((r) => r.customer_email).filter(Boolean)).size;
    case "count_cancelled":
      return rows.filter((r) => r.booking_status === "cancelled").length;
    default: return 0;
  }
}
