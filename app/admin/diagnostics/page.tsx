import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { runAllChecks, type CheckResult, type CheckStatus } from "@/lib/diagnostics";
import { BackupPanel } from "./BackupPanel";
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Info,
  RefreshCcw,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DiagnosticsPage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/dashboard");

  const results = await runAllChecks();

  const summary = {
    ok: results.filter((r) => r.status === "ok").length,
    warn: results.filter((r) => r.status === "warn").length,
    fail: results.filter((r) => r.status === "fail").length,
    info: results.filter((r) => r.status === "info").length,
  };

  // Group by group
  const byGroup = new Map<string, CheckResult[]>();
  for (const r of results) {
    if (!byGroup.has(r.group)) byGroup.set(r.group, []);
    byGroup.get(r.group)!.push(r);
  }

  // Overall health verdict
  let verdict: { color: string; emoji: string; label: string };
  if (summary.fail > 0) {
    verdict = { color: "red", emoji: "🚨", label: `${summary.fail} blocker${summary.fail === 1 ? "" : "s"}` };
  } else if (summary.warn > 0) {
    verdict = { color: "amber", emoji: "⚠", label: `${summary.warn} warning${summary.warn === 1 ? "" : "s"}` };
  } else {
    verdict = { color: "emerald", emoji: "✅", label: "All systems green" };
  }
  const verdictBg = {
    red: "bg-red-50 border-red-300 text-red-900",
    amber: "bg-amber-50 border-amber-300 text-amber-900",
    emerald: "bg-emerald-50 border-emerald-300 text-emerald-900",
  }[verdict.color];

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between mb-2">
        <h1 className="text-2xl font-bold text-brand-navy flex items-center gap-2">
          <Activity className="h-6 w-6" /> System diagnostics
        </h1>
        <a
          href="/admin/diagnostics"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-navy"
        >
          <RefreshCcw className="h-3 w-3" /> Re-run
        </a>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Health check across env vars, database tables, site settings, and recent
        activity. Run before launching, before tests, or whenever something
        feels off.
      </p>

      {/* Verdict banner */}
      <div className={`border-l-4 rounded p-4 mb-6 ${verdictBg}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{verdict.emoji}</span>
          <div>
            <div className="font-bold text-lg">{verdict.label}</div>
            <div className="text-xs opacity-80">
              {summary.ok} OK · {summary.warn} warn · {summary.fail} fail ·{" "}
              {summary.info} info
            </div>
          </div>
        </div>
      </div>

      {/* Failures first (banner already shown the count, here's the detail) */}
      {summary.fail > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-red-700 mb-2">
            🚨 Blockers — fix these first
          </h2>
          <div className="space-y-2">
            {results
              .filter((r) => r.status === "fail")
              .map((r, i) => (
                <CheckRow key={i} r={r} />
              ))}
          </div>
        </section>
      )}

      {/* Warnings */}
      {summary.warn > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-amber-700 mb-2">
            ⚠ Warnings — not blocking but worth fixing
          </h2>
          <div className="space-y-2">
            {results
              .filter((r) => r.status === "warn")
              .map((r, i) => (
                <CheckRow key={i} r={r} />
              ))}
          </div>
        </section>
      )}

      {/* Full per-group breakdown */}
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">
        All checks (by group)
      </h2>
      <div className="space-y-4">
        {Array.from(byGroup.entries()).map(([group, items]) => (
          <div key={group} className="card p-0 overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {group}{" "}
                <span className="text-slate-400 font-normal">({items.length})</span>
              </h3>
            </div>
            <ul className="divide-y divide-slate-100">
              {items.map((r, i) => (
                <li key={i}>
                  <CheckRow r={r} compact />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <BackupPanel />
    </div>
  );
}

function CheckRow({ r, compact }: { r: CheckResult; compact?: boolean }) {
  const icon = {
    ok: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
    warn: <AlertCircle className="h-4 w-4 text-amber-600" />,
    fail: <XCircle className="h-4 w-4 text-red-600" />,
    info: <Info className="h-4 w-4 text-slate-400" />,
  }[r.status as CheckStatus];
  const bg = {
    ok: compact ? "" : "bg-emerald-50 border-emerald-200",
    warn: compact ? "" : "bg-amber-50 border-amber-200",
    fail: compact ? "" : "bg-red-50 border-red-200",
    info: compact ? "" : "bg-slate-50 border-slate-200",
  }[r.status as CheckStatus];

  return (
    <div
      className={`flex items-start gap-2 px-4 py-2 text-sm ${
        compact ? "" : `rounded border ${bg}`
      }`}
    >
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-medium text-slate-800">{r.name}</span>
          <span className="text-xs text-slate-500">{r.message}</span>
        </div>
        {r.hint && (
          <div className="text-[11px] text-slate-500 mt-0.5 italic">→ {r.hint}</div>
        )}
      </div>
    </div>
  );
}
