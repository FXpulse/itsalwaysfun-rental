"use client";

import { Download, FileSpreadsheet } from "lucide-react";

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
            Accounting CSV export
          </h3>
          <p className="text-xs text-emerald-800 mb-2">
            Download for QuickBooks / Xero import, your accountant, or tax filing.
            Scoped to the date range above.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`${base}&type=expenses`}
              className="inline-flex items-center gap-1 bg-white border border-emerald-300 text-emerald-900 text-xs px-3 py-1.5 rounded hover:bg-emerald-100 font-medium"
            >
              <Download className="h-3 w-3" /> Booking expenses
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
            >
              <Download className="h-3 w-3" /> P&amp;L summary
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
