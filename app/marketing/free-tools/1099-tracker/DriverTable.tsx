"use client";

import { useState } from "react";
import { Trash2, Plus, AlertTriangle } from "lucide-react";
import type { Driver, Summary } from "@/lib/marketing/1099-tracker-logic";

export function DriverTable({
  drivers,
  summary,
  onAdd,
  onRemove,
}: {
  drivers: Driver[];
  summary: Summary;
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
}) {
  const [name, setName] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = name.trim();
    if (!v) return;
    if (drivers.some((d) => d.name.trim().toLowerCase() === v.toLowerCase())) {
      return;
    }
    onAdd(v);
    setName("");
  }

  return (
    <div className="card">
      <h2 className="text-lg font-bold text-brand-navy mb-3">
        📝 Step 1: Your contractors
      </h2>

      {drivers.length === 0 ? (
        <p className="text-sm text-slate-500 py-2">No contractors yet — add the first one below.</p>
      ) : (
        <table className="w-full text-sm mb-3">
          <thead className="text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left pb-2">Driver name</th>
              <th className="text-right pb-2">Total ({summary.taxYear})</th>
              <th className="text-right pb-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {summary.rows.map((row) => (
              <tr key={row.driverId}>
                <td className="py-2 font-medium">{row.name}</td>
                <td className="py-2 text-right font-mono">
                  ${(row.totalCents / 100).toFixed(2)}
                  {row.overThreshold && (
                    <span
                      className="inline-flex items-center gap-1 ml-2 text-amber-700 font-semibold"
                      title="At or over the IRS $600 1099-NEC threshold"
                    >
                      <AlertTriangle className="h-3 w-3" />
                    </span>
                  )}
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onRemove(row.driverId)}
                    title="Remove driver and all their payments"
                    className="text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          className="input flex-1"
          placeholder="New driver name (e.g. Mike Johnson)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
        />
        <button type="submit" className="btn-primary inline-flex items-center gap-1" disabled={!name.trim()}>
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>
    </div>
  );
}
