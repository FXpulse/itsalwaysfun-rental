// /superadmin/health — per-tenant health overview.
// Heatmap-style grid + at-risk leaderboard + healthy showcase.

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Heart, TrendingDown, TrendingUp, Sparkles, AlertTriangle,
  ChevronRight, Activity, Crown,
} from "lucide-react";
import { getSuperadminUser } from "@/lib/auth/superadmin";
import { fetchAllTenantHealth, type TenantHealthRow } from "@/lib/superadmin/health-data";
import { Crumbs } from "../Crumbs";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export default async function HealthPage() {
  const me = await getSuperadminUser();
  if (!me) redirect("/superadmin/login?error=not_superadmin");

  const rows = await fetchAllTenantHealth();

  // Buckets
  const churning = rows.filter((r) => r.health.band === "churning");
  const at_risk = rows.filter((r) => r.health.band === "at_risk");
  const watch = rows.filter((r) => r.health.band === "watch");
  const healthy = rows.filter((r) => r.health.band === "healthy");

  const total = rows.length;
  const avgScore = total > 0 ? Math.round(rows.reduce((s, r) => s + r.health.score, 0) / total) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <Crumbs trail={[{ label: "Tenant Health" }]} />

      {/* Hero */}
      <header className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl bg-gradient-to-br from-rose-500 via-pink-600 to-fuchsia-700 text-white p-6 shadow-xl relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-yellow-300/20 rounded-full blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-pink-100 text-xs uppercase tracking-wider mb-2">
              <Heart className="h-3.5 w-3.5" /> Customer Health Pulse
            </div>
            <div className="text-6xl font-bold">{avgScore}<span className="text-2xl font-normal opacity-75 ml-1">/100</span></div>
            <div className="mt-3 text-sm text-pink-100">
              Average across {total} tenant{total !== 1 ? "s" : ""}.
              {churning.length > 0
                ? ` 🚨 ${churning.length} churning — action this week.`
                : ` All accounts above critical line.`}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white p-6 shadow-xl">
          <div className="text-xs uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1">
            <Activity className="h-3.5 w-3.5" /> Health distribution
          </div>
          <div className="space-y-2 text-sm">
            <DistRow label="🟢 Healthy" count={healthy.length} total={total} color="bg-emerald-400" />
            <DistRow label="🔵 Watch" count={watch.length} total={total} color="bg-blue-400" />
            <DistRow label="🟡 At risk" count={at_risk.length} total={total} color="bg-amber-400" />
            <DistRow label="🔴 Churning" count={churning.length} total={total} color="bg-rose-500" />
          </div>
        </div>
      </header>

      {/* Action queue — at risk + churning */}
      {(churning.length + at_risk.length) > 0 && (
        <section>
          <h2 className="font-bold text-brand-navy mb-3 flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-rose-500" /> Needs your attention this week
          </h2>
          <div className="space-y-2">
            {[...churning, ...at_risk].slice(0, 8).map((r) => <ActionCard key={r.id} row={r} />)}
          </div>
        </section>
      )}

      {/* Watch list */}
      {watch.length > 0 && (
        <section>
          <h2 className="font-bold text-brand-navy mb-3 flex items-center gap-2 text-lg">
            <TrendingDown className="h-5 w-5 text-blue-500" /> Watch list ({watch.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {watch.slice(0, 9).map((r) => <CompactCard key={r.id} row={r} />)}
          </div>
        </section>
      )}

      {/* Healthy showcase */}
      {healthy.length > 0 && (
        <section>
          <h2 className="font-bold text-brand-navy mb-3 flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-emerald-500" /> Thriving ({healthy.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {healthy.slice(0, 12).map((r) => <CompactCard key={r.id} row={r} />)}
          </div>
        </section>
      )}

      {/* Empty */}
      {rows.length === 0 && (
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200 rounded-xl p-10 text-center">
          <TrendingUp className="h-12 w-12 text-slate-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-brand-navy">No tenants yet</h2>
          <p className="text-sm text-slate-500 mt-1">Once your outbound lands the first paying tenant, this page will light up.</p>
        </div>
      )}
    </div>
  );
}

function DistRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-0.5">
        <span>{label}</span>
        <span className="font-bold">{count} <span className="opacity-60">({pct}%)</span></span>
      </div>
      <div className="h-1.5 bg-slate-600 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ActionCard({ row }: { row: TenantHealthRow }) {
  return (
    <Link
      href={`/superadmin/tenants/${row.id}`}
      className={`block rounded-xl border-l-4 ${
        row.health.band === "churning" ? "border-l-rose-500 bg-rose-50" : "border-l-amber-500 bg-amber-50"
      } bg-white shadow-sm hover:shadow-md transition p-4`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-bold text-brand-navy truncate">{row.business_name}</h3>
            <HealthBadge score={row.health.score} band={row.health.band} />
            {row.plan === "founder" && <Crown className="h-3.5 w-3.5 text-amber-500" />}
          </div>
          <div className="flex flex-wrap gap-1 mb-2">
            {row.health.signals.map((s, i) => (
              <SignalChip key={i} signal={s} />
            ))}
          </div>
          <p className="text-xs text-slate-600 italic">→ {row.health.hint}</p>
          {row.health.predicted_churn_at && (
            <ChurnPrediction
              date={row.health.predicted_churn_at}
              confidence={row.health.churn_confidence!}
            />
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-slate-300 mt-1 shrink-0" />
      </div>
    </Link>
  );
}

function ChurnPrediction({ date, confidence }: { date: string; confidence: "low" | "medium" | "high" }) {
  const d = new Date(date);
  const daysOut = Math.round((d.getTime() - Date.now()) / 86_400_000);
  const cls = {
    high: "bg-rose-100 text-rose-800 ring-rose-200",
    medium: "bg-amber-100 text-amber-800 ring-amber-200",
    low: "bg-slate-100 text-slate-700 ring-slate-200",
  }[confidence];
  return (
    <div className={`mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold ring-1 rounded-full px-2 py-0.5 ${cls}`}>
      🔮 Predicted churn: {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ({daysOut > 0 ? `in ${daysOut}d` : "overdue"}) · {confidence} conf
    </div>
  );
}

function CompactCard({ row }: { row: TenantHealthRow }) {
  const bg = row.health.band === "healthy" ? "from-emerald-50 to-teal-50 border-emerald-200" :
             row.health.band === "watch" ? "from-blue-50 to-indigo-50 border-blue-200" :
             row.health.band === "at_risk" ? "from-amber-50 to-yellow-50 border-amber-200" :
             "from-rose-50 to-pink-50 border-rose-200";
  return (
    <Link
      href={`/superadmin/tenants/${row.id}`}
      className={`block rounded-xl bg-gradient-to-br ${bg} border shadow-sm hover:shadow-md transition p-3`}
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-brand-navy text-sm truncate flex items-center gap-1">
          {row.plan === "founder" && <Crown className="h-3 w-3 text-amber-500" />}
          {row.business_name}
        </h3>
        <HealthBadge score={row.health.score} band={row.health.band} compact />
      </div>
      <div className="text-[11px] text-slate-600 mt-1">
        {row.bookings_last_30d} bookings/30d · {row.bookings_lifetime} lifetime
        {row.open_tickets > 0 && <span className="text-rose-700 ml-1">· {row.open_tickets} open ticket{row.open_tickets > 1 ? "s" : ""}</span>}
      </div>
    </Link>
  );
}

function HealthBadge({ score, band, compact }: { score: number; band: string; compact?: boolean }) {
  const map: Record<string, string> = {
    healthy: "bg-emerald-500",
    watch: "bg-blue-500",
    at_risk: "bg-amber-500",
    churning: "bg-rose-500",
  };
  if (compact) {
    return (
      <span className={`text-[10px] font-bold text-white rounded-full px-2 py-0.5 ${map[band] || map.watch}`}>
        {score}
      </span>
    );
  }
  return (
    <span className={`text-xs font-bold text-white rounded-full px-2 py-0.5 ${map[band] || map.watch}`}>
      {score}/100 · {band.replace("_", " ")}
    </span>
  );
}

function SignalChip({ signal }: { signal: { label: string; delta: number; color: "positive" | "warning" | "negative" } }) {
  const map = {
    positive: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-800",
    negative: "bg-rose-100 text-rose-800",
  };
  return (
    <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${map[signal.color]}`}>
      {signal.delta > 0 ? "+" : ""}{signal.delta} · {signal.label}
    </span>
  );
}
