// Single report page — runs a template (by key) with a date range the user
// can adjust. Intentionally minimal: NO definition editor, NO dimension
// pickers. Just a question + answer.

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Download } from "lucide-react";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { getCurrentTenantId } from "@/lib/tenant/server";
import { getTemplate } from "@/lib/admin/report-templates";
import { runReport } from "@/lib/admin/report-engine";
import { fetchReportRows } from "@/lib/admin/report-fetch";
import { ReportRenderer } from "../ReportRenderer";
import { DateRangePresets } from "../DateRangePresets";
import { InsightChip } from "../InsightChip";

export const dynamic = "force-dynamic";

export default async function TemplateReportPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { from?: string; to?: string };
}) {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/login");
  const tenantId = getCurrentTenantId();
  if (!tenantId) redirect("/admin/dashboard");

  const template = getTemplate(params.id);
  if (!template) notFound();

  const to = searchParams.to || new Date().toISOString().slice(0, 10);
  const from = searchParams.from || new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  const def = template.build(from, to);

  // Compute previous-period dates for delta comparison
  const fromD = new Date(from);
  const toD = new Date(to);
  const rangeMs = toD.getTime() - fromD.getTime();
  const prevTo = new Date(fromD.getTime() - 86_400_000).toISOString().slice(0, 10);
  const prevFrom = new Date(fromD.getTime() - 86_400_000 - rangeMs).toISOString().slice(0, 10);
  const prevDef = template.build(prevFrom, prevTo);

  const [rows, prevRows] = await Promise.all([
    fetchReportRows(tenantId, def),
    fetchReportRows(tenantId, prevDef),
  ]);
  const result = runReport(rows, def);
  const previousResult = runReport(prevRows, prevDef);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link href="/admin/reports/custom" className="text-sm text-slate-500 inline-flex items-center gap-1">
        <ChevronLeft className="h-4 w-4" /> Another question
      </Link>

      {/* Title + date picker */}
      <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 ring-1 ring-violet-200 p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-3xl mb-1">{template.emoji}</div>
            <h1 className="text-2xl font-bold text-brand-navy">{template.title}</h1>
            <p className="text-sm text-slate-600 mt-1">{template.question}</p>
          </div>
          <a
            href={`/api/admin/reports/custom/${params.id}/export?from=${from}&to=${to}`}
            className="bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg px-3 py-2 inline-flex items-center gap-1 ring-1 ring-slate-200 shadow-sm"
          >
            <Download className="h-4 w-4" /> Export CSV
          </a>
        </div>

        {/* Date presets — quick pick */}
        <div className="mt-4">
          <DateRangePresets activeFrom={from} activeTo={to} />
        </div>

        {/* Custom range form */}
        <form className="mt-3 flex items-center gap-3 flex-wrap" action={`/admin/reports/custom/${params.id}`}>
          <label className="text-sm">
            <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">From</span>
            <input type="date" name="from" defaultValue={from} className="input" />
          </label>
          <label className="text-sm">
            <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">To</span>
            <input type="date" name="to" defaultValue={to} className="input" />
          </label>
          <button
            type="submit"
            className="bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-lg px-3 py-1.5 text-xs self-end"
          >
            Apply custom
          </button>
        </form>
      </div>

      <InsightChip result={result} previousResult={previousResult} />

      <ReportRenderer def={def} result={result} />
    </div>
  );
}
