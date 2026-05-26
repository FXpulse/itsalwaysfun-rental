"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2, RefreshCcw, X } from "lucide-react";
import {
  previewCleanupCounts,
  runCleanupTestData,
  type CleanupResult,
} from "./cleanup-actions";

export function CleanupPanel() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<{
    per_table: Record<string, number | "missing">;
    auth_users_total: number;
    auth_users_to_delete: number;
    team_count: number;
  } | null>(null);
  const [confirmInput, setConfirmInput] = useState("");
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  function loadPreview() {
    startTransition(async () => {
      try {
        const p = await previewCleanupCounts();
        setPreview(p);
        setModalOpen(true);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load preview");
      }
    });
  }

  function runCleanup() {
    if (confirmInput !== "DELETE") {
      toast.error('Type "DELETE" exactly to confirm');
      return;
    }
    startTransition(async () => {
      const r = await runCleanupTestData(confirmInput);
      if (!r.ok) {
        toast.error(r.error || "Cleanup failed");
        return;
      }
      setResult(r);
      setConfirmInput("");
      toast.success("Test data wiped");
      router.refresh();
    });
  }

  // Total rows to delete (excluding missing tables)
  const totalRows = preview
    ? Object.values(preview.per_table).reduce(
        (s: number, v) => (typeof v === "number" ? s + v : s),
        0,
      )
    : 0;

  return (
    <div className="mt-8 border-l-4 border-red-500 bg-red-50 rounded p-4">
      <h2 className="text-sm font-bold uppercase tracking-wider text-red-800 mb-2 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" /> Danger zone
      </h2>
      <p className="text-xs text-red-800 mb-3">
        Pre-launch cleanup — wipes ALL test bookings, customers, quotes, gift
        cards, contact messages, etc. KEEPS: products, inventory, fleet, packages,
        settings, your team accounts (admin/staff/driver), coupons, overhead, and
        all configuration tables. Audit log preserved.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={loadPreview}
          disabled={pending}
          className="inline-flex items-center gap-1 bg-white border border-red-300 text-red-800 text-sm px-3 py-2 rounded hover:bg-red-100 font-medium"
        >
          <Trash2 className="h-3 w-3" /> Wipe all test data...
        </button>
        {result && (
          <button
            onClick={() => router.refresh()}
            className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-brand-navy"
          >
            <RefreshCcw className="h-3 w-3" /> Refresh page
          </button>
        )}
      </div>

      {result?.ok && (
        <div className="mt-4 bg-white border border-emerald-300 rounded p-3 text-xs">
          <p className="font-bold text-emerald-800 mb-2">✓ Cleanup complete</p>
          <p className="text-slate-700 mb-2">
            Deleted <strong>{result.deleted_users}</strong> auth users · kept{" "}
            <strong>{result.kept_users}</strong> team members
          </p>
          <details className="text-slate-600">
            <summary className="cursor-pointer">Per-table breakdown</summary>
            <ul className="mt-1 space-y-0.5 font-mono text-[10px]">
              {Object.entries(result.deleted_per_table).map(([t, v]) => (
                <li key={t}>
                  {t}: <span className="text-emerald-700">{String(v)}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

      {modalOpen && preview && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-xl w-full p-6 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-bold text-red-700 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> Confirm cleanup
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-slate-700 mb-3">
              About to wipe <strong>{totalRows}</strong> row(s) across these tables
              and <strong>{preview.auth_users_to_delete}</strong> customer auth
              account(s). Your <strong>{preview.team_count}</strong> team accounts
              are safe.
            </p>

            <div className="border border-slate-200 rounded p-2 max-h-48 overflow-y-auto mb-3 text-xs font-mono">
              {Object.entries(preview.per_table)
                .sort((a, b) => {
                  const av = typeof a[1] === "number" ? a[1] : -1;
                  const bv = typeof b[1] === "number" ? b[1] : -1;
                  return bv - av;
                })
                .map(([t, v]) => (
                  <div
                    key={t}
                    className="flex justify-between py-0.5 border-b border-slate-100 last:border-0"
                  >
                    <span className="text-slate-700">{t}</span>
                    <span
                      className={
                        v === "missing"
                          ? "text-slate-400"
                          : v === 0
                            ? "text-slate-400"
                            : "text-red-700 font-bold"
                      }
                    >
                      {v === "missing" ? "—" : v}
                    </span>
                  </div>
                ))}
              <div className="flex justify-between py-0.5 border-t-2 border-slate-300 mt-1 pt-1">
                <span className="font-bold text-slate-700">auth.users (non-team)</span>
                <span className="font-bold text-red-700">
                  {preview.auth_users_to_delete} / {preview.auth_users_total} total
                </span>
              </div>
            </div>

            <p className="text-xs text-red-700 mb-2 font-semibold">
              ⚠ This cannot be undone. Type <code className="bg-red-100 px-1 rounded">DELETE</code> to confirm:
            </p>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="Type DELETE"
              className="input mb-3 font-mono"
              autoFocus
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setModalOpen(false);
                  setConfirmInput("");
                }}
                className="text-sm text-slate-600 hover:text-slate-900 px-3 py-2"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  runCleanup();
                  setModalOpen(false);
                }}
                disabled={confirmInput !== "DELETE" || pending}
                className="inline-flex items-center gap-1 bg-red-600 text-white text-sm px-4 py-2 rounded hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              >
                <Trash2 className="h-3 w-3" />{" "}
                {pending ? "Wiping..." : `Wipe ${totalRows} rows + ${preview.auth_users_to_delete} users`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
