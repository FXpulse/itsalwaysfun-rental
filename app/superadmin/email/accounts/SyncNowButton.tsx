"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { manualSync } from "./sync-actions";

export function SyncNowButton() {
  const [pending, startTransition] = useTransition();

  function trigger() {
    startTransition(async () => {
      const r = await manualSync();
      // Log full payload so operator can inspect per-folder details in DevTools
      // console when diagnosing "Synced N folders, 0 messages".
      // eslint-disable-next-line no-console
      console.log("[Sync now] full result:", r);
      if (!r.ok) {
        toast.error(`Sync failed: ${r.error}`);
        return;
      }
      const summary = r.results?.results?.[0];
      if (summary?.error) {
        toast.error(`Sync error: ${summary.error}`);
      } else if (summary) {
        const details = summary.folderDetails as
          | Array<{ path: string; exists: number; sinceUid: number; fetched: number }>
          | undefined;
        const summaryText = `Synced: ${summary.foldersSynced ?? 0} folders, ${summary.messagesFetched ?? 0} new messages`;
        if (summary.messagesFetched === 0 && details && details.length > 0) {
          const richest = [...details].sort((a, b) => b.exists - a.exists)[0];
          toast.message(summaryText, {
            description: `Largest folder: ${richest.path} (${richest.exists} msgs, sinceUid=${richest.sinceUid}). Open DevTools console for full breakdown.`,
            duration: 12000,
          });
        } else {
          toast.success(summaryText);
        }
      } else {
        toast.success("Sync triggered");
      }
    });
  }

  return (
    <button
      onClick={trigger}
      disabled={pending}
      className="text-sm border border-slate-300 px-3 py-1.5 rounded hover:bg-slate-50 inline-flex items-center gap-1 disabled:opacity-50"
    >
      <RefreshCw className={`h-3 w-3 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Syncing…" : "Sync now"}
    </button>
  );
}
