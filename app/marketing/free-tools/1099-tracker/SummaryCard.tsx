"use client";

import { Download, Mail, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Summary } from "@/lib/marketing/1099-tracker-logic";

const CURRENT_YEAR = new Date().getFullYear();

export function SummaryCard({
  summary,
  taxYear,
  onTaxYearChange,
  onDownload,
  onEmailMe,
}: {
  summary: Summary;
  taxYear: number;
  onTaxYearChange: (y: number) => void;
  onDownload: () => void;
  onEmailMe: () => void;
}) {
  const over = summary.rows.filter((r) => r.overThreshold);
  const under = summary.rows.filter((r) => !r.overThreshold && r.paymentCount > 0);
  const years = [CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3];

  return (
    <div className="card border-2 border-brand-navy">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-lg font-bold text-brand-navy">
          📊 Step 3: Your 1099 summary
        </h2>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Tax year:
          <select
            className="input py-1 text-sm w-24"
            value={taxYear}
            onChange={(e) => onTaxYearChange(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
      </div>

      {summary.driverCount === 0 ? (
        <p className="text-sm text-slate-500">Add contractors and log payments above to see your summary.</p>
      ) : (
        <div className="space-y-3 text-sm">
          {over.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3">
              <div className="font-semibold text-amber-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {over.length} contractor{over.length !== 1 ? "s" : ""} over $600 threshold — 1099-NEC required
              </div>
              <ul className="mt-1 text-amber-800 text-xs space-y-1">
                {over.map((r) => (
                  <li key={r.driverId}>
                    → {r.name}: <span className="font-mono">${(r.totalCents / 100).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {under.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded p-3">
              <div className="font-semibold text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {under.length} contractor{under.length !== 1 ? "s" : ""} under threshold (no 1099 required)
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-4">
        <button
          type="button"
          onClick={onDownload}
          disabled={summary.driverCount === 0}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Download CSV report
        </button>
        <button
          type="button"
          onClick={onEmailMe}
          disabled={summary.driverCount === 0}
          className="border border-brand-navy text-brand-navy hover:bg-brand-navy hover:text-white font-semibold px-4 py-2 rounded inline-flex items-center gap-2 disabled:opacity-50"
        >
          <Mail className="h-4 w-4" /> Email me a copy + tax tips
        </button>
      </div>
    </div>
  );
}
