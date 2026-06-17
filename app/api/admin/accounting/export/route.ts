// Accounting CSV export — admin-only.
// Date-scoped: ?type=expenses|overhead|pnl|tax|sales-receipts|customers
//              with &from=YYYY-MM-DD&to=YYYY-MM-DD
// Year-scoped: ?type=1099-nec with &year=YYYY
//
// Columns are chosen to import cleanly into QuickBooks Online, Xero, or any
// spreadsheet. Dates are YYYY-MM-DD, amounts are decimal USD (no $ signs).
//
// QuickBooks Online import notes (Sales Receipts, Customers):
//  - QBO expects MM/DD/YYYY for dates on import. We output YYYY-MM-DD; QBO
//    auto-detects on import. If it doesn't, switch the date format in the
//    QBO import wizard before clicking "Next".
//  - SalesReceiptNo is the booking ID (UUID); QBO accepts up to 21 chars,
//    we truncate the UUID to first 8 chars so it fits and stays unique
//    within a reasonable run.
//  - Customer column matches by exact string. First time you import a
//    customer that doesn't exist in QBO, QBO will offer to create them
//    (check the box on the import preview).

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { computePnL } from "@/lib/accounting";
import { compute1099Year } from "@/lib/reports-1099";

export const dynamic = "force-dynamic";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

function csvResponse(body: string, filename: string) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest) {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "expenses";

  // 1099-NEC export is year-scoped, not date-scoped — handle first.
  if (type === "1099-nec") {
    const yearStr = url.searchParams.get("year");
    if (!yearStr || !/^\d{4}$/.test(yearStr)) {
      return NextResponse.json({ error: "year=YYYY required" }, { status: 400 });
    }
    const year = parseInt(yearStr, 10);
    const summary = await compute1099Year(year);
    const headers = [
      "Driver Email",
      "Full Name",
      "Business Name / DBA",
      "TIN Last 4",
      "Address Line 1",
      "Address Line 2",
      "City",
      "State",
      "ZIP",
      "W9 Received",
      "Total Paid (USD)",
      "Total Hours",
      "Bookings",
      "Qualifies (>= threshold)",
      "Filed for Year",
    ];
    const rows = summary.drivers.map((r) => [
      r.driver_email,
      r.full_name || "",
      r.business_name || "",
      r.tin_last4 || "",
      r.address_line1 || "",
      r.address_line2 || "",
      r.city || "",
      r.state || "",
      r.zip || "",
      r.w9_received_at ? r.w9_received_at.slice(0, 10) : "",
      (r.total_paid_cents / 100).toFixed(2),
      r.total_hours.toFixed(2),
      r.bookings_count,
      r.qualifies ? "YES" : "no",
      r.filed_at ? r.filed_at.slice(0, 10) : "",
    ]);
    return csvResponse(toCsv(headers, rows), `1099_nec_${year}.csv`);
  }

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "from/to required as YYYY-MM-DD" }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (type === "expenses") {
    // All booking_expenses recorded in date range, joined with booking for context
    const { data: expensesRaw } = await supabase
      .from("booking_expenses")
      .select(`
        recorded_at, category, amount_cents, description,
        driver_hours, driver_email, recorded_by, notes,
        booking_id,
        bookings (
          event_date, customer_email, customer_first_name,
          customer_last_name, product_name
        )
      `)
      .gte("recorded_at", `${from}T00:00:00`)
      .lte("recorded_at", `${to}T23:59:59`)
      .order("recorded_at", { ascending: true });

    const { data: catRows } = await supabase
      .from("booking_expense_categories")
      .select("key, label");
    const catLabel = new Map<string, string>(
      ((catRows as { key: string; label: string }[]) || []).map((c) => [c.key, c.label]),
    );

    const headers = [
      "Date",
      "Category",
      "Amount (USD)",
      "Memo",
      "Booking ID",
      "Customer",
      "Customer Email",
      "Product",
      "Event Date",
      "Driver Email",
      "Driver Hours",
      "Recorded By",
      "Notes",
    ];

    const rows = ((expensesRaw as any[]) || []).map((e) => {
      const b = e.bookings || {};
      return [
        (e.recorded_at || "").slice(0, 10),
        catLabel.get(e.category) || e.category,
        ((e.amount_cents || 0) / 100).toFixed(2),
        e.description || "",
        e.booking_id || "",
        `${b.customer_first_name || ""} ${b.customer_last_name || ""}`.trim(),
        b.customer_email || "",
        b.product_name || "",
        b.event_date || "",
        e.driver_email || "",
        e.driver_hours != null ? e.driver_hours : "",
        e.recorded_by || "",
        e.notes || "",
      ];
    });

    return csvResponse(
      toCsv(headers, rows),
      `booking_expenses_${from}_to_${to}.csv`,
    );
  }

  if (type === "overhead") {
    // All overhead lines active during the period (overlaps the range)
    const { data: overheadRaw } = await supabase
      .from("overhead_costs")
      .select("name, category, monthly_cents, effective_from, effective_to, notes")
      .order("effective_from", { ascending: true });

    const { data: catRows } = await supabase
      .from("overhead_categories")
      .select("key, label, group_name");
    const catLabel = new Map<string, { label: string; group: string | null }>(
      ((catRows as { key: string; label: string; group_name: string | null }[]) || []).map(
        (c) => [c.key, { label: c.label, group: c.group_name }],
      ),
    );

    // Filter overlap with the date range
    const fromMs = new Date(from + "T00:00:00").getTime();
    const toMs = new Date(to + "T23:59:59").getTime();
    const filtered = ((overheadRaw as any[]) || []).filter((o) => {
      const effStart = new Date((o.effective_from || from) + "T00:00:00").getTime();
      const effEnd = o.effective_to
        ? new Date(o.effective_to + "T23:59:59").getTime()
        : Number.MAX_SAFE_INTEGER;
      return effEnd >= fromMs && effStart <= toMs;
    });

    const headers = [
      "Effective From",
      "Effective To",
      "Group",
      "Category",
      "Name",
      "Monthly Amount (USD)",
      "Annual Amount (USD)",
      "Notes",
    ];

    const rows = filtered.map((o) => {
      const cat = catLabel.get(o.category);
      const monthly = (o.monthly_cents || 0) / 100;
      return [
        o.effective_from || "",
        o.effective_to || "Active",
        cat?.group || "",
        cat?.label || o.category,
        o.name || "",
        monthly.toFixed(2),
        (monthly * 12).toFixed(2),
        o.notes || "",
      ];
    });

    return csvResponse(toCsv(headers, rows), `overhead_costs_${from}_to_${to}.csv`);
  }

  if (type === "pnl") {
    const pnl = await computePnL(from, to);
    const { data: overheadCats } = await supabase
      .from("overhead_categories")
      .select("key, label");
    const { data: expenseCats } = await supabase
      .from("booking_expense_categories")
      .select("key, label");
    const ovLabel = new Map<string, string>(
      ((overheadCats as { key: string; label: string }[]) || []).map((c) => [c.key, c.label]),
    );
    const exLabel = new Map<string, string>(
      ((expenseCats as { key: string; label: string }[]) || []).map((c) => [c.key, c.label]),
    );

    const headers = ["Line", "Category", "Amount (USD)"];
    const rows: unknown[][] = [
      ["Revenue", "Paid bookings", (pnl.revenue_cents / 100).toFixed(2)],
    ];
    for (const [cat, amt] of Object.entries(pnl.expenses_by_category)) {
      rows.push(["Direct cost", exLabel.get(cat) || cat, (-amt / 100).toFixed(2)]);
    }
    rows.push([
      "Gross profit",
      `${pnl.revenue_cents > 0 ? ((pnl.gross_profit_cents / pnl.revenue_cents) * 100).toFixed(1) : 0}% margin`,
      (pnl.gross_profit_cents / 100).toFixed(2),
    ]);
    for (const [cat, amt] of Object.entries(pnl.overhead_by_category)) {
      rows.push(["Overhead allocated", ovLabel.get(cat) || cat, (-amt / 100).toFixed(2)]);
    }
    rows.push([
      "NET PROFIT",
      `${(pnl.margin_pct * 100).toFixed(1)}% net margin`,
      (pnl.net_profit_cents / 100).toFixed(2),
    ]);

    return csvResponse(toCsv(headers, rows), `pnl_summary_${from}_to_${to}.csv`);
  }

  if (type === "tax") {
    // Sales tax / IVA / VAT collected per paid booking — for filing.
    const { data: taxLabelRow } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "tax_label")
      .maybeSingle();
    const taxLabel = String(taxLabelRow?.value || "Sales tax");

    const { data: bookings } = await supabase
      .from("bookings")
      .select(
        "id, event_date, customer_email, customer_first_name, customer_last_name, customer_address, product_name, total_amount, tax_cents",
      )
      .gte("event_date", from)
      .lte("event_date", to)
      .eq("stripe_payment_status", "paid")
      .neq("booking_status", "cancelled")
      .order("event_date", { ascending: true });

    const headers = [
      "Event date",
      "Booking ID",
      "Customer",
      "Email",
      "Address",
      "Product",
      "Pre-tax revenue (USD)",
      `${taxLabel} collected (USD)`,
      "Customer paid total (USD)",
    ];
    const rows = ((bookings as any[]) || [])
      .filter((b) => (b.tax_cents || 0) > 0)
      .map((b) => {
        const tax = Number(b.tax_cents) || 0;
        const total = Number(b.total_amount) || 0;
        const preTax = total - tax;
        const customer = [b.customer_first_name, b.customer_last_name]
          .filter(Boolean)
          .join(" ");
        return [
          b.event_date,
          b.id,
          customer || "",
          b.customer_email || "",
          b.customer_address || "",
          b.product_name || "",
          (preTax / 100).toFixed(2),
          (tax / 100).toFixed(2),
          (total / 100).toFixed(2),
        ];
      });

    // Append totals row at the bottom
    const totalPreTax = rows.reduce((s, r) => s + parseFloat(r[6] as string), 0);
    const totalTax = rows.reduce((s, r) => s + parseFloat(r[7] as string), 0);
    const totalAll = rows.reduce((s, r) => s + parseFloat(r[8] as string), 0);
    rows.push([
      "TOTAL",
      "",
      "",
      "",
      "",
      "",
      totalPreTax.toFixed(2),
      totalTax.toFixed(2),
      totalAll.toFixed(2),
    ]);

    return csvResponse(toCsv(headers, rows), `tax_collected_${from}_to_${to}.csv`);
  }

  if (type === "sales-receipts") {
    // Paid bookings as QuickBooks Online Sales Receipts.
    // One row per booking. Columns match QBO's CSV-import format directly.
    const { data: taxLabelRow } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "tax_label")
      .maybeSingle();
    const taxLabel = String(taxLabelRow?.value || "Sales tax");

    const { data: bookings } = await supabase
      .from("bookings")
      .select(
        "id, event_date, customer_email, customer_first_name, customer_last_name, customer_phone, customer_address, product_name, total_amount, tax_cents, payment_method, paid_at, created_at",
      )
      .gte("event_date", from)
      .lte("event_date", to)
      .eq("stripe_payment_status", "paid")
      .neq("booking_status", "cancelled")
      .order("event_date", { ascending: true });

    const headers = [
      "SalesReceiptNo",
      "SalesReceiptDate",
      "Customer",
      "ProductService",
      "ProductServiceDescription",
      "Qty",
      "Rate",
      "Amount",
      `${taxLabel}`,
      "Total",
      "PaymentMethod",
      "Memo",
    ];
    const rows = ((bookings as any[]) || []).map((b) => {
      const customer = [b.customer_first_name, b.customer_last_name]
        .filter(Boolean)
        .join(" ") || b.customer_email || "Walk-in";
      const total = Number(b.total_amount) || 0;
      const tax = Number(b.tax_cents) || 0;
      const preTax = total - tax;
      const receiptNo = String(b.id || "").replace(/-/g, "").slice(0, 8).toUpperCase();
      // Prefer paid_at when present (when payment actually happened), fall
      // back to event_date so accountant sees something reasonable either way.
      const receiptDate = (b.paid_at || b.event_date || b.created_at || "")
        .toString()
        .slice(0, 10);
      return [
        receiptNo,
        receiptDate,
        customer,
        b.product_name || "Rental",
        b.product_name || "",
        1,
        (preTax / 100).toFixed(2),
        (preTax / 100).toFixed(2),
        (tax / 100).toFixed(2),
        (total / 100).toFixed(2),
        b.payment_method || "Stripe",
        `Booking ${b.id}`,
      ];
    });

    return csvResponse(
      toCsv(headers, rows),
      `qbo_sales_receipts_${from}_to_${to}.csv`,
    );
  }

  if (type === "customers") {
    // Customer list in QuickBooks Online CSV-import format.
    // Deduplicated by email (one row per unique customer with totals).
    // Use a wide date range to backfill historical customers when needed.
    const { data: bookings } = await supabase
      .from("bookings")
      .select(
        "customer_email, customer_first_name, customer_last_name, customer_phone, customer_address, event_date, total_amount, stripe_payment_status, booking_status, created_at",
      )
      .gte("event_date", from)
      .lte("event_date", to)
      .order("event_date", { ascending: true });

    interface Agg {
      email: string;
      first: string;
      last: string;
      phone: string;
      address: string;
      first_seen: string;
      last_seen: string;
      total_spent_cents: number;
      bookings_count: number;
    }
    const byEmail = new Map<string, Agg>();
    for (const b of ((bookings as any[]) || [])) {
      const email = (b.customer_email || "").toLowerCase().trim();
      if (!email) continue;
      const prev = byEmail.get(email);
      const eventDate = (b.event_date || "").slice(0, 10);
      const paid =
        b.stripe_payment_status === "paid" && b.booking_status !== "cancelled";
      if (!prev) {
        byEmail.set(email, {
          email,
          first: b.customer_first_name || "",
          last: b.customer_last_name || "",
          phone: b.customer_phone || "",
          address: b.customer_address || "",
          first_seen: eventDate,
          last_seen: eventDate,
          total_spent_cents: paid ? Number(b.total_amount) || 0 : 0,
          bookings_count: 1,
        });
      } else {
        prev.last_seen = eventDate > prev.last_seen ? eventDate : prev.last_seen;
        prev.first_seen =
          eventDate < prev.first_seen ? eventDate : prev.first_seen;
        if (paid) prev.total_spent_cents += Number(b.total_amount) || 0;
        prev.bookings_count++;
        // Backfill blank contact fields from later bookings
        if (!prev.first && b.customer_first_name) prev.first = b.customer_first_name;
        if (!prev.last && b.customer_last_name) prev.last = b.customer_last_name;
        if (!prev.phone && b.customer_phone) prev.phone = b.customer_phone;
        if (!prev.address && b.customer_address) prev.address = b.customer_address;
      }
    }

    const headers = [
      "Name",
      "Email",
      "Phone",
      "BillingAddress",
      "FirstBookingDate",
      "LastBookingDate",
      "TotalSpent (USD)",
      "BookingsCount",
    ];
    const rows = Array.from(byEmail.values())
      .sort((a, b) => b.total_spent_cents - a.total_spent_cents)
      .map((c) => {
        const name = [c.first, c.last].filter(Boolean).join(" ") || c.email;
        return [
          name,
          c.email,
          c.phone,
          c.address,
          c.first_seen,
          c.last_seen,
          (c.total_spent_cents / 100).toFixed(2),
          c.bookings_count,
        ];
      });

    return csvResponse(
      toCsv(headers, rows),
      `qbo_customers_${from}_to_${to}.csv`,
    );
  }

  return NextResponse.json(
    {
      error:
        "type must be one of: expenses, overhead, pnl, tax, sales-receipts, customers, 1099-nec",
    },
    { status: 400 },
  );
}
