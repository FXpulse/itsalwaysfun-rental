"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { runPendingMigrations } from "./actions";

const TOKEN = "iaf-migrate-2026-x7Mp9qR3kT8vN5wY";

export default function MigratePage() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    ok: boolean;
    error?: string;
    applied?: string[];
    refreshed?: boolean;
  } | null>(null);

  function run() {
    startTransition(async () => {
      const r = await runPendingMigrations(TOKEN);
      setResult(r);
      if (!r.ok) {
        toast.error(r.error || "Migration failed");
      } else {
        toast.success("Migrations applied");
      }
    });
  }

  return (
    <div className="min-h-screen flex items-start justify-center bg-slate-50 p-4">
      <div className="w-full max-w-2xl card mt-12">
        <div className="text-center mb-6">
          <div className="inline-block bg-amber-100 text-amber-800 text-xs font-bold tracking-widest px-3 py-1 rounded-full mb-3">
            TEMPORARY — DB MIGRATIONS
          </div>
          <h1 className="text-2xl font-bold text-brand-navy">
            Run pending migrations
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            One-click — adds all missing columns to <code>bookings</code> +{" "}
            <code>products</code> tables and reloads Supabase's API schema cache.
            Idempotent (won't break anything if columns already exist).
          </p>
        </div>

        {!result && (
          <button
            onClick={run}
            disabled={pending}
            className="btn-primary w-full text-lg py-3"
          >
            {pending ? "Running migrations..." : "Run pending migrations"}
          </button>
        )}

        {result?.ok && (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-emerald-900">
              <div className="font-bold mb-1">✓ Migrations applied</div>
              <div className="text-xs">
                Schema cache reloaded:{" "}
                {result.refreshed ? "✓ yes" : "⚠ no (PostgREST may take 60s to refresh)"}
              </div>
            </div>
            {result.applied && result.applied.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-slate-600">
                  Details ({result.applied.length} statements)
                </summary>
                <ul className="mt-2 space-y-0.5 font-mono text-[10px] bg-slate-50 border border-slate-200 rounded p-2 max-h-64 overflow-y-auto">
                  {result.applied.map((s, i) => (
                    <li
                      key={i}
                      className={s.startsWith("❌") ? "text-red-700" : "text-slate-700"}
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <a
              href="/admin/dashboard"
              className="inline-block text-sm text-brand-navy hover:underline"
            >
              ← Back to admin
            </a>
          </div>
        )}

        {result && !result.ok && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-red-900 text-sm">
            <div className="font-bold mb-1">Failed</div>
            <p className="text-xs">{result.error}</p>
            {result.error?.includes("DATABASE_URL") && (
              <div className="mt-3 text-xs space-y-1">
                <p className="font-semibold">To fix:</p>
                <ol className="list-decimal pl-5">
                  <li>Open Supabase Dashboard → your project → Project Settings → Database</li>
                  <li>Find "Connection string" section</li>
                  <li>Click "Transaction" pooler tab → Copy the URI</li>
                  <li>Replace <code>[YOUR-PASSWORD]</code> with your DB password</li>
                  <li>Vercel → Settings → Env Vars → Add <code>DATABASE_URL</code> = (the URI)</li>
                  <li>Redeploy → come back here and try again</li>
                </ol>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-[10px] text-slate-400 mt-6">
          This page will be removed once migrations are confirmed working.
        </p>
      </div>
    </div>
  );
}
