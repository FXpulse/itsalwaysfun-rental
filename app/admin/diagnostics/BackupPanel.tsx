import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Database, Download, Clock } from "lucide-react";

export async function BackupPanel() {
  const supabase = createAdminClient();

  // Most recent backup in the bucket (if any)
  const { data: files } = await supabase.storage.from("backups").list("", {
    sortBy: { column: "created_at", order: "desc" },
    limit: 10,
  });
  const list = (files || []).filter((f) => f.name.endsWith(".json"));
  const latest = list[0];

  return (
    <div className="mt-8 card border-l-4 border-l-blue-500">
      <h2 className="text-sm font-bold uppercase tracking-wider text-blue-800 mb-2 flex items-center gap-2">
        <Database className="h-4 w-4" /> Backups
      </h2>
      <p className="text-xs text-slate-600 mb-3">
        On-demand JSON export of every critical table (bookings, expenses,
        customers, products, settings, etc.). Plus a weekly cron at 3am UTC
        Sundays that uploads to the private <code>backups</code> bucket and
        emails you a 7-day download link.
      </p>

      <div className="grid md:grid-cols-2 gap-3 mb-3">
        <a
          href="/api/admin/backup"
          className="inline-flex items-center justify-center gap-2 bg-brand-navy text-white text-sm px-4 py-2 rounded hover:bg-brand-navy/90 font-medium"
        >
          <Download className="h-4 w-4" /> Download backup now
        </a>
        <div className="text-xs text-slate-500 self-center">
          Click to generate + download a JSON of all tables. May take 10-30s.
        </div>
      </div>

      <div className="border-t border-slate-200 pt-3">
        <h3 className="text-xs font-bold uppercase text-slate-500 mb-2 flex items-center gap-1">
          <Clock className="h-3 w-3" /> Scheduled backups in storage
        </h3>
        {list.length === 0 ? (
          <p className="text-xs text-slate-400">
            No scheduled backups yet. First one will run next Sunday at 3am UTC.{" "}
            <br />
            <span className="text-amber-700">
              ⚠ If this is the first time, run <code>supabase/backups_bucket.sql</code>{" "}
              to create the bucket.
            </span>
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-2">
              Latest: <strong>{latest.name}</strong> ·{" "}
              {latest.created_at
                ? new Date(latest.created_at).toLocaleString()
                : "?"}
            </p>
            <ul className="text-[11px] space-y-0.5 font-mono">
              {list.map((f) => (
                <li
                  key={f.name}
                  className="flex justify-between border-b border-slate-100 py-0.5"
                >
                  <span>{f.name}</span>
                  <span className="text-slate-400">
                    {f.metadata?.size
                      ? `${Math.round((f.metadata.size as number) / 1024).toLocaleString()} KB`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-slate-400 mt-2">
              Files kept for ~12 weeks then auto-pruned. Download from Supabase
              Dashboard → Storage → backups, or wait for the weekly email link.
            </p>
          </>
        )}
      </div>

      <p className="text-[10px] text-slate-400 mt-3">
        ⚠ Backup does NOT include uploaded files (waivers PDFs, COI files, W9s,
        product photos). Those live in Supabase Storage and need separate
        backup (or rely on Supabase's own bucket replication on paid plans).
      </p>
    </div>
  );
}
