// /superadmin/dashboard — operator one-glance health snapshot.
// Designed for the "RentalFlow runs itself" vision: a single screen that
// answers "is the SaaS healthy right now?" without any clicks.

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp, Users, Sparkles, AlertTriangle, Activity,
  ArrowUpRight, DollarSign, Mail, CheckCircle2, Clock,
  Zap, Crown, BarChart3, Inbox, Wrench, Database, Ticket, BookOpen, Heart, Rocket, CreditCard, Server, ShieldCheck, KeyRound, Beaker,
} from "lucide-react";
import { getSuperadminUser } from "@/lib/auth/superadmin";
import { fetchDashboardData } from "@/lib/superadmin/dashboard-data";
import { fetchSystemHealth } from "@/lib/superadmin/system-health";
import { getOrGenerateTodayInsight } from "@/lib/superadmin/daily-insight";
import { fetchActiveGoals, formatGoalLabel } from "@/lib/superadmin/goals";
import { Sparkline } from "./Sparkline";

export const dynamic = "force-dynamic";
export const revalidate = 60;

function formatMoney(cents: number) {
  if (cents >= 100_000_00) return `$${(cents / 1_00_000_00).toFixed(1)}M`;
  if (cents >= 100_00) return `$${(cents / 1_000_00).toFixed(1)}K`;
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default async function DashboardPage() {
  const me = await getSuperadminUser();
  if (!me) redirect("/superadmin/login?error=not_superadmin");

  const [data, sysHealth, insight, goals] = await Promise.all([
    fetchDashboardData(),
    fetchSystemHealth(),
    getOrGenerateTodayInsight(),
    fetchActiveGoals(),
  ]);
  const healthScore = computeHealthScore(data);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header with health pulse */}
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-brand-navy flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-amber-500" /> RentalFlow Command Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Hola Ludmila — todo en una pantalla. Refrescá para ver datos en vivo.
          </p>
        </div>
        <HealthPulse score={healthScore} />
      </header>

      {/* Goals progress strip */}
      {goals.length > 0 && (
        <section className="rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 ring-1 ring-amber-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-xs uppercase tracking-wider text-amber-700 font-bold flex items-center gap-1">
              🎯 Goals
            </h2>
            <Link href="/superadmin/goals" className="text-xs text-amber-700 hover:underline font-semibold">
              Manage →
            </Link>
          </div>
          <div className="space-y-2">
            {goals.slice(0, 3).map((g) => {
              const cls = g.projected_status === "achieved" ? "bg-emerald-500" :
                g.projected_status === "ahead" || g.projected_status === "on_track" ? "bg-blue-500" :
                g.projected_status === "behind" ? "bg-amber-500" : "bg-rose-500";
              return (
                <div key={g.id}>
                  <div className="flex justify-between text-xs text-slate-700 mb-1">
                    <span className="font-medium truncate">{formatGoalLabel(g)}</span>
                    <span className="font-mono ml-2">{g.current_value.toLocaleString()} / {Number(g.target).toLocaleString()} · {g.pct_complete}%</span>
                  </div>
                  <div className="h-2 bg-white/70 rounded-full overflow-hidden">
                    <div className={`${cls} h-full transition-all`} style={{ width: `${g.pct_complete}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* AI Daily Insight panel — generated 1× per day */}
      {insight && (
        <section className="rounded-2xl bg-gradient-to-br from-violet-50 via-fuchsia-50 to-rose-50 ring-1 ring-violet-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-violet-700 font-bold mb-3">
            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            AI Daily Brief · {new Date(insight.insight_date).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <InsightCard
              label="What's working"
              icon="✅"
              text={insight.whats_working}
              accent="emerald"
            />
            <InsightCard
              label="Needs attention"
              icon="⚠️"
              text={insight.needs_attention}
              accent="amber"
            />
            <InsightCard
              label="Today's focus"
              icon="🎯"
              text={insight.today_focus}
              accent="violet"
            />
          </div>
        </section>
      )}

      {/* Hero MRR card — the most important number */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl bg-gradient-to-br from-brand-navy to-indigo-900 text-white p-6 shadow-xl relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-amber-400/10 rounded-full blur-2xl" />
          <div className="absolute -right-8 -bottom-12 w-40 h-40 bg-emerald-400/10 rounded-full blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-amber-300 text-xs uppercase tracking-wider mb-2">
              <DollarSign className="h-3.5 w-3.5" /> Monthly recurring revenue
            </div>
            <div className="text-5xl sm:text-6xl font-bold">
              {formatMoney(data.mrr.current_cents)}
              <span className="text-base font-normal text-blue-200 ml-2">/mo</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-blue-200 text-xs uppercase">Monthly subs</div>
                <div className="font-semibold mt-0.5">${data.mrr.monthly.toLocaleString()}/mo</div>
              </div>
              <div>
                <div className="text-blue-200 text-xs uppercase">Annual equiv</div>
                <div className="font-semibold mt-0.5">${data.mrr.annual.toLocaleString()}/mo</div>
              </div>
              <div>
                <div className="text-blue-200 text-xs uppercase">Trial pipeline</div>
                <div className="font-semibold mt-0.5">${data.mrr.trial.toLocaleString()}/mo</div>
              </div>
            </div>
          </div>
        </div>

        {/* Health score card */}
        <div className={`rounded-2xl p-6 shadow-xl text-white relative overflow-hidden ${
          healthScore >= 80 ? "bg-gradient-to-br from-emerald-500 to-emerald-700" :
          healthScore >= 60 ? "bg-gradient-to-br from-amber-500 to-amber-700" :
          "bg-gradient-to-br from-red-500 to-red-700"
        }`}>
          <div className="text-xs uppercase tracking-wider opacity-90 mb-2 flex items-center gap-1">
            <Zap className="h-3.5 w-3.5" /> System Health
          </div>
          <div className="flex items-end gap-3 mb-3">
            <div className="text-6xl font-bold">{healthScore}</div>
            <div className="text-xl opacity-75 mb-1">/100</div>
          </div>
          <div className="text-sm opacity-95">
            {healthScore >= 80 ? "Todo en verde — sin acciones requeridas" :
             healthScore >= 60 ? "Algunas alertas para revisar" :
             "Atención necesaria"}
          </div>
          <div className="mt-3 text-xs opacity-80 flex items-center gap-2">
            <Database className="h-3 w-3" /> DB {data.health.db_response_ms}ms
          </div>
        </div>
      </section>

      {/* Tenants overview — colorful card grid */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Total tenants" value={data.tenants.total}
          icon={<Users className="h-4 w-4" />} color="indigo"
        />
        <StatCard
          label="Paying" value={data.tenants.active}
          icon={<CheckCircle2 className="h-4 w-4" />} color="emerald"
          accent={data.tenants.new_this_week > 0 ? `+${data.tenants.new_this_week} this wk` : undefined}
        />
        <StatCard
          label="In trial" value={data.tenants.trialing}
          icon={<Clock className="h-4 w-4" />} color="blue"
        />
        <StatCard
          label="Past due" value={data.tenants.past_due}
          icon={<AlertTriangle className="h-4 w-4" />}
          color={data.tenants.past_due > 0 ? "amber" : "slate"}
        />
        <StatCard
          label="Cancelling" value={data.tenants.canceling}
          icon={<TrendingUp className="h-4 w-4 rotate-180" />}
          color={data.tenants.canceling > 0 ? "rose" : "slate"}
        />
        <StatCard
          label="New (30d)" value={data.tenants.new_this_month}
          icon={<Sparkles className="h-4 w-4" />} color="amber"
          spark={data.signups_sparkline}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent signups */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
            <h2 className="font-bold text-brand-navy flex items-center gap-2">
              <Users className="h-4 w-4" /> Recent signups
            </h2>
            <Link href="/superadmin/tenants" className="text-xs text-brand-navy hover:underline inline-flex items-center gap-0.5">
              All tenants <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {data.recent_signups.length === 0 ? (
              <li className="px-5 py-8 text-center text-sm text-slate-400">
                No tenants yet. Outbound is sending — be patient.
              </li>
            ) : data.recent_signups.map((t) => (
              <li key={t.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition">
                <div className="min-w-0">
                  <Link href={`/superadmin/tenants/${t.id}`} className="font-semibold text-brand-navy hover:underline">
                    {t.business_name}
                  </Link>
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    {t.plan === "founder" ? <Crown className="h-3 w-3 text-amber-500" /> : null}
                    Plan: <span className="font-semibold">{t.plan}</span>
                    {t.subscription_status && (
                      <StatusPill status={t.subscription_status} />
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-400">{timeAgo(t.created_at)}</div>
              </li>
            ))}
          </ul>
        </div>

        {/* Activity feed */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-purple-50">
            <h2 className="font-bold text-brand-navy flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4" /> Recent activity
            </h2>
          </div>
          <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {data.recent_activity.length === 0 ? (
              <li className="p-4 text-center text-xs text-slate-400">No activity yet.</li>
            ) : data.recent_activity.map((a, i) => (
              <li key={i} className="px-4 py-2.5">
                <div className="text-xs font-semibold text-brand-navy">{a.action}</div>
                <div className="text-[11px] text-slate-500 truncate">{a.detail}</div>
                <div className="text-[10px] text-slate-400">{timeAgo(a.when)}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Health alerts + outbound funnel */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="font-bold text-brand-navy flex items-center gap-2 mb-3">
            <Wrench className="h-4 w-4" /> Items needing attention
          </h2>
          {data.health.failed_payments === 0 && data.health.expired_trials_unpaid === 0 && data.health.inactive_30d === 0 ? (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-emerald-900 flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Todo limpio. Volvé después.
            </div>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.health.failed_payments > 0 && (
                <li className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
                  <span className="text-amber-900 inline-flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Failed payments
                  </span>
                  <span className="font-bold text-amber-900">{data.health.failed_payments}</span>
                </li>
              )}
              {data.health.expired_trials_unpaid > 0 && (
                <li className="flex items-center justify-between bg-rose-50 border border-rose-200 rounded-lg px-4 py-2.5">
                  <span className="text-rose-900 inline-flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Expired trials (didn't convert)
                  </span>
                  <span className="font-bold text-rose-900">{data.health.expired_trials_unpaid}</span>
                </li>
              )}
              {data.health.inactive_30d > 0 && (
                <li className="flex items-center justify-between bg-slate-100 border border-slate-200 rounded-lg px-4 py-2.5">
                  <span className="text-slate-900 inline-flex items-center gap-2">
                    <Activity className="h-4 w-4" /> Inactive 30+ days
                  </span>
                  <span className="font-bold text-slate-900">{data.health.inactive_30d}</span>
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 rounded-xl shadow-sm border border-amber-200 p-5">
          <h2 className="font-bold text-brand-navy flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4" /> Outbound funnel
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-amber-900 uppercase tracking-wider">Total leads</div>
              <div className="text-2xl font-bold text-brand-navy mt-1">{data.outbound.leads_total}</div>
            </div>
            <div>
              <div className="text-xs text-amber-900 uppercase tracking-wider">Last 7d</div>
              <div className="text-2xl font-bold text-brand-navy mt-1">+{data.outbound.leads_this_week}</div>
            </div>
            <div>
              <div className="text-xs text-amber-900 uppercase tracking-wider">Inbox replies</div>
              <div className="text-2xl font-bold text-brand-navy mt-1">{data.outbound.threads_with_replies}</div>
            </div>
          </div>
          <Link href="/superadmin/email" className="mt-4 inline-flex items-center gap-1 text-xs text-amber-900 font-semibold hover:underline">
            <Inbox className="h-3 w-3" /> Open inbox
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </section>

      {/* System Health widget */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`rounded-xl shadow-sm border p-4 ${
          sysHealth.overall_status === "healthy" ? "bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200" :
          sysHealth.overall_status === "warning" ? "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200" :
          "bg-gradient-to-br from-rose-50 to-pink-50 border-rose-200"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-brand-navy flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4" /> System Health
            </h3>
            <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${
              sysHealth.overall_status === "healthy" ? "bg-emerald-500 text-white" :
              sysHealth.overall_status === "warning" ? "bg-amber-500 text-white" :
              "bg-rose-500 text-white"
            }`}>
              {sysHealth.overall_status}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-slate-500 text-[10px] uppercase tracking-wider">DB</div>
              <div className="font-bold text-brand-navy">{sysHealth.db_response_ms}ms</div>
            </div>
            <div>
              <div className="text-slate-500 text-[10px] uppercase tracking-wider">Errors 24h</div>
              <div className={`font-bold ${sysHealth.recent_errors_24h > 5 ? "text-rose-700" : "text-brand-navy"}`}>
                {sysHealth.recent_errors_24h}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-[10px] uppercase tracking-wider">Email</div>
              <div className={`font-bold ${sysHealth.email_send_ok ? "text-emerald-700" : "text-rose-700"}`}>
                {sysHealth.email_send_ok ? "OK" : "OFF"}
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200/50">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Crons</div>
            <div className="flex flex-wrap gap-1">
              {sysHealth.crons.slice(0, 8).map((c) => (
                <span key={c.name}
                  className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                    c.status === "healthy" ? "bg-emerald-200 text-emerald-900" :
                    c.status === "warning" ? "bg-amber-200 text-amber-900" :
                    c.status === "stale" ? "bg-rose-200 text-rose-900" :
                    "bg-slate-100 text-slate-500"
                  }`}>
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        <Link href="/superadmin/billing" className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white p-4 shadow-sm hover:shadow-md transition relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-xl" />
          <div className="relative">
            <h3 className="font-bold flex items-center gap-2 text-sm">
              <CreditCard className="h-4 w-4" /> Stripe billing
            </h3>
            <div className="text-3xl font-bold mt-2">${(data.mrr.current_cents / 100).toLocaleString()}</div>
            <div className="text-xs text-teal-100 mt-1">MRR · click for invoices + failed payments</div>
          </div>
        </Link>

        <Link href="/superadmin/onboarding" className="rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 text-white p-4 shadow-sm hover:shadow-md transition relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-xl" />
          <div className="relative">
            <h3 className="font-bold flex items-center gap-2 text-sm">
              <Rocket className="h-4 w-4" /> Activation
            </h3>
            <div className="text-3xl font-bold mt-2">{data.tenants.trialing + data.tenants.new_this_month}</div>
            <div className="text-xs text-cyan-100 mt-1">tenants activating · auto-nudges running</div>
          </div>
        </Link>
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="font-bold text-brand-navy mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" /> Quick actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          <QuickAction href="/superadmin/tenants" icon={<Users className="h-4 w-4" />} label="Tenants" color="indigo" />
          <QuickAction href="/superadmin/health" icon={<Heart className="h-4 w-4" />} label="Health" color="pink" />
          <QuickAction href="/superadmin/onboarding" icon={<Rocket className="h-4 w-4" />} label="Onboarding" color="cyan" />
          <QuickAction href="/superadmin/revenue" icon={<TrendingUp className="h-4 w-4" />} label="Revenue" color="emerald" />
          <QuickAction href="/superadmin/billing" icon={<CreditCard className="h-4 w-4" />} label="Billing" color="emerald" />
          <QuickAction href="/superadmin/activity" icon={<Activity className="h-4 w-4" />} label="Activity" color="violet" />
          <QuickAction href="/superadmin/support" icon={<Ticket className="h-4 w-4" />} label="Support" color="violet" />
          <QuickAction href="/superadmin/kb" icon={<BookOpen className="h-4 w-4" />} label="KB" color="blue" />
          <QuickAction href="/superadmin/email" icon={<Mail className="h-4 w-4" />} label="Email" color="emerald" />
          <QuickAction href="/superadmin/email/compose" icon={<Sparkles className="h-4 w-4" />} label="Compose" color="amber" />
          <QuickAction href="/superadmin/goals" icon={<Sparkles className="h-4 w-4" />} label="Goals" color="amber" />
          <QuickAction href="/superadmin/beta-program" icon={<Beaker className="h-4 w-4" />} label="Beta program" color="violet" />
          <QuickAction href="/superadmin/users-mfa" icon={<ShieldCheck className="h-4 w-4" />} label="MFA reset" color="rose" />
          <QuickAction href="/superadmin/recovery-codes" icon={<KeyRound className="h-4 w-4" />} label="My recovery codes" color="amber" />
        </div>
      </section>

      <footer className="text-center text-xs text-slate-400 pt-6">
        Snapshot refreshes every minute · DB query {data.health.db_response_ms}ms
      </footer>
    </div>
  );
}

// ───── components ─────

function StatCard({
  label, value, icon, color, accent, spark,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "indigo" | "emerald" | "blue" | "amber" | "rose" | "slate" | "violet";
  accent?: string;
  spark?: number[];
}) {
  const colorMap = {
    indigo: { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-900", icon: "text-indigo-600", spark: "#4f46e5" },
    emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900", icon: "text-emerald-600", spark: "#059669" },
    blue: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-900", icon: "text-blue-600", spark: "#2563eb" },
    amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-900", icon: "text-amber-600", spark: "#d97706" },
    rose: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-900", icon: "text-rose-600", spark: "#e11d48" },
    slate: { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-700", icon: "text-slate-500", spark: "#64748b" },
    violet: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-900", icon: "text-violet-600", spark: "#7c3aed" },
  }[color];

  return (
    <div className={`rounded-xl ${colorMap.bg} border ${colorMap.border} p-4 shadow-sm relative overflow-hidden`}>
      <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider ${colorMap.text} opacity-80`}>
        <span className={colorMap.icon}>{icon}</span>
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 ${colorMap.text}`}>{value}</div>
      {accent && <div className={`text-[10px] font-semibold mt-0.5 ${colorMap.icon}`}>{accent}</div>}
      {spark && (
        <div className={`absolute right-2 bottom-2 ${colorMap.icon} opacity-60`}>
          <Sparkline data={spark} width={50} height={20} color={colorMap.spark} />
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "Active", cls: "bg-emerald-100 text-emerald-800" },
    trialing: { label: "Trial", cls: "bg-blue-100 text-blue-800" },
    past_due: { label: "Past due", cls: "bg-amber-100 text-amber-800" },
    canceled: { label: "Canceled", cls: "bg-slate-200 text-slate-700" },
  };
  const v = map[status] || { label: status, cls: "bg-slate-100 text-slate-600" };
  return (
    <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${v.cls}`}>{v.label}</span>
  );
}

function HealthPulse({ score }: { score: number }) {
  const cls = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 bg-white rounded-full px-3 py-1.5 shadow-sm border border-slate-200">
      <span className="relative flex h-2 w-2">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cls} opacity-75`} />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${cls}`} />
      </span>
      <span className="text-xs font-semibold text-slate-700">
        {score >= 80 ? "All systems go" : score >= 60 ? "Mostly OK" : "Needs attention"}
      </span>
    </div>
  );
}

function InsightCard({
  label, icon, text, accent,
}: {
  label: string;
  icon: string;
  text: string;
  accent: "emerald" | "amber" | "violet";
}) {
  const cls = {
    emerald: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    amber: "bg-amber-100 text-amber-800 ring-amber-200",
    violet: "bg-violet-100 text-violet-800 ring-violet-200",
  }[accent];
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm ring-1 ring-slate-100">
      <div className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold ring-1 rounded-full px-2 py-0.5 mb-2 ${cls}`}>
        <span>{icon}</span> {label}
      </div>
      <p className="text-sm text-slate-700 leading-relaxed">{text || "(no data yet)"}</p>
    </div>
  );
}

function QuickAction({
  href, icon, label, color,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  color: "indigo" | "emerald" | "amber" | "violet" | "rose" | "blue" | "pink" | "cyan";
}) {
  const colors = {
    indigo: "bg-indigo-600 hover:bg-indigo-700",
    emerald: "bg-emerald-600 hover:bg-emerald-700",
    amber: "bg-amber-500 hover:bg-amber-600",
    violet: "bg-violet-600 hover:bg-violet-700",
    rose: "bg-rose-600 hover:bg-rose-700",
    blue: "bg-blue-600 hover:bg-blue-700",
    pink: "bg-gradient-to-br from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700",
    cyan: "bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700",
  };
  return (
    <Link
      href={href}
      className={`${colors[color]} text-white rounded-xl p-4 shadow-sm flex items-center gap-2 text-sm font-semibold transition hover:scale-[1.02]`}
    >
      {icon}
      {label}
      <ArrowUpRight className="h-3.5 w-3.5 ml-auto opacity-75" />
    </Link>
  );
}

function computeHealthScore(d: Awaited<ReturnType<typeof fetchDashboardData>>): number {
  let score = 100;
  // Penalize failed payments
  score -= Math.min(20, d.health.failed_payments * 5);
  // Penalize expired trials that never converted
  score -= Math.min(15, d.health.expired_trials_unpaid * 3);
  // Penalize slow DB
  if (d.health.db_response_ms > 500) score -= 10;
  else if (d.health.db_response_ms > 200) score -= 5;
  // Penalize cancelling tenants
  score -= Math.min(15, d.tenants.canceling * 5);
  return Math.max(0, Math.min(100, score));
}
