import { redirect } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Users,
  LayoutDashboard,
  ArrowUpRight,
  ArrowDownRight,
  Crown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchRevenueData } from "@/lib/superadmin/revenue-data";

export const dynamic = "force-dynamic";

export default async function SuperadminRevenuePage() {
  const authClient = createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) redirect("/superadmin/login");

  const supabase = createAdminClient({ unscoped: true });
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .eq("is_superadmin", true)
    .maybeSingle();
  if (!roleRow) redirect("/superadmin/login?error=not_superadmin");

  const revenue = await fetchRevenueData();
  const mrrNow = revenue.mrr_now_cents / 100;
  const mrrThen = revenue.mrr_30d_ago_cents / 100;
  const growthPositive = revenue.mrr_growth_pct >= 0;

  // Build sparkline SVG path for 90-day MRR series
  const series = revenue.mrr_90d_series;
  const maxVal = Math.max(...series, 1);
  const W = 760;
  const H = 200;
  const path = series.map((v, i) => {
    const x = (i / (series.length - 1)) * W;
    const y = H - (v / maxVal) * (H - 20) - 10;
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  const area = `${path} L ${W} ${H} L 0 ${H} Z`;

  const wf = revenue.churn_waterfall;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Hero gradient */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white p-6 shadow-xl">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-emerald-100 mb-2">
          <LayoutDashboard className="h-3 w-3" />
          <Link href="/superadmin/dashboard" className="hover:underline">Dashboard</Link>
          <span className="text-emerald-300">›</span>
          <span>Revenue</span>
        </div>
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <TrendingUp className="h-7 w-7" /> Revenue Analytics
            </h1>
            <p className="text-sm text-emerald-100 mt-1">MRR trends, cohorts &amp; churn.</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-emerald-100">MRR now</div>
            <div className="text-4xl font-bold font-mono">${mrrNow.toLocaleString()}</div>
            <div className={`text-xs inline-flex items-center gap-1 ${growthPositive ? "text-emerald-100" : "text-rose-100"}`}>
              {growthPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(revenue.mrr_growth_pct)}% vs 30d ago (${mrrThen.toLocaleString()})
            </div>
          </div>
        </div>
      </div>

      {/* MRR 90-day chart */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-700">MRR — last 90 days</h2>
          <div className="text-xs text-slate-500">Daily snapshot · ${(maxVal / 100).toLocaleString()} peak</div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="mrrGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#mrrGrad)" />
          <path d={path} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinejoin="round" />
        </svg>
        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
          <span>90 days ago</span>
          <span>60d</span>
          <span>30d</span>
          <span>Today</span>
        </div>
      </div>

      {/* Churn waterfall + Plan distribution side by side */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5 bg-gradient-to-br from-slate-50 to-white">
          <h2 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-500" /> Churn Waterfall (30d)
          </h2>
          <div className="space-y-2">
            <WaterfallRow label="Start of period" count={wf.start_count} kind="neutral" />
            <WaterfallRow label="New signups" count={wf.new} kind="positive" />
            <WaterfallRow label="Upgrades" count={wf.upgrades} kind="positive" />
            <WaterfallRow label="Downgrades" count={wf.downgrades} kind="negative" />
            <WaterfallRow label="Churned" count={wf.churned} kind="negative" />
            <div className="border-t-2 border-slate-300 my-2"></div>
            <WaterfallRow label="End of period" count={wf.end_count} kind="bold" />
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Net: <strong className={wf.end_count >= wf.start_count ? "text-emerald-600" : "text-rose-600"}>
              {wf.end_count >= wf.start_count ? "+" : ""}{wf.end_count - wf.start_count}
            </strong> tenants
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" /> Plan Distribution
          </h2>
          {revenue.plan_distribution.length === 0 ? (
            <p className="text-sm text-slate-400">No active plans yet.</p>
          ) : (
            <div className="space-y-3">
              {revenue.plan_distribution.map((p) => (
                <div key={p.plan}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize font-medium">{p.plan}</span>
                    <span className="text-slate-500">{p.count} · {p.pct}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        p.plan === "founder" ? "bg-amber-400" :
                        p.plan === "enterprise" ? "bg-violet-500" :
                        p.plan === "pro" ? "bg-indigo-500" :
                        "bg-emerald-500"
                      }`}
                      style={{ width: `${p.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cohort retention table */}
      <div className="card p-0 overflow-x-auto">
        <div className="p-5 pb-3">
          <h2 className="font-bold text-slate-700">Cohort Retention (last 12 months)</h2>
          <p className="text-xs text-slate-500 mt-1">How many tenants from each signup month are still paying.</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Cohort</th>
              <th className="px-3 py-2 text-right">Signed up</th>
              <th className="px-3 py-2 text-right">Still active</th>
              <th className="px-3 py-2 text-right">Retention</th>
              <th className="px-3 py-2 text-right">MRR now</th>
              <th className="px-3 py-2 text-right">ARPU</th>
              <th className="px-3 py-2 text-left">Visual</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {revenue.cohort_table.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                  No cohorts yet.
                </td>
              </tr>
            ) : revenue.cohort_table.map((c) => (
              <tr key={c.cohort_month}>
                <td className="px-3 py-2 font-mono text-xs">{c.cohort_month}</td>
                <td className="px-3 py-2 text-right">{c.signed_up}</td>
                <td className="px-3 py-2 text-right">{c.still_active}</td>
                <td className={`px-3 py-2 text-right font-semibold ${
                  c.retention_pct >= 80 ? "text-emerald-600" :
                  c.retention_pct >= 50 ? "text-amber-600" :
                  "text-rose-600"
                }`}>{c.retention_pct}%</td>
                <td className="px-3 py-2 text-right font-mono text-emerald-700">
                  ${(c.mrr_now_cents / 100).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-600 text-xs">
                  ${(c.arpu_cents / 100).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <div className="h-2 bg-slate-100 rounded-full w-32 overflow-hidden">
                    <div
                      className={`h-full ${
                        c.retention_pct >= 80 ? "bg-emerald-500" :
                        c.retention_pct >= 50 ? "bg-amber-500" :
                        "bg-rose-500"
                      }`}
                      style={{ width: `${c.retention_pct}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 text-center">
        💡 MRR series assumes $99/mo flat. Plan tiers tracked separately above.
      </p>
    </div>
  );
}

function WaterfallRow({
  label, count, kind,
}: { label: string; count: number; kind: "neutral" | "positive" | "negative" | "bold" }) {
  const cls = {
    neutral: "text-slate-600",
    positive: "text-emerald-600",
    negative: "text-rose-600",
    bold: "text-slate-900 font-bold",
  }[kind];
  const sign = kind === "positive" ? "+" : kind === "negative" ? "−" : "";
  return (
    <div className={`flex justify-between text-sm ${cls}`}>
      <span>{label}</span>
      <span className="font-mono">{sign}{count}</span>
    </div>
  );
}
