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
  Mail,
  LayoutDashboard,
  Ticket,
  Heart,
  Rocket,
  CreditCard,
  TrendingUp,
  Activity,
  Target,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TenantsTable } from "./TenantsTable";

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
  // Raw auth check — bypasses tenant scoping (which would fail at the
  // marketing host where there's no tenant_id matching her user_roles).
  const authClient = createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) redirect("/superadmin/login");

  // Superadmin flag check via unscoped client (cross-tenant lookup).
  // She just needs ANY active user_roles row with is_superadmin=true.
  const supabase = createAdminClient({ unscoped: true });
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .eq("is_superadmin", true)
    .maybeSingle();
  if (!roleRow) {
    redirect("/superadmin/login?error=not_superadmin");
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
          <div className="flex items-center gap-3 mb-1">
            <img
              src="/01_rentalflow_lockup_light.svg"
              alt="RentalFlow"
              className="h-8 w-auto"
            />
            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full">
              <Crown className="h-3 w-3" /> SUPERADMIN
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage all tenants across the platform.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/superadmin/dashboard"
            className="text-sm bg-brand-navy text-white px-3 py-1.5 rounded-md hover:bg-brand-navy-dark inline-flex items-center gap-1 shadow-sm"
          >
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </Link>
          <Link
            href="/superadmin/health"
            className="text-sm text-slate-600 hover:text-brand-navy inline-flex items-center gap-1"
          >
            <Heart className="h-4 w-4" /> Health
          </Link>
          <Link
            href="/superadmin/onboarding"
            className="text-sm text-slate-600 hover:text-brand-navy inline-flex items-center gap-1"
          >
            <Rocket className="h-4 w-4" /> Onboarding
          </Link>
          <Link
            href="/superadmin/billing"
            className="text-sm text-slate-600 hover:text-brand-navy inline-flex items-center gap-1"
          >
            <CreditCard className="h-4 w-4" /> Billing
          </Link>
          <Link
            href="/superadmin/revenue"
            className="text-sm text-slate-600 hover:text-brand-navy inline-flex items-center gap-1"
          >
            <TrendingUp className="h-4 w-4" /> Revenue
          </Link>
          <Link
            href="/superadmin/activity"
            className="text-sm text-slate-600 hover:text-brand-navy inline-flex items-center gap-1"
          >
            <Activity className="h-4 w-4" /> Activity
          </Link>
          <Link
            href="/superadmin/goals"
            className="text-sm text-slate-600 hover:text-brand-navy inline-flex items-center gap-1"
          >
            <Target className="h-4 w-4" /> Goals
          </Link>
          <Link
            href="/superadmin/support"
            className="text-sm text-slate-600 hover:text-brand-navy inline-flex items-center gap-1"
          >
            <Ticket className="h-4 w-4" /> Support
          </Link>
          <Link
            href="/superadmin/email"
            className="text-sm text-slate-600 hover:text-brand-navy inline-flex items-center gap-1"
          >
            <Mail className="h-4 w-4" /> Email
          </Link>
          <Link
            href="/superadmin/setup"
            className="text-sm text-slate-600 hover:text-brand-navy inline-flex items-center gap-1"
          >
            ⚙ Platform setup
          </Link>
          <Link
            href="/superadmin/team"
            className="text-sm text-slate-600 hover:text-brand-navy inline-flex items-center gap-1"
          >
            <Users className="h-4 w-4" /> Team
          </Link>
          <Link
            href="/admin/dashboard"
            className="text-sm text-slate-500 hover:text-brand-navy"
          >
            ← Back to my tenant
          </Link>
        </div>
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

      {/* Tenants table — interactive client component with bulk actions */}
      <TenantsTable tenants={list} />

      <p className="text-xs text-slate-400 mt-4">
        💡 Tenants signup at <code>getrentalflow.com/signup</code>. Each gets
        a 14-day trial. Stripe webhook keeps subscription_status in sync.
        Select multiple rows above to bulk email / pause / export.
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
