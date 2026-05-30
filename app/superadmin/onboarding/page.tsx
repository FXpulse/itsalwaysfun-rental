// /superadmin/onboarding — bird's eye view of every tenant's setup progress.

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Rocket, CheckCircle2, AlertTriangle, Sparkles, Crown,
  ChevronRight, Activity, Zap, Clock,
} from "lucide-react";
import { getSuperadminUser } from "@/lib/auth/superadmin";
import { fetchAllOnboarding } from "@/lib/superadmin/onboarding-checklist";
import { Crumbs } from "../Crumbs";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export default async function OnboardingPage() {
  const me = await getSuperadminUser();
  if (!me) redirect("/superadmin/login?error=not_superadmin");

  const all = await fetchAllOnboarding();

  // Partition
  const complete = all.filter((t) => t.status.percentage === 100);
  const stalled = all.filter((t) => t.status.is_stalled);
  const inProgress = all.filter((t) => t.status.percentage > 0 && t.status.percentage < 100 && !t.status.is_stalled);
  const fresh = all.filter((t) => t.status.percentage === 0 && t.status.days_since_signup <= 1);

  const avgCompletion = all.length > 0
    ? Math.round(all.reduce((s, t) => s + t.status.percentage, 0) / all.length)
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <Crumbs trail={[{ label: "Onboarding" }]} />

      {/* Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl bg-gradient-to-br from-cyan-500 via-sky-600 to-blue-700 text-white p-6 shadow-xl relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-44 h-44 bg-yellow-300/20 rounded-full blur-3xl" />
          <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-fuchsia-400/20 rounded-full blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-cyan-100 text-xs uppercase tracking-wider mb-2">
              <Rocket className="h-3.5 w-3.5" /> Activation Tracker
            </div>
            <div className="flex items-end gap-3">
              <div className="text-6xl font-bold">{avgCompletion}%</div>
              <div className="text-sm text-cyan-100 mb-2">average completion</div>
            </div>
            <p className="text-sm text-cyan-50 mt-3">
              {stalled.length > 0
                ? `⚠️ ${stalled.length} tenant${stalled.length > 1 ? "s" : ""} stalled — auto-nudges send daily.`
                : "Everyone is progressing nicely."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Tile icon={<CheckCircle2 className="h-4 w-4" />} label="Completed" value={complete.length} color="emerald" />
          <Tile icon={<Zap className="h-4 w-4" />} label="In progress" value={inProgress.length} color="blue" />
          <Tile icon={<AlertTriangle className="h-4 w-4" />} label="Stalled" value={stalled.length} color="amber" />
          <Tile icon={<Sparkles className="h-4 w-4" />} label="Just joined" value={fresh.length} color="violet" />
        </div>
      </div>

      {/* Stalled — most urgent */}
      {stalled.length > 0 && (
        <section>
          <h2 className="font-bold text-brand-navy mb-3 flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Stalled — auto-nudging
          </h2>
          <div className="space-y-2">
            {stalled.map((t) => <BigCard key={t.id} tenant={t} stalled />)}
          </div>
        </section>
      )}

      {/* In progress */}
      {inProgress.length > 0 && (
        <section>
          <h2 className="font-bold text-brand-navy mb-3 flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-blue-500" /> In progress
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {inProgress.map((t) => <CompactCard key={t.id} tenant={t} />)}
          </div>
        </section>
      )}

      {/* Just joined */}
      {fresh.length > 0 && (
        <section>
          <h2 className="font-bold text-brand-navy mb-3 flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-violet-500" /> Just joined ({fresh.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {fresh.map((t) => <CompactCard key={t.id} tenant={t} />)}
          </div>
        </section>
      )}

      {/* Completed showcase */}
      {complete.length > 0 && (
        <section>
          <h2 className="font-bold text-brand-navy mb-3 flex items-center gap-2 text-lg">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Fully activated ({complete.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {complete.map((t) => <CompactCard key={t.id} tenant={t} />)}
          </div>
        </section>
      )}

      {all.length === 0 && (
        <div className="bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200 rounded-xl p-10 text-center">
          <Rocket className="h-12 w-12 text-cyan-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-cyan-900">No tenants yet</h2>
          <p className="text-sm text-cyan-700 mt-1">First signup will appear here automatically.</p>
        </div>
      )}
    </div>
  );
}

function Tile({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number;
  color: "emerald" | "blue" | "amber" | "violet";
}) {
  const map = {
    emerald: "bg-gradient-to-br from-emerald-500 to-emerald-700",
    blue: "bg-gradient-to-br from-blue-500 to-blue-700",
    amber: "bg-gradient-to-br from-amber-500 to-orange-600",
    violet: "bg-gradient-to-br from-violet-500 to-purple-700",
  };
  return (
    <div className={`rounded-xl ${map[color]} p-4 text-white shadow-lg`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-90">
        {icon} {label}
      </div>
      <div className="text-3xl font-bold mt-1">{value}</div>
    </div>
  );
}

function BigCard({ tenant, stalled }: { tenant: any; stalled?: boolean }) {
  const t = tenant;
  return (
    <Link
      href={`/superadmin/tenants/${t.id}`}
      className={`block rounded-xl border-l-4 bg-white shadow-sm hover:shadow-md transition p-5 ${
        stalled ? "border-l-amber-500" : "border-l-blue-500"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h3 className="font-bold text-brand-navy text-lg">{t.business_name}</h3>
            {t.plan === "founder" && <Crown className="h-4 w-4 text-amber-500" />}
            <span className="text-xs text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
              Day {t.status.days_since_signup}
            </span>
          </div>
          <ProgressBar pct={t.status.percentage} stalled={stalled} />
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            {t.status.items.map((item: any) => (
              <div key={item.key} className={`inline-flex items-center gap-1.5 ${item.done ? "text-emerald-700" : "text-slate-400"}`}>
                {item.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                <span className={item.done ? "" : "line-through opacity-60"}>{item.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-700 italic mt-3">
            → Next: <strong>{t.status.next_step}</strong>
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
      </div>
    </Link>
  );
}

function CompactCard({ tenant }: { tenant: any }) {
  const t = tenant;
  const bg = t.status.percentage === 100
    ? "from-emerald-50 to-teal-50 border-emerald-200"
    : t.status.percentage >= 50
    ? "from-blue-50 to-indigo-50 border-blue-200"
    : "from-slate-50 to-gray-50 border-slate-200";

  return (
    <Link
      href={`/superadmin/tenants/${t.id}`}
      className={`block bg-gradient-to-br ${bg} border rounded-xl shadow-sm hover:shadow-md transition p-3`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-brand-navy text-sm truncate flex items-center gap-1">
          {t.plan === "founder" && <Crown className="h-3 w-3 text-amber-500" />}
          {t.business_name}
        </h3>
        <span className="text-xs font-bold text-brand-navy">{t.status.percentage}%</span>
      </div>
      <ProgressBar pct={t.status.percentage} compact />
      <div className="text-[10px] text-slate-500 mt-2 flex items-center justify-between">
        <span>{t.status.completed}/{t.status.total} steps</span>
        <span>Day {t.status.days_since_signup}</span>
      </div>
    </Link>
  );
}

function ProgressBar({ pct, stalled, compact }: { pct: number; stalled?: boolean; compact?: boolean }) {
  const color = pct === 100 ? "from-emerald-400 to-emerald-600" :
                stalled ? "from-amber-400 to-orange-500" :
                pct >= 50 ? "from-blue-400 to-indigo-600" :
                "from-slate-300 to-slate-400";
  return (
    <div className={`bg-slate-100 rounded-full overflow-hidden ${compact ? "h-1.5" : "h-2.5"}`}>
      <div
        className={`h-full bg-gradient-to-r ${color} transition-all duration-700`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
