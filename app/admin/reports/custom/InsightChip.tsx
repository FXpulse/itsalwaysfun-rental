// Pre-computed insight strip — picks the most interesting fact from a report
// result and shows it as a chip at the top. No AI, no extra DB query —
// just a pattern match on the result data.

import type { ReportResult } from "@/lib/admin/report-engine";
import { Trophy, TrendingUp, AlertTriangle } from "lucide-react";

export function InsightChip({
  result, previousResult,
}: {
  result: ReportResult;
  previousResult?: ReportResult;
}) {
  const insights: string[] = [];

  if (result.rows.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-500 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-slate-400" /> No data for this period. Try a wider date range.
      </div>
    );
  }

  // Period-over-period for the first metric
  const totalsLabels = Object.keys(result.totals);
  if (totalsLabels.length > 0 && previousResult) {
    const label = totalsLabels[0];
    const now = result.totals[label] || 0;
    const prev = previousResult.totals[label] || 0;
    if (prev > 0) {
      const pct = Math.round(((now - prev) / prev) * 100);
      const sign = pct > 0 ? "↑" : pct < 0 ? "↓" : "→";
      const color = pct > 0 ? "text-emerald-700" : pct < 0 ? "text-rose-700" : "text-slate-700";
      insights.push(`<strong class="${color}">${sign} ${Math.abs(pct)}%</strong> vs previous period for <em>${label}</em>`);
    }
  }

  // Top row
  if (result.rows.length > 0) {
    const top = result.rows[0];
    const firstMetric = Object.keys(top.metrics)[0];
    const firstMetricValue = top.metrics[firstMetric];
    insights.push(
      `Top: <strong>${top.label}</strong> with <strong>${firstMetricValue.toLocaleString()}</strong> ${firstMetric.toLowerCase()}`,
    );
  }

  if (insights.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-amber-50 to-emerald-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
      <Trophy className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
      <div className="text-sm text-slate-700 space-y-1">
        {insights.map((insight, i) => (
          <div key={i} dangerouslySetInnerHTML={{ __html: insight }} />
        ))}
      </div>
    </div>
  );
}
