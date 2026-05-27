// Manual on-demand backup download — admin only.
// GET returns a JSON file with all tables + auth user metadata.

import { NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { exportFullBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // allow up to 60s — large dumps can be slow

export async function GET() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  const backup = await exportFullBackup();
  const body = JSON.stringify(backup, null, 2);
  const filename = `iaf-backup-${backup.exported_at.slice(0, 10)}.json`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
