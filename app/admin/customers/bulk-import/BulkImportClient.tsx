"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, FileText, X, AlertTriangle, CheckCircle2, Send, Save, Loader2 } from "lucide-react";
import { bulkImportCustomers, type BulkRow, type BulkResult } from "./actions";

interface ParsedRow extends BulkRow {
  _row: number;
  _ok: boolean;
  _reason?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Tolerant alias map for headers — normalizes case + spaces + underscores
const ALIASES: Record<string, string> = {
  email: "email", "e-mail": "email", "mail": "email",
  first_name: "first_name", firstname: "first_name", first: "first_name", fname: "first_name",
  last_name: "last_name", lastname: "last_name", last: "last_name", lname: "last_name", surname: "last_name",
  phone: "phone", mobile: "phone", "phone_number": "phone", cell: "phone", tel: "phone",
};

function normalizeHeader(h: string): string | null {
  const k = h.toLowerCase().trim().replace(/\s+/g, "_");
  return ALIASES[k] || (k === "email" ? "email" : null);
}

/**
 * Minimal CSV parser — handles quoted fields (with embedded commas + escaped
 * "" quotes) and trims surrounding whitespace. Sufficient for export files
 * from Excel/Google Sheets. Doesn't try to handle escape edge cases beyond
 * those two — for that we'd ship Papa Parse.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ",") { cur.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") {
      cur.push(field);
      if (cur.some((v) => v.trim().length > 0)) rows.push(cur);
      cur = []; field = ""; i++; continue;
    }
    field += c; i++;
  }
  // Final field/row
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    if (cur.some((v) => v.trim().length > 0)) rows.push(cur);
  }
  return rows;
}

export function BulkImportClient() {
  const router = useRouter();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [filename, setFilename] = useState<string>("");
  const [sendInvites, setSendInvites] = useState(true);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BulkResult | null>(null);

  function handleFile(file: File) {
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const matrix = parseCsv(text);
      if (matrix.length < 2) {
        toast.error("CSV needs a header row + at least 1 data row");
        return;
      }
      const headers = matrix[0].map((h) => normalizeHeader(h));
      const emailCol = headers.indexOf("email");
      if (emailCol === -1) {
        toast.error("Couldn't find an 'email' column in the header row");
        return;
      }
      const firstCol = headers.indexOf("first_name");
      const lastCol = headers.indexOf("last_name");
      const phoneCol = headers.indexOf("phone");

      const parsed: ParsedRow[] = matrix.slice(1).map((cells, idx) => {
        const email = (cells[emailCol] || "").trim();
        const valid = EMAIL_RE.test(email);
        return {
          _row: idx + 2,                                          // +2 because header is row 1, data starts at 2
          _ok: valid,
          _reason: valid ? undefined : email ? "invalid format" : "empty",
          email,
          first_name: firstCol >= 0 ? cells[firstCol]?.trim() : undefined,
          last_name: lastCol >= 0 ? cells[lastCol]?.trim() : undefined,
          phone: phoneCol >= 0 ? cells[phoneCol]?.trim() : undefined,
        };
      });

      setRows(parsed);
      setFilename(file.name);
      const okCount = parsed.filter((r) => r._ok).length;
      toast.success(`Parsed ${parsed.length} rows · ${okCount} valid`);
    };
    reader.readAsText(file);
  }

  function reset() {
    setRows([]);
    setFilename("");
    setResult(null);
  }

  function submit() {
    const valid = rows.filter((r) => r._ok);
    if (valid.length === 0) {
      toast.error("No valid rows to import");
      return;
    }
    if (!confirm(`Import ${valid.length} customer${valid.length === 1 ? "" : "s"}${sendInvites ? " + email each one" : ""}?`)) return;
    startTransition(async () => {
      const r = await bulkImportCustomers(
        valid.map(({ _row, _ok, _reason, ...row }) => row),
        sendInvites,
      );
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setResult(r.result);
      toast.success(
        `Created ${r.result.created} · existed ${r.result.existed} · failed ${r.result.failed} · invited ${r.result.invited}`,
      );
    });
  }

  // No file uploaded yet → show drag-drop / file picker
  if (rows.length === 0) {
    return (
      <label className="block">
        <input
          type="file"
          accept=".csv,.txt,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <div className="card border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/40 p-10 text-center cursor-pointer transition">
          <Upload className="h-10 w-10 text-indigo-400 mx-auto mb-3" />
          <p className="font-semibold text-slate-700">Click to upload CSV</p>
          <p className="text-xs text-slate-500 mt-1">or drag a file here</p>
          <p className="text-[10px] text-slate-400 mt-3">Max 500 rows · email required · max 5 MB</p>
        </div>
      </label>
    );
  }

  const okCount = rows.filter((r) => r._ok).length;
  const badCount = rows.length - okCount;

  // Preview + submit
  return (
    <>
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-600" />
            <span className="font-semibold text-slate-800 text-sm">{filename}</span>
            <span className="text-xs text-slate-500">— {rows.length} rows</span>
          </div>
          <button
            onClick={reset}
            disabled={pending}
            className="text-xs text-slate-500 hover:text-rose-600 inline-flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Use a different file
          </button>
        </div>

        <div className="flex gap-2 mb-3 text-xs">
          <span className="bg-emerald-100 text-emerald-800 rounded-full px-2 py-0.5 font-semibold">
            ✓ {okCount} valid
          </span>
          {badCount > 0 && (
            <span className="bg-rose-100 text-rose-800 rounded-full px-2 py-0.5 font-semibold">
              ⚠ {badCount} skipped (invalid)
            </span>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto border border-slate-200 rounded">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wide sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">Email</th>
                <th className="px-2 py-2 text-left">First</th>
                <th className="px-2 py-2 text-left">Last</th>
                <th className="px-2 py-2 text-left">Phone</th>
                <th className="px-2 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.slice(0, 100).map((r, i) => (
                <tr key={i} className={r._ok ? "" : "bg-rose-50"}>
                  <td className="px-2 py-1 text-slate-400">{r._row}</td>
                  <td className="px-2 py-1 font-mono truncate max-w-xs">{r.email || "—"}</td>
                  <td className="px-2 py-1 truncate max-w-[120px]">{r.first_name || "—"}</td>
                  <td className="px-2 py-1 truncate max-w-[120px]">{r.last_name || "—"}</td>
                  <td className="px-2 py-1 truncate max-w-[100px]">{r.phone || "—"}</td>
                  <td className="px-2 py-1">
                    {r._ok ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-700" title={r._reason}>
                        <AlertTriangle className="h-3 w-3" /> {r._reason}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length > 100 && (
                <tr><td colSpan={6} className="px-2 py-2 text-center text-slate-400">
                  …{rows.length - 100} more rows (will all be processed)
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite toggle */}
      <label className="card flex items-start gap-2 bg-indigo-50 border-indigo-200 p-3 cursor-pointer">
        <input
          type="checkbox"
          checked={sendInvites}
          onChange={(e) => setSendInvites(e.target.checked)}
          className="mt-1"
          disabled={pending}
        />
        <div>
          <div className="text-sm font-semibold text-indigo-900">Send a magic link invite to each NEW customer</div>
          <div className="text-xs text-indigo-700 mt-0.5">
            Existing customers won't be re-emailed. Only newly created accounts get the invite.
          </div>
        </div>
      </label>

      {/* Submit */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-slate-700">
          <strong>Ready:</strong> import {okCount} customer{okCount === 1 ? "" : "s"}.
        </div>
        <button
          onClick={submit}
          disabled={pending || okCount === 0}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold rounded-lg px-5 py-2 inline-flex items-center gap-1 shadow-sm"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : sendInvites ? <Send className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {pending ? "Importing…" : sendInvites ? `Import + email ${okCount}` : `Import ${okCount}`}
        </button>
      </div>

      {/* Result panel */}
      {result && (
        <div className="card bg-gradient-to-br from-emerald-50 to-teal-50 ring-2 ring-emerald-300 p-5">
          <h3 className="font-bold text-emerald-900 flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-5 w-5" /> Import complete
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <Stat label="Created" value={result.created} color="emerald" />
            <Stat label="Already existed" value={result.existed} color="slate" />
            <Stat label="Invited" value={result.invited} color="indigo" />
            <Stat label="Failed" value={result.failed} color={result.failed > 0 ? "rose" : "slate"} />
          </div>

          {result.errors.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold text-rose-700">
                {result.errors.length} error{result.errors.length === 1 ? "" : "s"} — click to view
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-slate-600 max-h-40 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    Row {e.row} ({e.email}): {e.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <button
            onClick={() => router.push("/admin/customers")}
            className="mt-3 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg px-3 py-1.5"
          >
            Back to customers →
          </button>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: "emerald" | "slate" | "indigo" | "rose" }) {
  const cls = {
    emerald: "text-emerald-700",
    slate: "text-slate-700",
    indigo: "text-indigo-700",
    rose: "text-rose-700",
  }[color];
  return (
    <div className="bg-white rounded-lg p-3 ring-1 ring-slate-100">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${cls}`}>{value}</div>
    </div>
  );
}
