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
      if (!r.ok) {
        toast.error(`Sync failed: ${r.error}`);
        return;
      }
      const summary = r.results?.results?.[0];
      if (summary?.error) {
        toast.error(`Sync error: ${summary.error}`);
      } else if (summary) {
        toast.success(
          `Synced: ${summary.foldersSynced ?? 0} folders, ${summary.messagesFetched ?? 0} new messages`,
        );
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
