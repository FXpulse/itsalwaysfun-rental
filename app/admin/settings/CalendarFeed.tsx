"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, RefreshCcw, Calendar } from "lucide-react";
import { generateCalendarToken, regenerateCalendarToken } from "./calendar-actions";

export function CalendarFeed({ token }: { token: string | null }) {
  const [current, setCurrent] = useState(token);
  const [pending, startTransition] = useTransition();

  const url = current
    ? `${typeof window !== "undefined" ? window.location.origin : "https://getrentalflow.com"}/api/calendar/${current}.ics`
    : null;

  function handleGenerate() {
    startTransition(async () => {
      const r = await generateCalendarToken();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setCurrent(r.token);
      toast.success("Feed created — copy the URL");
    });
  }

  function handleRegenerate() {
    if (!confirm("Regenerate? Existing calendar subscriptions will stop syncing until you update them.")) return;
    startTransition(async () => {
      const r = await regenerateCalendarToken();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setCurrent(r.token);
      toast.success("New token issued");
    });
  }

  if (!current) {
    return (
      <button
        onClick={handleGenerate}
        disabled={pending}
        className="bg-brand-navy hover:bg-brand-navy-dark text-white font-semibold rounded-lg px-4 py-2 text-sm inline-flex items-center gap-2"
      >
        <Calendar className="h-4 w-4" />
        {pending ? "Generating…" : "Generate calendar feed URL"}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-3">
        <code className="text-emerald-300 text-xs font-mono flex-1 break-all">{url}</code>
        <button
          onClick={() => { navigator.clipboard.writeText(url!); toast.success("Copied"); }}
          className="bg-emerald-500 hover:bg-emerald-600 text-white rounded px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1"
        >
          <Copy className="h-3 w-3" /> Copy
        </button>
      </div>
      <button
        onClick={handleRegenerate}
        disabled={pending}
        className="text-xs text-slate-500 hover:text-rose-600 inline-flex items-center gap-1"
      >
        <RefreshCcw className="h-3 w-3" /> Regenerate token (revokes existing)
      </button>
    </div>
  );
}
