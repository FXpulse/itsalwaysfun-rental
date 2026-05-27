"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveDamageProtection } from "./actions";

interface Props {
  initialEnabled: boolean;
  initialPriceDollars: number;
  initialCoverageDollars: number;
}

export function DamageProtectionForm({
  initialEnabled,
  initialPriceDollars,
  initialCoverageDollars,
}: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [price, setPrice] = useState(String(initialPriceDollars));
  const [coverage, setCoverage] = useState(String(initialCoverageDollars));
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("enabled", enabled ? "true" : "false");
    fd.set("price_dollars", price);
    fd.set("coverage_dollars", coverage);

    startTransition(async () => {
      const res = await saveDamageProtection(fd);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("Damage protection settings saved");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5">
      <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <div>
          <div className="font-semibold text-brand-navy text-base">
            Damage protection at checkout
          </div>
          <div className="text-sm text-slate-500 mt-0.5">
            {enabled
              ? "ON — customers see the option to add it for an extra fee."
              : "OFF — customers don't see the option and no fee is added."}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          disabled={pending}
          className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:ring-offset-2 disabled:opacity-50 ${
            enabled ? "bg-emerald-500" : "bg-slate-300"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
              enabled ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setEnabled(true)}
          disabled={pending || enabled}
          className={`px-4 py-2 rounded text-sm font-semibold border transition ${
            enabled
              ? "bg-emerald-600 text-white border-emerald-600 cursor-default"
              : "bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50"
          }`}
        >
          ✓ Enable
        </button>
        <button
          type="button"
          onClick={() => setEnabled(false)}
          disabled={pending || !enabled}
          className={`px-4 py-2 rounded text-sm font-semibold border transition ${
            !enabled
              ? "bg-slate-600 text-white border-slate-600 cursor-default"
              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
          }`}
        >
          ✕ Disable
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Price the customer pays
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input pl-7"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={pending || !enabled}
              required
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">One-time per booking</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Maximum coverage amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
            <input
              type="number"
              min="0"
              step="1"
              className="input pl-7"
              value={coverage}
              onChange={(e) => setCoverage(e.target.value)}
              disabled={pending || !enabled}
              required
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">Max damage you'll cover</p>
        </div>
      </div>

      <div className="flex items-center justify-end pt-2 border-t border-slate-100">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}
