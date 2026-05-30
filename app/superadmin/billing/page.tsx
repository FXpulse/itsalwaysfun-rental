// /superadmin/billing — cross-tenant Stripe billing overview.

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  DollarSign, TrendingUp, AlertCircle, FileText, ExternalLink,
  CheckCircle2, RefreshCw, CreditCard, Crown,
} from "lucide-react";
import { getSuperadminUser } from "@/lib/auth/superadmin";
import { fetchOperatorBilling } from "@/lib/stripe/operator-billing-data";
import { Crumbs } from "../Crumbs";

export const dynamic = "force-dynamic";
export const revalidate = 120;

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default async function BillingOverviewPage() {
  const me = await getSuperadminUser();
  if (!me) redirect("/superadmin/login?error=not_superadmin");

  const data = await fetchOperatorBilling();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <Crumbs trail={[{ label: "Billing" }]} />

      {/* Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 text-white p-6 shadow-xl relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-44 h-44 bg-yellow-300/20 rounded-full blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-teal-100 text-xs uppercase tracking-wider mb-2">
              <DollarSign className="h-3.5 w-3.5" /> Stripe live data
            </div>
            <div className="text-6xl font-bold">{fmt(data.mrr_total_cents)}<span className="text-xl font-normal text-teal-200 ml-2">/mo</span></div>
            <div className="text-sm text-teal-100 mt-3">
              Active recurring revenue across all paying tenants.
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-teal-200 text-xs uppercase">Paid this month</div>
                <div className="font-bold mt-0.5">{fmt(data.totals.paid_this_month_cents)}</div>
              </div>
              <div>
                <div className="text-teal-200 text-xs uppercase">Paid YTD</div>
                <div className="font-bold mt-0.5">{fmt(data.totals.paid_ytd_cents)}</div>
              </div>
              <div>
                <div className="text-teal-200 text-xs uppercase">Failed this month</div>
                <div className={`font-bold mt-0.5 ${data.totals.failed_this_month > 0 ? "text-rose-200" : ""}`}>
                  {data.totals.failed_this_month}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white p-6 shadow-xl">
          <div className="text-xs uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" /> MRR by plan
          </div>
          <div className="space-y-3 text-sm">
            {Object.entries(data.mrr_by_plan).map(([plan, info]) => (
              <div key={plan}>
                <div className="flex items-center justify-between mb-0.5 text-xs">
                  <span className="capitalize inline-flex items-center gap-1">
                    {plan === "founder" && <Crown className="h-3 w-3 text-amber-400" />}
                    {plan}
                  </span>
                  <span className="font-bold">{fmt(info.revenue_cents)}/mo · {info.count}</span>
                </div>
                <div className="h-1.5 bg-slate-600 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400"
                    style={{ width: `${data.mrr_total_cents > 0 ? (info.revenue_cents / data.mrr_total_cents) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
            {Object.keys(data.mrr_by_plan).length === 0 && (
              <p className="text-slate-400 text-xs">No active subs yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Failed payments */}
      {data.failed_payments.length > 0 && (
        <section>
          <h2 className="font-bold text-brand-navy mb-3 flex items-center gap-2 text-lg">
            <AlertCircle className="h-5 w-5 text-rose-500" /> Failed payments ({data.failed_payments.length})
          </h2>
          <div className="space-y-2">
            {data.failed_payments.map((p) => (
              <div key={p.invoice_id} className="bg-white rounded-xl shadow-sm border-l-4 border-rose-500 border-y border-r border-slate-200 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/superadmin/tenants/${p.tenant_id}`} className="font-bold text-brand-navy hover:underline">
                    {p.tenant_business_name}
                  </Link>
                  <div className="text-xs text-slate-500">{p.customer_email} · {timeAgo(p.attempted_at)}</div>
                  {p.failure_message && <div className="text-xs text-rose-700 mt-1">{p.failure_message}</div>}
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-rose-700">{fmt(p.amount_cents)}</div>
                  {p.invoice_id && (
                    <a
                      href={`https://dashboard.stripe.com/invoices/${p.invoice_id}`}
                      target="_blank"
                      rel="noopener"
                      className="text-xs text-violet-700 hover:underline inline-flex items-center gap-0.5 mt-0.5"
                    >
                      <RefreshCw className="h-3 w-3" /> Retry in Stripe
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            💡 Auto-dunning is already chasing these — Day 1 / 3 / 7 emails will fire automatically + auto-cancel day 8.
          </p>
        </section>
      )}

      {/* Recent invoices */}
      <section>
        <h2 className="font-bold text-brand-navy mb-3 flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-emerald-600" /> Recent invoices ({data.recent_invoices.length})
        </h2>
        {data.recent_invoices.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-500">
            No invoices yet.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-slate-50 to-emerald-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2">Tenant</th>
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-right px-4 py-2">Amount</th>
                  <th className="text-center px-4 py-2">Status</th>
                  <th className="text-right px-4 py-2">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recent_invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/superadmin/tenants/${inv.tenant_id}`} className="font-semibold text-brand-navy hover:underline">
                        {inv.tenant_business_name}
                      </Link>
                      <div className="text-xs text-slate-500">{inv.customer_email}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 font-mono">
                      {new Date(inv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-brand-navy">
                      {fmt(inv.amount_paid_cents || inv.amount_due_cents)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <StatusPill status={inv.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {inv.pdf_url ? (
                        <a href={inv.pdf_url} target="_blank" rel="noopener" className="text-xs text-violet-700 hover:underline inline-flex items-center gap-0.5">
                          PDF <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : inv.hosted_url ? (
                        <a href={inv.hosted_url} target="_blank" rel="noopener" className="text-xs text-violet-700 hover:underline">
                          View
                        </a>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    paid: { label: "Paid", cls: "bg-emerald-100 text-emerald-800" },
    open: { label: "Open", cls: "bg-blue-100 text-blue-800" },
    void: { label: "Void", cls: "bg-slate-200 text-slate-600" },
    uncollectible: { label: "Failed", cls: "bg-rose-100 text-rose-900" },
    draft: { label: "Draft", cls: "bg-slate-100 text-slate-600" },
  };
  const v = map[status] || { label: status, cls: "bg-slate-100 text-slate-600" };
  return (
    <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${v.cls}`}>
      {v.label}
    </span>
  );
}
