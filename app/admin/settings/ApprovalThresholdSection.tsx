"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ShieldAlert, Save } from "lucide-react";
import { saveApprovalThreshold } from "./approval-actions";

export function ApprovalThresholdSection({
  currentCents,
}: {
  currentCents: number | null;
}) {
  const [enabled, setEnabled] = useState(currentCents != null && currentCents > 0);
  const [amount, setAmount] = useState(
    currentCents != null ? (currentCents / 100).toFixed(0) : "1000",
  );
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const cents = enabled ? Math.round(parseFloat(amount) * 100) : null;
      if (enabled && (Number.isNaN(cents) || (cents ?? 0) <= 0)) {
        toast.error("Threshold must be a positive number");
        return;
      }
      const r = await saveApprovalThreshold({ thresholdCents: cents });
      if ((r as any).error) {
        toast.error((r as any).error);
        return;
      }
      toast.success(
        enabled
          ? `Approval required above $${amount}`
          : "Approval workflow disabled",
      );
    });
  }

  return (
    <div className="card mb-6">
      <div className="flex items-start gap-3 mb-3">
        <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h2 className="font-bold text-brand-navy text-sm">
            High-ticket booking approval
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            When a customer books above a threshold, hold the confirmation
            email until you approve. Stops staff mistakes on big orders and
            gives you a final review on anything expensive.
          </p>
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer mb-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4"
        />
        <span className="text-sm text-slate-700">
          Require approval above a dollar threshold
        </span>
      </label>

      {enabled && (
        <div className="flex items-end gap-3 mb-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Threshold (USD)
            </label>
            <div className="flex items-center gap-1">
              <span className="text-slate-500">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={1}
                max={1_000_000}
                className="w-32 border border-slate-300 rounded px-2 py-1.5 text-sm focus:border-brand-navy outline-none"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Bookings ≥ ${amount} land in "pending" until you approve.
            </p>
          </div>
        </div>
      )}

      <button
        onClick={save}
        disabled={pending}
        className="inline-flex items-center gap-1 bg-brand-navy hover:bg-brand-navy/90 disabled:opacity-50 text-white text-sm font-semibold px-3 py-2 rounded"
      >
        <Save className="h-3.5 w-3.5" />
        {pending ? "Saving…" : "Save approval settings"}
      </button>
    </div>
  );
}
