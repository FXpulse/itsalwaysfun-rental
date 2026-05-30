// CSV export of the unified activity stream.
// Returns a CSV stream the browser auto-downloads.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchActivityStream } from "@/lib/superadmin/activity-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(v: string): string {
  if (/[,"\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export async function GET(_req: NextRequest) {
  const authClient = createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = createAdminClient({ unscoped: true });
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .eq("is_superadmin", true)
    .maybeSingle();
  if (!roleRow) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const events = await fetchActivityStream(500);

  const header = "timestamp,kind,title,subtitle,tenant_name,href\n";
  const rows = events.map((e) =>
    [
      e.ts,
      e.kind,
      csvEscape(e.title || ""),
      csvEscape(e.subtitle || ""),
      csvEscape(e.tenant_name || ""),
      e.href || "",
    ].join(","),
  ).join("\n");

  const csv = header + rows + "\n";
  const filename = `activity_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
