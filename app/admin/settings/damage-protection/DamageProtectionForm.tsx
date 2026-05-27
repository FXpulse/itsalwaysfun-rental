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
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 rounded text-brand-navy focus:ring-brand-navy"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={pending}
        />
        <div>
          <div className="font-semibold text-brand-navy">
            Show damage protection at checkout
          </div>
          <div className="text-sm text-slate-500">
            When off, customers don't see the option and the fee is never added.
          </div>
        </div>
      </label>

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
