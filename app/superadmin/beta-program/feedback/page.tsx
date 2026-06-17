// Superadmin feedback inbox for the beta cohort.
// Lists every submission with full body, source tenant + user, category tag,
// page path context, and resolve / unresolve action.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Sparkles, Bug, Lightbulb, Palette, MessageSquarePlus, CheckCircle2 } from "lucide-react";
import { resolveBetaFeedback, unresolveBetaFeedback } from "./actions";

export const dynamic = "force-dynamic";

export default async function BetaFeedbackInboxPage({
  searchParams,
}: {
  searchParams: { show?: "open" | "all" };
}) {
  const userClient = createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) redirect("/superadmin/login");

  const admin = createAdminClient({ unscoped: true });

  // Superadmin guard
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .eq("is_superadmin", true)
    .maybeSingle();
  if (!roleRow) redirect("/admin/login?error=not_superadmin");

  const showAll = searchParams?.show === "all";

  let query = admin
    .from("beta_feedback")
    .select(
      "id, tenant_id, submitted_by_email, category, page_path, body, resolved, resolved_at, resolved_by_email, resolution_note, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (!showAll) query = query.eq("resolved", false);

  const { data: items } = await query;
  const rows = (items as any[]) || [];

  // Decorate with tenant names — single grouped query, not N+1.
  const tenantIds = Array.from(new Set(rows.map((r) => r.tenant_id))).filter(Boolean);
  const tenantsById = new Map<string, { business_name: string; slug: string }>();
  if (tenantIds.length > 0) {
    const { data: ts } = await admin
      .from("tenants")
      .select("id, business_name, slug")
      .in("id", tenantIds);
    for (const t of (ts as any[]) || []) {
      tenantsById.set(t.id, { business_name: t.business_name, slug: t.slug });
    }
  }

  // Counts for the header
  const [{ count: openCount }, { count: allCount }] = await Promise.all([
    admin
      .from("beta_feedback")
      .select("id", { count: "exact", head: true })
      .eq("resolved", false),
    admin.from("beta_feedback").select("id", { count: "exact", head: true }),
  ]);

  function categoryIcon(c: string) {
    const cls = "h-4 w-4";
    if (c === "bug") return <Bug className={`${cls} text-red-600`} />;
    if (c === "feature") return <Lightbulb className={`${cls} text-amber-500`} />;
    if (c === "ux") return <Palette className={`${cls} text-purple-600`} />;
    return <MessageSquarePlus className={`${cls} text-slate-500`} />;
  }

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/superadmin/beta-program" className="text-sm text-slate-500 hover:underline">
          ← Beta cohort
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <Sparkles className="h-7 w-7 text-brand-navy" />
        <h1 className="text-2xl font-bold text-slate-800">Beta feedback inbox</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        In-product submissions from the floating "Beta feedback" button in
        admin. Beta testers see the button on every admin page when their
        tenant has <code>beta_program = true</code>.
      </p>

      {/* Filter toggle */}
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/superadmin/beta-program/feedback"
          className={`px-3 py-1.5 rounded text-sm font-semibold ${
            !showAll
              ? "bg-brand-navy text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Open ({openCount || 0})
        </Link>
        <Link
          href="/superadmin/beta-program/feedback?show=all"
          className={`px-3 py-1.5 rounded text-sm font-semibold ${
            showAll
              ? "bg-brand-navy text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          All ({allCount || 0})
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-lg p-10 text-center text-slate-500">
          {showAll
            ? "No feedback submitted yet."
            : "No open feedback. 🎉 (Toggle 'All' to see closed items.)"}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const tenant = tenantsById.get(row.tenant_id);
            return (
              <div
                key={row.id}
                className={`bg-white border-2 rounded-lg p-4 ${
                  row.resolved
                    ? "border-emerald-200 bg-emerald-50/30"
                    : "border-slate-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">{categoryIcon(row.category)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="inline-block bg-slate-100 text-slate-700 text-[10px] font-bold tracking-widest px-2 py-0.5 rounded uppercase">
                        {row.category}
                      </span>
                      {tenant ? (
                        <Link
                          href={`/superadmin/tenants/${row.tenant_id}`}
                          className="text-sm font-bold text-brand-navy hover:underline"
                        >
                          {tenant.business_name}
                        </Link>
                      ) : (
                        <span className="text-sm text-slate-500">
                          (unknown tenant)
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        {row.submitted_by_email}
                      </span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-400">
                        {new Date(row.created_at).toLocaleString()}
                      </span>
                      {row.resolved && (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded">
                          <CheckCircle2 className="h-3 w-3" /> Resolved
                        </span>
                      )}
                    </div>
                    {row.page_path && (
                      <p className="text-xs text-slate-500 mb-2">
                        on{" "}
                        <code className="bg-slate-100 px-1 rounded">
                          {row.page_path}
                        </code>
                      </p>
                    )}
                    <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {row.body}
                    </p>

                    {row.resolved && row.resolution_note && (
                      <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs">
                        <p className="font-bold text-emerald-800 mb-1">
                          Resolution note:
                        </p>
                        <p className="text-emerald-900 whitespace-pre-wrap">
                          {row.resolution_note}
                        </p>
                        <p className="text-emerald-700 mt-2 text-[10px]">
                          By {row.resolved_by_email} at{" "}
                          {row.resolved_at ? new Date(row.resolved_at).toLocaleString() : ""}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-3">
                      {row.resolved ? (
                        <form action={unresolveBetaFeedback.bind(null, row.id)}>
                          <button
                            type="submit"
                            className="text-xs text-slate-500 hover:text-slate-700 underline"
                          >
                            Reopen
                          </button>
                        </form>
                      ) : (
                        <form
                          action={resolveBetaFeedback}
                          className="flex flex-col sm:flex-row gap-2"
                        >
                          <input type="hidden" name="id" value={row.id} />
                          <input
                            type="text"
                            name="note"
                            placeholder="What did you do? (optional)"
                            className="border border-slate-300 rounded px-2 py-1 text-xs flex-1"
                            maxLength={500}
                          />
                          <button
                            type="submit"
                            className="bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-emerald-700"
                          >
                            Mark resolved
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
