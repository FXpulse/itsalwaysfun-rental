// Superadmin view of the beta program cohort.
// Lists all tenants where beta_program = true with key signal columns:
// signup date, trial end, current activity, paid status.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isBetaProgramActive, betaProgramEndAt } from "@/lib/beta-program";
import { Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BetaProgramPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/superadmin/login");

  // Verify superadmin
  const admin = createAdminClient({ unscoped: true });
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .eq("is_superadmin", true)
    .maybeSingle();
  if (!roleRow) redirect("/admin/login?error=not_superadmin");

  // Beta cohort
  const { data: betas } = await admin
    .from("tenants")
    .select(
      "id, slug, business_name, owner_email, owner_phone, plan, subscription_status, suspended_at, trial_ends_at, beta_program_joined_at, custom_domain, created_at",
    )
    .eq("beta_program", true)
    .order("beta_program_joined_at", { ascending: false });

  const cohort = (betas || []) as any[];
  const now = Date.now();
  const programOpen = isBetaProgramActive();
  const programEnd = betaProgramEndAt();

  // Per-row enrichment — activity counts.
  // Run a single grouped query to avoid N+1.
  const tenantIds = cohort.map((t) => t.id);
  const activityByTenant = new Map<
    string,
    { booking_count: number; paid_booking_count: number; product_count: number }
  >();
  if (tenantIds.length > 0) {
    const [{ data: bk }, { data: pd }] = await Promise.all([
      admin
        .from("bookings")
        .select("tenant_id, stripe_payment_status")
        .in("tenant_id", tenantIds),
      admin.from("products").select("tenant_id").in("tenant_id", tenantIds),
    ]);
    for (const t of tenantIds) {
      activityByTenant.set(t, {
        booking_count: 0,
        paid_booking_count: 0,
        product_count: 0,
      });
    }
    for (const b of (bk as any[]) || []) {
      const row = activityByTenant.get(b.tenant_id);
      if (row) {
        row.booking_count++;
        if (b.stripe_payment_status === "paid") row.paid_booking_count++;
      }
    }
    for (const p of (pd as any[]) || []) {
      const row = activityByTenant.get(p.tenant_id);
      if (row) row.product_count++;
    }
  }

  function statusBadge(t: any) {
    const trialEnd = t.trial_ends_at ? new Date(t.trial_ends_at).getTime() : 0;
    const daysLeft = Math.ceil((trialEnd - now) / 86400000);
    if (t.suspended_at) {
      return (
        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs font-bold px-2 py-1 rounded">
          <AlertTriangle className="h-3 w-3" /> Suspended
        </span>
      );
    }
    if (t.subscription_status === "active") {
      return (
        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-bold px-2 py-1 rounded">
          <CheckCircle2 className="h-3 w-3" /> Converted (paying)
        </span>
      );
    }
    if (daysLeft < 0) {
      return (
        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded">
          Trial expired
        </span>
      );
    }
    if (daysLeft <= 14) {
      return (
        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-bold px-2 py-1 rounded">
          {daysLeft}d trial left
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded">
        {daysLeft}d trial left
      </span>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="mb-6">
        <Link href="/superadmin/tenants" className="text-sm text-slate-500 hover:underline">
          ← Tenants
        </Link>
      </div>
      <div className="flex items-center gap-3 mb-2">
        <Sparkles className="h-7 w-7 text-brand-navy" />
        <h1 className="text-2xl font-bold text-slate-800">Beta program cohort</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Tenants signed up while the beta program was open — they have a 90-day
        trial instead of 30. They flip to standard $99/mo at trial end (no
        special post-beta pricing).
      </p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">
            Cohort size
          </p>
          <p className="text-3xl font-bold text-brand-navy mt-1">
            {cohort.length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">
            Converted (paying)
          </p>
          <p className="text-3xl font-bold text-emerald-700 mt-1">
            {cohort.filter((t) => t.subscription_status === "active").length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">
            Program window
          </p>
          <p className="text-base font-bold text-slate-700 mt-1">
            {programOpen && programEnd
              ? `Open until ${programEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
              : "Closed"}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">
            Public landing
          </p>
          <a
            href="https://getrentalflow.com/beta"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-navy font-bold mt-1 inline-block underline text-sm"
          >
            getrentalflow.com/beta
          </a>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
            <tr>
              <th className="text-left py-3 px-4">Tenant</th>
              <th className="text-left py-3 px-4">Owner</th>
              <th className="text-left py-3 px-4">Joined</th>
              <th className="text-right py-3 px-4">Products</th>
              <th className="text-right py-3 px-4">Bookings (paid)</th>
              <th className="text-left py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {cohort.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-slate-500 py-10">
                  No beta signups yet.
                </td>
              </tr>
            )}
            {cohort.map((t) => {
              const act = activityByTenant.get(t.id) || {
                booking_count: 0,
                paid_booking_count: 0,
                product_count: 0,
              };
              return (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="py-3 px-4">
                    <Link
                      href={`/superadmin/tenants/${t.id}`}
                      className="font-semibold text-brand-navy hover:underline"
                    >
                      {t.business_name}
                    </Link>
                    <p className="text-xs text-slate-500 font-mono">
                      {t.custom_domain || `${t.slug}.getrentalflow.com`}
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-slate-700">{t.owner_email}</p>
                    {t.owner_phone && (
                      <p className="text-xs text-slate-500">{t.owner_phone}</p>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    {t.beta_program_joined_at
                      ? new Date(t.beta_program_joined_at).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" },
                        )
                      : "—"}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {act.product_count}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {act.booking_count}
                    {act.paid_booking_count > 0 && (
                      <span className="text-emerald-700 ml-1">
                        ({act.paid_booking_count} paid)
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">{statusBadge(t)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
