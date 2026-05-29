"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { Driver, Payment } from "@/lib/marketing/1099-tracker-logic";

const PAGE = 10;

export function PaymentList({
  payments,
  drivers,
  onRemove,
}: {
  payments: Payment[];
  drivers: Driver[];
  onRemove: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (payments.length === 0) {
    return null;
  }

  const driverName = (id: string) =>
    drivers.find((d) => d.id === id)?.name || "(deleted)";

  // Newest first
  const sorted = [...payments].sort((a, b) => b.date.localeCompare(a.date));
  const visible = expanded ? sorted : sorted.slice(0, PAGE);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-700">
          Recent payments {expanded ? `(${payments.length})` : `(last ${visible.length} of ${payments.length})`}
        </h3>
        {payments.length > PAGE && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-brand-navy underline hover:text-brand-navy-dark"
          >
            {expanded ? "Collapse" : `View all (${payments.length})`}
          </button>
        )}
      </div>
      <table className="w-full text-sm">
        <thead className="text-[10px] uppercase tracking-wider text-slate-500">
          <tr>
            <th className="text-left pb-2">Date</th>
            <th className="text-left pb-2">Driver</th>
            <th className="text-right pb-2">Amount</th>
            <th className="text-left pb-2 pl-3">Note</th>
            <th className="pb-2 w-8"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {visible.map((p) => (
            <tr key={p.id}>
              <td className="py-2 font-mono text-xs">{p.date}</td>
              <td className="py-2">{driverName(p.driverId)}</td>
              <td className="py-2 text-right font-mono">
                ${(p.amountCents / 100).toFixed(2)}
              </td>
              <td className="py-2 pl-3 text-xs text-slate-500 truncate max-w-xs">
                {p.note || "—"}
              </td>
              <td className="py-2 text-right">
                <button
                  type="button"
                  onClick={() => onRemove(p.id)}
                  title="Remove payment"
                  className="text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
