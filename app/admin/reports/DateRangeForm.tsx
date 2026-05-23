"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Calendar } from "lucide-react";

export function DateRangeForm({
  initialFrom,
  initialTo,
}: {
  initialFrom: string;
  initialTo: string;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  function apply(newFrom: string, newTo: string) {
    const params = new URLSearchParams({ from: newFrom, to: newTo });
    router.push(`/admin/reports?${params.toString()}`);
  }

  function preset(days: number) {
    const today = new Date();
    const past = new Date();
    past.setDate(past.getDate() - days);
    const fromStr = past.toISOString().split("T")[0];
    const toStr = today.toISOString().split("T")[0];
    setFrom(fromStr);
    setTo(toStr);
    apply(fromStr, toStr);
  }

  function thisMonth() {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const fromStr = first.toISOString().split("T")[0];
    const toStr = now.toISOString().split("T")[0];
    setFrom(fromStr);
    setTo(toStr);
    apply(fromStr, toStr);
  }

  function ytd() {
    const now = new Date();
    const first = new Date(now.getFullYear(), 0, 1);
    const fromStr = first.toISOString().split("T")[0];
    const toStr = now.toISOString().split("T")[0];
    setFrom(fromStr);
    setTo(toStr);
    apply(fromStr, toStr);
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-slate-500 mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="input"
          />
        </div>
        <button onClick={() => apply(from, to)} className="btn-primary inline-flex items-center gap-2">
          <Calendar className="h-4 w-4" /> Apply
        </button>
        <div className="flex-1" />
        <div className="flex gap-2 text-xs">
          <button onClick={() => preset(7)} className="text-slate-600 hover:text-brand-navy underline">
            Last 7d
          </button>
          <button onClick={() => preset(30)} className="text-slate-600 hover:text-brand-navy underline">
            Last 30d
          </button>
          <button onClick={() => preset(90)} className="text-slate-600 hover:text-brand-navy underline">
            Last 90d
          </button>
          <button onClick={thisMonth} className="text-slate-600 hover:text-brand-navy underline">
            This month
          </button>
          <button onClick={ytd} className="text-slate-600 hover:text-brand-navy underline">
            YTD
          </button>
        </div>
      </div>
    </div>
  );
}
