"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, RotateCw } from "lucide-react";

export default function ChecklistError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Checklist page error:", error);
  }, [error]);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <Link
        href="/superadmin/tenants"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-navy"
      >
        <ChevronLeft className="h-4 w-4" /> Back to tenants
      </Link>

      <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-6 shadow">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-rose-600 shrink-0 mt-1" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-rose-900">Checklist page crashed</h1>
            <p className="text-sm text-rose-800 mt-1">
              The page threw an unhandled error. Details below — share this with Claude or check Vercel function logs.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Field label="Message" value={error.message || "(no message)"} />
          {error.digest && <Field label="Digest" value={error.digest} />}
          {error.name && <Field label="Name" value={error.name} />}
          {error.stack && (
            <details className="bg-white border border-rose-200 rounded p-2">
              <summary className="text-xs font-bold text-rose-800 cursor-pointer">Stack trace</summary>
              <pre className="text-[10px] whitespace-pre-wrap break-all mt-2 text-slate-700 max-h-96 overflow-auto">
                {error.stack}
              </pre>
            </details>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={reset}
            className="bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded px-4 py-2 inline-flex items-center gap-1"
          >
            <RotateCw className="h-4 w-4" /> Retry
          </button>
          <Link
            href="/superadmin/tenants"
            className="text-sm text-rose-700 hover:text-rose-900 font-semibold px-3 py-2"
          >
            Back to tenants
          </Link>
        </div>
      </div>

      <div className="card p-4 text-xs text-slate-600 space-y-1">
        <p><strong>Common causes:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>Migration <code className="bg-slate-100 px-1 rounded">tenant_onboarding_checklist.sql</code> not run yet</li>
          <li>Build cache from older deploy — try a hard refresh (Ctrl+Shift+R)</li>
          <li>Specific tenant has malformed data in one of the autoDetect queries</li>
        </ul>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-rose-200 rounded p-2">
      <div className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">{label}</div>
      <div className="text-xs font-mono text-slate-800 break-all mt-0.5">{value}</div>
    </div>
  );
}
