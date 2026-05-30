"use client";

import { useState } from "react";
import { Sparkles, Loader2, RefreshCcw } from "lucide-react";
import { renderMarkdown } from "@/lib/markdown";

export function TenantBrief({ tenantId }: { tenantId: string }) {
  const [brief, setBrief] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenantId}/brief`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed");
        return;
      }
      setBrief(data.brief || "");
    } catch (e: any) {
      setError(e?.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-violet-50 via-fuchsia-50 to-rose-50 ring-1 ring-violet-200 p-5 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2 text-sm font-bold text-violet-700">
          <Sparkles className="h-4 w-4 text-violet-500" /> AI Brief
        </div>
        <button
          onClick={generate}
          disabled={busy}
          className="text-xs bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white font-semibold rounded-full px-3 py-1.5 inline-flex items-center gap-1 shadow-sm"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : brief ? <RefreshCcw className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
          {busy ? "Generating…" : brief ? "Regenerate" : "Generate brief"}
        </button>
      </div>
      {error && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
          {error}
        </div>
      )}
      {brief ? (
        <div
          className="prose prose-sm max-w-none text-slate-700"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(brief) }}
        />
      ) : (
        !error && !busy && (
          <p className="text-sm text-slate-500 italic">
            Click "Generate brief" for an AI-written 3-paragraph analysis: Snapshot, Trajectory, Recommended action.
          </p>
        )
      )}
    </div>
  );
}
