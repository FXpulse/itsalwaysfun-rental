// GET /api/cron/weekly-backup
// Runs every Sunday at 3 AM UTC. Generates a full DB JSON dump, uploads to
// the private `backups` storage bucket, prunes files older than ~84 days
// (~12 weeks), and emails the admin a 7-day signed download URL.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { exportFullBackup } from "@/lib/backup";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RETENTION_DAYS = 84;

export async function GET() {
  const auth = headers().get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient({ unscoped: true });
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const filename = `backup-${dateStr}.json`;

  // 1. Export
  const backup = await exportFullBackup();
  const body = JSON.stringify(backup);
  const sizeKb = Math.round(body.length / 1024);

  // 2. Upload to storage
  const { error: uploadErr } = await supabase.storage
    .from("backups")
    .upload(filename, body, {
      contentType: "application/json",
      upsert: true,
    });
  if (uploadErr) {
    return NextResponse.json(
      { ok: false, step: "upload", error: uploadErr.message },
      { status: 500 },
    );
  }

  // 3. Prune old files
  const { data: list } = await supabase.storage.from("backups").list();
  const cutoffMs = Date.now() - RETENTION_DAYS * 86400000;
  const toDelete: string[] = [];
  for (const f of list || []) {
    // file name is backup-YYYY-MM-DD.json
    const m = f.name.match(/^backup-(\d{4})-(\d{2})-(\d{2})\.json$/);
    if (!m) continue;
    const fileTime = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`).getTime();
    if (fileTime < cutoffMs) toDelete.push(f.name);
  }
  if (toDelete.length > 0) {
    await supabase.storage.from("backups").remove(toDelete);
  }

  // 4. Generate 7-day signed URL for the admin email
  const { data: signed } = await supabase.storage
    .from("backups")
    .createSignedUrl(filename, 60 * 60 * 24 * 7); // 7 days

  // 5. Email admin
  let emailSent = false;
  if (isEmailConfigured()) {
    const recipient =
      process.env.ADMIN_ALERT_EMAIL || "admin@itsalwaysfun.com";
    const tableCount = Object.keys(backup.tables).length;
    const errorList = Object.entries(backup.errors);

    try {
      const res = await sendEmail({
        to: recipient,
        subject: `📦 Weekly backup ready (${dateStr})`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#0f172a;">
<p>Your weekly DB backup is ready.</p>
<table style="border-collapse:collapse;width:100%;background:#f8fafc;border-radius:6px;padding:16px;margin:16px 0;font-size:13px;">
  <tr><td style="padding:6px 0;color:#64748b;width:160px;">Date</td><td style="padding:6px 0;"><strong>${dateStr}</strong></td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Tables exported</td><td style="padding:6px 0;">${tableCount}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Total rows</td><td style="padding:6px 0;font-family:monospace;">${backup.total_rows.toLocaleString()}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Size</td><td style="padding:6px 0;">${sizeKb.toLocaleString()} KB</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Skipped (table missing)</td><td style="padding:6px 0;">${backup.skipped.length}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Old backups pruned</td><td style="padding:6px 0;">${toDelete.length}</td></tr>
</table>
${
  signed?.signedUrl
    ? `<p style="text-align:center;">
        <a href="${signed.signedUrl}" style="background:#1a1a6e;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">Download backup (valid 7 days)</a>
      </p>`
    : `<p style="color:#dc2626;">Signed URL generation failed. File is in Supabase Storage → backups bucket → ${filename}</p>`
}
${
  errorList.length > 0
    ? `<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px;border-radius:4px;font-size:12px;">
        <strong>${errorList.length} table(s) had errors:</strong>
        <ul style="margin:6px 0 0;padding-left:18px;">
          ${errorList.map(([t, e]) => `<li>${t}: ${e}</li>`).join("")}
        </ul>
      </div>`
    : ""
}
<p style="color:#94a3b8;font-size:11px;margin-top:24px;">
  Backups older than ${RETENTION_DAYS} days are auto-pruned. To download anytime,
  go to /admin/diagnostics → Backups, or use the Supabase Dashboard →
  Storage → backups bucket.
</p>
</div>`,
        text: `Weekly backup ready (${dateStr}). ${tableCount} tables, ${backup.total_rows} rows, ${sizeKb} KB. Download: ${signed?.signedUrl || "(see Supabase Storage → backups)"}`,
        tags: [{ name: "type", value: "weekly_backup" }],
      });
      emailSent = !!res.ok;
    } catch (e) {
      // ignore — backup already uploaded
    }
  }

  return NextResponse.json({
    ok: true,
    ranAt: now.toISOString(),
    filename,
    size_kb: sizeKb,
    tables: Object.keys(backup.tables).length,
    rows: backup.total_rows,
    pruned: toDelete.length,
    email_sent: emailSent,
    errors: backup.errors,
  });
}
