import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateChecklist, CATEGORY_LABELS } from "@/lib/superadmin/tenant-checklist";
import { ChecklistByCategory } from "./ChecklistByCategory";
import { ClientProfile } from "./ClientProfile";
import { NotesTimeline } from "./NotesTimeline";

export const dynamic = "force-dynamic";

export default async function TenantChecklistPage({ params }: { params: { id: string } }) {
  // Auth gate
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/superadmin/login");

  const admin = createAdminClient({ unscoped: true });
  const { data: role } = await admin
    .from("user_roles")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .eq("is_superadmin", true)
    .maybeSingle();
  if (!role) redirect("/superadmin/login?error=not_superadmin");

  // Fetch tenant + profile + notes + checklist in parallel
  const [{ data: tenant }, { data: profileRow }, { data: notes }] = await Promise.all([
    admin.from("tenants").select("*").eq("id", params.id).maybeSingle(),
    admin.from("tenant_profile").select("*").eq("tenant_id", params.id).maybeSingle(),
    admin.from("tenant_operator_notes").select("*").eq("tenant_id", params.id).order("created_at", { ascending: false }).limit(50),
  ]);
  if (!tenant) notFound();

  const summary = await evaluateChecklist(params.id);
  const profile = (profileRow as any) || {};

  // Status banner color depending on pct
  const bannerCls =
    summary.pct >= 90 ? "from-emerald-600 via-teal-600 to-cyan-700" :
    summary.pct >= 60 ? "from-blue-600 via-indigo-600 to-violet-700" :
    summary.pct >= 30 ? "from-amber-500 via-orange-500 to-rose-500" :
    "from-rose-600 via-pink-600 to-fuchsia-700";

  const requiredPct = summary.required_total > 0
    ? Math.round((summary.required_completed / summary.required_total) * 100)
    : 100;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Link
        href={`/superadmin/tenants/${params.id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-navy"
      >
        <ChevronLeft className="h-4 w-4" /> Back to tenant detail
      </Link>

      {/* Header banner */}
      <div className={`rounded-2xl bg-gradient-to-br ${bannerCls} text-white p-6 shadow-xl`}>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/80 mb-2">
          <Sparkles className="h-3 w-3" />
          Onboarding Checklist
        </div>
        <h1 className="text-3xl font-bold mb-1">{(tenant as any).business_name}</h1>
        <p className="text-sm text-white/80">{(tenant as any).owner_email} · {(tenant as any).slug}</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <Stat label="Overall progress" value={`${summary.pct}%`} sub={`${summary.completed} / ${summary.total}`} />
          <Stat label="Required (critical)" value={`${requiredPct}%`} sub={`${summary.required_completed} / ${summary.required_total}`} />
          <Stat label="Account status" value={profile.account_status || "—"} />
          <Stat label="Industry" value={profile.industry?.replace(/_/g, " ") || "—"} />
        </div>

        {/* Progress bar */}
        <div className="mt-5 h-2 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white shadow"
            style={{ width: `${summary.pct}%` }}
          />
        </div>
      </div>

      {/* Banner when 100% */}
      {summary.pct === 100 && (
        <div className="card bg-emerald-50 border-2 border-emerald-300 p-5 flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
          <div>
            <h2 className="font-bold text-emerald-900 text-lg">100% Ready 🎉</h2>
            <p className="text-sm text-emerald-800 mt-1">
              This tenant has completed every checklist item. Their setup is production-grade.
            </p>
          </div>
        </div>
      )}

      {/* Banner when required gaps */}
      {summary.required_completed < summary.required_total && (
        <div className="card bg-amber-50 border-2 border-amber-300 p-5 flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
          <div>
            <h2 className="font-bold text-amber-900">
              {summary.required_total - summary.required_completed} required item{summary.required_total - summary.required_completed === 1 ? "" : "s"} pending
            </h2>
            <p className="text-sm text-amber-800 mt-1">
              These are critical for the tenant to operate at 100%. Scroll down for the breakdown.
            </p>
          </div>
        </div>
      )}

      {/* Client profile (ficha) */}
      <ClientProfile tenantId={params.id} initial={profile} />

      {/* Operator notes timeline */}
      <NotesTimeline tenantId={params.id} notes={(notes as any[]) || []} />

      {/* Checklist by category */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-brand-navy">📋 Checklist by category</h2>
        {Object.keys(CATEGORY_LABELS).map((cat) => {
          const items = summary.items.filter((i) => i.item.category === cat);
          if (items.length === 0) return null;
          return (
            <ChecklistByCategory
              key={cat}
              tenantId={params.id}
              category={cat as any}
              categoryLabel={CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
              items={items}
            />
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white/10 rounded-lg p-3 backdrop-blur">
      <div className="text-[10px] uppercase tracking-wider text-white/70">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-[10px] text-white/60 mt-0.5">{sub}</div>}
    </div>
  );
}
