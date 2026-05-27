import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Crown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Pause,
  ExternalLink,
} from "lucide-react";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface Tenant {
  id: string;
  slug: string;
  business_name: string;
  owner_email: string;
  plan: string;
  subscription_status: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  custom_domain: string | null;
  suspended_at: string | null;
  created_at: string;
}

export default async function SuperadminTenantsPage() {
  const me = await getCurrentUserRole();
  if (!me) redirect("/admin/login");

  // Check superadmin flag explicitly (admin role alone is not enough)
  const supabase = createAdminClient({ unscoped: true });
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("is_superadmin")
    .eq("user_id", me.id)
    .single();
  if (!roleRow?.is_superadmin) {
    redirect("/admin/dashboard");
  }

  const { data: tenants } = await supabase
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false });

  const list: Tenant[] = (tenants as Tenant[]) || [];

  // Compute MRR (sum of plan prices for active subscriptions, excluding founder)
  const planPrices: Record<string, number> = {
    starter: 99,
    pro: 199,
    enterprise: 499,
    founder: 0,
  };
  const mrr = list
    .filter(
      (t) =>
        t.subscription_status === "active" || t.subscription_status === "trialing",
    )
    .filter((t) => t.plan !== "founder")
    .reduce((sum, t) => sum + (planPrices[t.plan] || 0), 0);

  const counts = {
    total: list.length,
    active: list.filter((t) => t.subscription_status === "active").length,
    trialing: list.filter((t) => t.subscription_status === "trialing").length,
    past_due: list.filter((t) => t.subscription_status === "past_due").length,
    canceled: list.filter((t) => t.subscription_status === "canceled").length,
    suspended: list.filter((t) => t.suspended_at).length,
    founder: list.filter((t) => t.plan === "founder").length,
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-600" /> RentalFlow Superadmin
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage all tenants across the platform. Superadmin only.
          </p>
        </div>
        <Link
          href="/admin/dashboard"
          className="text-sm text-slate-500 hover:text-brand-navy"
        >
          ← Back to my tenant
        </Link>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat label="MRR" value={`$${mrr.toLocaleString()}/mo`} color="emerald" />
        <Stat label="Total tenants" value={String(counts.total)} color="blue" />
        <Stat label="Active" value={String(counts.active)} color="emerald" />
        <Stat label="Trialing" value={String(counts.trialing)} color="amber" />
        <Stat
          label="Past due / canceled / suspended"
          value={`${counts.past_due + counts.canceled + counts.suspended}`}
          color={counts.past_due + counts.canceled + counts.suspended > 0 ? "red" : "slate"}
        />
      </div>

      {/* Tenants table */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Tenant</th>
              <th className="px-3 py-2 text-left">Plan</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Owner</th>
              <th className="px-3 py-2 text-left">Created</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((t) => {
              const url = t.custom_domain
                ? `https://${t.custom_domain}`
                : `https://${t.slug}.getrentalflow.com`;
              return (
                <tr key={t.id} className={t.suspended_at ? "bg-red-50" : ""}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{t.business_name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{t.slug}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {t.plan === "founder" ? (
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                        <Crown className="h-3 w-3" /> Founder
                      </span>
                    ) : (
                      <span className="capitalize bg-slate-100 px-2 py-0.5 rounded">
                        {t.plan}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge
                      status={t.subscription_status}
                      suspended={!!t.suspended_at}
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    <a
                      href={`mailto:${t.owner_email}`}
                      className="hover:text-brand-navy hover:underline"
                    >
                      {t.owner_email}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-navy hover:underline inline-flex items-center gap-1"
                      title="Open tenant site"
                    >
                      Visit <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                  No tenants yet. The first signup will appear here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 mt-4">
        💡 Tenants signup at <code>getrentalflow.com/signup</code>. Each gets
        a 14-day trial. Stripe webhook keeps subscription_status in sync.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "emerald" | "blue" | "amber" | "red" | "slate";
}) {
  const cls = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-900",
    blue: "bg-blue-50 border-blue-200 text-blue-900",
    amber: "bg-amber-50 border-amber-200 text-amber-900",
    red: "bg-red-50 border-red-200 text-red-900",
    slate: "bg-slate-50 border-slate-200 text-slate-900",
  }[color];
  return (
    <div className={`rounded p-3 border ${cls}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-xl font-bold font-mono mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({
  status,
  suspended,
}: {
  status: string | null;
  suspended: boolean;
}) {
  if (suspended) {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
        <Pause className="h-3 w-3" /> Suspended
      </span>
    );
  }
  if (!status) {
    return (
      <span className="text-xs text-slate-400">No sub</span>
    );
  }
  const map: Record<string, { cls: string; icon: any }> = {
    active: { cls: "bg-emerald-100 text-emerald-800", icon: <CheckCircle2 className="h-3 w-3" /> },
    trialing: { cls: "bg-blue-100 text-blue-800", icon: <CheckCircle2 className="h-3 w-3" /> },
    past_due: { cls: "bg-amber-100 text-amber-800", icon: <AlertTriangle className="h-3 w-3" /> },
    canceled: { cls: "bg-slate-200 text-slate-700", icon: <XCircle className="h-3 w-3" /> },
  };
  const v = map[status] || { cls: "bg-slate-100 text-slate-600", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${v.cls}`}>
      {v.icon} {status.replace(/_/g, " ")}
    </span>
  );
}
