import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, FileText, Download } from "lucide-react";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { compute1099Year } from "@/lib/reports-1099";
import { NinetyNineNECManager } from "./NinetyNineNECManager";
import { getTenantInfo } from "@/lib/tenant/business";

export const dynamic = "force-dynamic";

export default async function NinetyNineNECPage({
  searchParams,
}: {
  searchParams: { year?: string };
}) {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/dashboard");

  const currentYear = new Date().getFullYear();
  const year =
    searchParams.year && /^\d{4}$/.test(searchParams.year)
      ? parseInt(searchParams.year, 10)
      : currentYear;

  const summary = await compute1099Year(year);
  const tenant = await getTenantInfo();
  const tz = tenant.timezone;
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  return (
    <div className="max-w-6xl">
      <Link
        href="/admin/reports"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-navy mb-3"
      >
        <ChevronLeft className="h-4 w-4" /> Back to reports
      </Link>

      <h1 className="text-2xl font-bold text-brand-navy mb-1 flex items-center gap-2">
        <FileText className="h-6 w-6" /> 1099-NEC year-end report
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Compiles total labor payments per <code>driver_email</code> for the tax
        year. The IRS requires a 1099-NEC for every non-employee paid{" "}
        <strong>${(summary.threshold_cents / 100).toFixed(0)}+</strong> in the
        calendar year. Adjustable in site_settings
        (<code>1099_nec_threshold_cents</code>).
      </p>

      {/* Year selector */}
      <div className="card p-3 mb-4 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500 uppercase">Tax year:</span>
        {yearOptions.map((y) => (
          <Link
            key={y}
            href={`/admin/reports/1099-nec?year=${y}`}
            className={`px-3 py-1 text-sm rounded font-mono ${
              year === y
                ? "bg-brand-navy text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {y}
            {y === currentYear && (
              <span className="ml-1 text-[10px] opacity-70">(YTD)</span>
            )}
          </Link>
        ))}
        <div className="flex-1" />
        <a
          href={`/api/admin/accounting/export?type=1099-nec&year=${year}`}
          className="inline-flex items-center gap-1 bg-emerald-600 text-white text-xs px-3 py-1.5 rounded hover:bg-emerald-700 font-medium"
        >
          <Download className="h-3 w-3" /> Download CSV ({year})
        </a>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat label="Drivers w/ payments" value={String(summary.drivers.length)} />
        <Stat
          label="Qualifying (≥ threshold)"
          value={String(summary.qualifying_count)}
          color="emerald"
        />
        <Stat
          label="Total paid out"
          value={`$${(summary.total_paid_cents / 100).toFixed(2)}`}
        />
        <Stat
          label="Missing W9"
          value={String(summary.missing_w9_count)}
          color={summary.missing_w9_count > 0 ? "red" : "slate"}
        />
        <Stat
          label="Filed"
          value={`${summary.filed_count} / ${summary.qualifying_count}`}
          color={
            summary.filed_count === summary.qualifying_count &&
            summary.qualifying_count > 0
              ? "emerald"
              : "amber"
          }
        />
      </div>

      <NinetyNineNECManager summary={summary} tz={tz} />
    </div>
  );
}

function Stat({
  label,
  value,
  color = "slate",
}: {
  label: string;
  value: string;
  color?: "slate" | "emerald" | "red" | "amber";
}) {
  const cls = {
    slate: "bg-slate-50 border-slate-200 text-slate-800",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    red: "bg-red-50 border-red-200 text-red-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
  }[color];
  return (
    <div className={`rounded p-3 border ${cls}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-xl font-bold font-mono mt-1">{value}</div>
    </div>
  );
}
