// Pure presentation: takes a ReportResult and renders chart + table.
// Server-renderable — no client state.

import type { ReportResult, ReportDefinition } from "@/lib/admin/report-engine";

export function ReportRenderer({
  def, result,
}: {
  def: ReportDefinition;
  result: ReportResult;
}) {
  const firstMetricKey = Object.keys(result.rows[0]?.metrics || {})[0] || "";

  return (
    <div className="space-y-4">
      {/* Totals strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(result.totals).map(([label, value]) => (
          <div key={label} className="card p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
            <div className="text-2xl font-bold text-brand-navy font-mono mt-1">
              {value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      {def.chart_type !== "table" && result.rows.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">
            {firstMetricKey} by {Object.keys(result.rows[0]?.dimensions || {}).join(" + ")}
          </h3>
          {def.chart_type === "bar" ? (
            <BarChart rows={result.rows} metricKey={firstMetricKey} />
          ) : (
            <LineChart rows={result.rows} metricKey={firstMetricKey} />
          )}
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              {Object.keys(result.rows[0]?.dimensions || {}).map((d) => (
                <th key={d} className="px-3 py-2 text-left">{d}</th>
              ))}
              {Object.keys(result.rows[0]?.metrics || {}).map((m) => (
                <th key={m} className="px-3 py-2 text-right">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.rows.length === 0 ? (
              <tr>
                <td colSpan={20} className="px-3 py-6 text-center text-slate-400">
                  No data matching filters. Filtered rows: {result.filtered_count}.
                </td>
              </tr>
            ) : result.rows.map((r, i) => (
              <tr key={i}>
                {Object.values(r.dimensions).map((v, j) => (
                  <td key={j} className="px-3 py-2 font-medium">{v}</td>
                ))}
                {Object.values(r.metrics).map((v, j) => (
                  <td key={j} className="px-3 py-2 text-right font-mono">
                    {v.toLocaleString()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Showing {result.row_count} of {result.filtered_count} matching bookings.
      </p>
    </div>
  );
}

function BarChart({ rows, metricKey }: { rows: any[]; metricKey: string }) {
  const W = 760;
  const H = 220;
  const PAD = 32;
  const maxVal = Math.max(1, ...rows.map((r) => r.metrics[metricKey] || 0));
  const barWidth = (W - PAD * 2) / Math.max(1, rows.length) * 0.7;
  const step = (W - PAD * 2) / Math.max(1, rows.length);

  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} className="w-full">
      {/* Y grid */}
      {[0.25, 0.5, 0.75, 1].map((p) => (
        <line key={p} x1={PAD} x2={W - PAD} y1={H - p * (H - PAD)} y2={H - p * (H - PAD)} stroke="#e2e8f0" strokeDasharray="2 2" />
      ))}
      {rows.slice(0, 30).map((r, i) => {
        const val = r.metrics[metricKey] || 0;
        const h = (val / maxVal) * (H - PAD);
        const x = PAD + i * step + step * 0.15;
        const y = H - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={h} fill="#10b981" rx="2" />
            {rows.length <= 12 && (
              <text x={x + barWidth / 2} y={H + 14} textAnchor="middle" fontSize="9" fill="#64748b">
                {r.label.length > 10 ? r.label.slice(0, 10) + "…" : r.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ rows, metricKey }: { rows: any[]; metricKey: string }) {
  const W = 760;
  const H = 220;
  const PAD = 32;
  const maxVal = Math.max(1, ...rows.map((r) => r.metrics[metricKey] || 0));
  const points = rows.map((r, i) => {
    const x = PAD + (i / Math.max(1, rows.length - 1)) * (W - PAD * 2);
    const y = H - ((r.metrics[metricKey] || 0) / maxVal) * (H - PAD);
    return { x, y, v: r.metrics[metricKey] || 0 };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${path} L ${points[points.length - 1]?.x ?? W - PAD} ${H} L ${points[0]?.x ?? PAD} ${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} className="w-full">
      <defs>
        <linearGradient id="lineGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((p) => (
        <line key={p} x1={PAD} x2={W - PAD} y1={H - p * (H - PAD)} y2={H - p * (H - PAD)} stroke="#e2e8f0" strokeDasharray="2 2" />
      ))}
      <path d={area} fill="url(#lineGrad)" />
      <path d={path} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#4f46e5" />
      ))}
    </svg>
  );
}
