import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { REPORT_TEMPLATES } from "@/lib/admin/report-templates";

export const dynamic = "force-dynamic";

export default async function QuickReportsPage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/login");

  // Default: last 30 days
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/admin/reports" className="text-sm text-slate-500 inline-flex items-center gap-1">
        <ChevronLeft className="h-4 w-4" /> Back to reports
      </Link>

      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white p-6 shadow-xl">
        <h1 className="text-2xl sm:text-3xl font-bold">What do you want to know?</h1>
        <p className="text-sm text-indigo-100 mt-2">
          Tap a question. We'll build the report instantly — with a chart and table.
        </p>
      </div>

      {/* Template cards */}
      <div className="grid sm:grid-cols-2 gap-3">
        {REPORT_TEMPLATES.map((t) => (
          <Link
            key={t.key}
            href={`/admin/reports/custom/${t.key}`}
            className="card p-5 hover:shadow-md hover:ring-2 hover:ring-violet-300 transition group"
          >
            <div className="flex items-start gap-3">
              <div className="text-3xl">{t.emoji}</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-brand-navy group-hover:text-violet-700">
                  {t.title}
                </h3>
                <p className="text-sm text-slate-600 mt-1">{t.question}</p>
                <p className="text-xs text-slate-400 mt-2">{t.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-violet-500 mt-1" />
            </div>
          </Link>
        ))}
      </div>

      <p className="text-xs text-slate-400 text-center">
        Default range is the last 30 days. You can change it after opening any report.
      </p>
    </div>
  );
}
