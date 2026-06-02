"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Clock, Check } from "lucide-react";
import { US_TIMEZONES, formatDateTimeInTz } from "@/lib/tenant/timezone";
import { updateTenantTimezone } from "./timezone-actions";

export function TimezoneSection({ current }: { current: string }) {
  const [selected, setSelected] = useState(current);
  const [isPending, startTransition] = useTransition();
  const [now, setNow] = useState(new Date());

  // Re-render the preview every second so the user sees the live time
  // in the selected zone as they pick.
  // Lightweight — no setInterval if effect is unmounted.
  useState(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  });

  function handleSave() {
    if (selected === current) return;
    startTransition(async () => {
      const r = await updateTenantTimezone(selected);
      if (!r.ok) {
        toast.error(r.error || "Failed to save");
        return;
      }
      toast.success(`Timezone updated to ${US_TIMEZONES.find((t) => t.id === selected)?.label}`);
    });
  }

  const dirty = selected !== current;
  const preview = formatDateTimeInTz(now, selected);

  return (
    <div className="card mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-5 w-5 text-brand-navy" />
        <h2 className="text-lg font-semibold">Timezone</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        All timestamps shown in your admin dashboard, customer emails, and
        booking displays will use this timezone. Stored data stays in UTC —
        only the display changes.
      </p>

      <label className="block text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">
        Your timezone
      </label>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={isPending}
        className="input w-full"
      >
        {US_TIMEZONES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>

      <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-3">
        <Clock className="h-4 w-4 text-slate-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            Current time in this zone
          </div>
          <div className="text-sm font-mono text-brand-navy mt-0.5">{preview}</div>
        </div>
      </div>

      {dirty && (
        <div className="mt-4 flex gap-2 items-center">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="btn-primary inline-flex items-center gap-1"
          >
            <Check className="h-4 w-4" />
            {isPending ? "Saving..." : "Save timezone"}
          </button>
          <button
            type="button"
            onClick={() => setSelected(current)}
            disabled={isPending}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
