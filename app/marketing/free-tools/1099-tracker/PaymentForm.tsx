"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { Driver, Payment } from "@/lib/marketing/1099-tracker-logic";

export function PaymentForm({
  drivers,
  onAdd,
}: {
  drivers: Driver[];
  onAdd: (p: Omit<Payment, "id">) => void;
}) {
  const [driverId, setDriverId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dollars = Number(amount);
    if (!driverId || !date || !Number.isFinite(dollars) || dollars <= 0) return;
    onAdd({
      driverId,
      date,
      amountCents: Math.round(dollars * 100),
      note: note.trim() || undefined,
    });
    setAmount("");
    setNote("");
  }

  if (drivers.length === 0) {
    return (
      <div className="card bg-slate-50 border-slate-200 text-slate-500 text-sm">
        💵 Step 2: Log payments — add a contractor above first.
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-lg font-bold text-brand-navy mb-3">
        💵 Step 2: Log payments
      </h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
        <div className="sm:col-span-4">
          <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Driver</label>
          <select
            className="input"
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            required
          >
            <option value="">— pick driver —</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-3">
          <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Date</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Amount</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            className="input"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Note</label>
          <input
            type="text"
            className="input"
            placeholder="Optional"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="sm:col-span-1">
          <button type="submit" className="btn-primary w-full inline-flex items-center justify-center gap-1">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
