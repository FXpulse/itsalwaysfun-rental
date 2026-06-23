"use client";

import Link from "next/link";
import { Download, FileSpreadsheet, FileText, Receipt, Users } from "lucide-react";

export function AccountingExportButtons({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const base = `/api/admin/accounting/export?from=${from}&to=${to}`;

  return (
    <div className="card p-3 bg-emerald-50 border-emerald-200">
      <div className="flex items-start gap-3 flex-wrap">
        <FileSpreadsheet className="h-5 w-5 text-emerald-700 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-emerald-900 mb-0.5">
            QuickBooks / Xero export
          </h3>
          <p className="text-xs text-emerald-800 mb-2">
            CSVs your bookkeeper can drop directly into QuickBooks Online or Xero.
            Scoped to the date range above.
          </p>

          {/* QuickBooks income side — primary for accountants */}
          <div className="flex flex-wrap gap-2 mb-2">
            <a
              href={`${base}&type=sales-receipts`}
              className="inline-flex items-center gap-1 bg-emerald-700 border border-emerald-700 text-white text-xs px-3 py-1.5 rounded hover:bg-emerald-800 font-medium"
              title="Paid bookings as QuickBooks Sales Receipts"
            >
              <Receipt className="h-3 w-3" /> Sales receipts (QBO)
            </a>
            <a
              href={`${base}&type=customers`}
              className="inline-flex items-center gap-1 bg-emerald-700 border border-emerald-700 text-white text-xs px-3 py-1.5 rounded hover:bg-emerald-800 font-medium"
              title="Customer list with totals & last booking date"
            >
              <Users className="h-3 w-3" /> Customers (QBO)
            </a>
          </div>

          {/* Cost side + summaries — secondary */}
          <div className="flex flex-wrap gap-2">
            <a
              href={`${base}&type=expenses`}
              className="inline-flex items-center gap-1 bg-white border border-emerald-300 text-emerald-900 text-xs px-3 py-1.5 rounded hover:bg-emerald-100 font-medium"
              title="Per-booking direct costs (gas, payroll, tolls)"
            >
              <Download className="h-3 w-3" /> Booking expenses
            </a>
            <a
              href={`${base}&type=business-expenses`}
              className="inline-flex items-center gap-1 bg-white border border-emerald-300 text-emerald-900 text-xs px-3 py-1.5 rounded hover:bg-emerald-100 font-medium"
              title="General transactional expenses (marketing, contractors, supplies)"
            >
              <Download className="h-3 w-3" /> Business expenses
            </a>
            <a
              href={`${base}&type=vendors`}
              className="inline-flex items-center gap-1 bg-white border border-emerald-300 text-emerald-900 text-xs px-3 py-1.5 rounded hover:bg-emerald-100 font-medium"
              title="QBO Vendors list deduplicated from business expenses"
            >
              <Users className="h-3 w-3" /> Vendors (QBO)
            </a>
            <a
              href={`${base}&type=overhead`}
              className="inline-flex items-center gap-1 bg-white border border-emerald-300 text-emerald-900 text-xs px-3 py-1.5 rounded hover:bg-emerald-100 font-medium"
            >
              <Download className="h-3 w-3" /> Overhead
            </a>
            <a
              href={`${base}&type=pnl`}
              className="inline-flex items-center gap-1 bg-white border border-emerald-300 text-emerald-900 text-xs px-3 py-1.5 rounded hover:bg-emerald-100 font-medium"
              title="One-row totals for the selected range"
            >
              <Download className="h-3 w-3" /> P&amp;L summary
            </a>
            <a
              href={`${base}&type=monthly-pnl`}
              className="inline-flex items-center gap-1 bg-white border border-emerald-300 text-emerald-900 text-xs px-3 py-1.5 rounded hover:bg-emerald-100 font-medium"
              title="Same shape as the Monthly P&L table — one row per month in the range"
            >
              <Download className="h-3 w-3" /> Monthly P&amp;L
            </a>
            <a
              href={`${base}&type=tax`}
              className="inline-flex items-center gap-1 bg-white border border-emerald-300 text-emerald-900 text-xs px-3 py-1.5 rounded hover:bg-emerald-100 font-medium"
            >
              <Download className="h-3 w-3" /> Tax collected
            </a>
            <Link
              href="/admin/reports/1099-nec"
              className="inline-flex items-center gap-1 bg-emerald-700 border border-emerald-700 text-white text-xs px-3 py-1.5 rounded hover:bg-emerald-800 font-medium"
            >
              <FileText className="h-3 w-3" /> 1099-NEC year-end →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
