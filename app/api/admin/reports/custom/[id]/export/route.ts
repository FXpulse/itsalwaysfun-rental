// CSV export for a quick report. Same params as the page (from + to).
// Server-side fetch + run, returns text/csv.

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { getCurrentTenantId } from "@/lib/tenant/server";
import { getTemplate } from "@/lib/admin/report-templates";
import { runReport } from "@/lib/admin/report-engine";
import { fetchReportRows } from "@/lib/admin/report-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(v: string): string {
  if (/[,"\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUserRole();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const tenantId = getCurrentTenantId();
  if (!tenantId) return NextResponse.json({ error: "no_tenant" }, { status: 400 });

  const template = getTemplate(params.id);
  if (!template) return NextResponse.json({ error: "template_not_found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const to = searchParams.get("to") || new Date().toISOString().slice(0, 10);
  const from = searchParams.get("from") || new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  const def = template.build(from, to);
  const rows = await fetchReportRows(tenantId, def);
  const result = runReport(rows, def);

  if (result.rows.length === 0) {
    return new NextResponse("No data for this period\n", {
      status: 200,
      headers: { "Content-Type": "text/csv" },
    });
  }

  const dimensionKeys = Object.keys(result.rows[0].dimensions);
  const metricKeys = Object.keys(result.rows[0].metrics);
  const header = [...dimensionKeys, ...metricKeys].map(csvEscape).join(",") + "\n";
  const lines = result.rows.map((r) =>
    [...dimensionKeys.map((k) => csvEscape(r.dimensions[k] || "")),
     ...metricKeys.map((k) => String(r.metrics[k] || 0))].join(","),
  ).join("\n");

  const csv = header + lines + "\n";
  const filename = `${template.key}_${from}_to_${to}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
