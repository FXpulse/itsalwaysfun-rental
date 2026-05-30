import { CheckCircle2, AlertTriangle, XCircle, Activity, Clock } from "lucide-react";
import { fetchSystemHealth } from "@/lib/superadmin/system-health";

export const dynamic = "force-dynamic";
export const revalidate = 60; // refresh every minute

export default async function PublicStatusPage() {
  const health = await fetchSystemHealth();

  const overall = health.overall_status;
  const overallCfg = {
    healthy: {
      label: "All systems operational",
      cls: "from-emerald-500 to-emerald-700",
      icon: <CheckCircle2 className="h-8 w-8" />,
    },
    warning: {
      label: "Some degraded performance",
      cls: "from-amber-500 to-amber-700",
      icon: <AlertTriangle className="h-8 w-8" />,
    },
    critical: {
      label: "Major outage in progress",
      cls: "from-rose-500 to-rose-700",
      icon: <XCircle className="h-8 w-8" />,
    },
  }[overall];

  type ServiceStatus = "healthy" | "warning" | "critical";
  const services: Array<{ name: string; status: ServiceStatus }> = [
    { name: "Web app", status: health.db_response_ms < 500 ? "healthy" : "warning" },
    { name: "Database", status: health.db_response_ms < 300 ? "healthy" : health.db_response_ms < 1000 ? "warning" : "critical" },
    { name: "Email delivery", status: health.email_send_ok ? "healthy" : "critical" },
    { name: "Booking confirmations", status: health.crons.find((c) => c.name === "booking-emails")?.status === "stale" ? "warning" : "healthy" },
    { name: "Email inbox sync", status: health.crons.find((c) => c.name === "email-sync")?.status === "stale" ? "warning" : "healthy" },
    { name: "Payments (Stripe)", status: "healthy" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <img src="/01_rentalflow_lockup_light.svg" alt="RentalFlow" className="h-8" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        {/* Hero status banner */}
        <div className={`rounded-2xl bg-gradient-to-br ${overallCfg.cls} text-white p-8 shadow-xl flex items-center gap-5`}>
          {overallCfg.icon}
          <div>
            <h1 className="text-3xl font-bold">{overallCfg.label}</h1>
            <p className="text-sm opacity-90 mt-1">
              Last checked {new Date().toLocaleString()} · Refreshes every minute
            </p>
          </div>
        </div>

        {/* Services list */}
        <div className="card overflow-hidden">
          <div className="bg-slate-50 px-5 py-3 border-b">
            <h2 className="font-bold text-slate-700 flex items-center gap-2">
              <Activity className="h-4 w-4" /> Service Status
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {services.map((s) => (
              <div key={s.name} className="px-5 py-3 flex items-center justify-between">
                <span className="font-medium text-slate-700">{s.name}</span>
                <StatusPill status={s.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-3">
          <Metric label="DB latency" value={`${health.db_response_ms}ms`} ok={health.db_response_ms < 500} />
          <Metric label="Errors (24h)" value={String(health.recent_errors_24h)} ok={health.recent_errors_24h < 10} />
          <Metric label="Background jobs" value={`${health.crons.filter((c) => c.status === "healthy" || c.status === "unknown").length}/${health.crons.length}`} ok={true} />
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 pt-4">
          <p className="flex items-center justify-center gap-1">
            <Clock className="h-3 w-3" />
            Subscribe to incident updates at <a href="mailto:support@getrentalflow.com" className="underline ml-1">support@getrentalflow.com</a>
          </p>
        </div>
      </main>
    </div>
  );
}

function StatusPill({ status }: { status: "healthy" | "warning" | "critical" }) {
  const cfg = {
    healthy: { cls: "bg-emerald-100 text-emerald-800", icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: "Operational" },
    warning: { cls: "bg-amber-100 text-amber-800", icon: <AlertTriangle className="h-3.5 w-3.5" />, label: "Degraded" },
    critical: { cls: "bg-rose-100 text-rose-800", icon: <XCircle className="h-3.5 w-3.5" />, label: "Outage" },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.cls}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function Metric({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={`card p-4 text-center ${ok ? "" : "ring-2 ring-amber-300"}`}>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-2xl font-bold font-mono mt-1 ${ok ? "text-slate-900" : "text-amber-700"}`}>{value}</div>
    </div>
  );
}
