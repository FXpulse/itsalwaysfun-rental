"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { DollarSign, Sparkles } from "lucide-react";
import { recordCommissionPayout, recordAdjustment } from "../actions";

export function PayoutForm({
  userId,
  maxPending,
}: {
  userId: string;
  maxPending: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (maxPending === 0) {
      toast.error("No pending commission to pay out");
      return;
    }
    const fd = new FormData();
    fd.append("user_id", userId);
    fd.append("amount_dollars", amount);
    fd.append("note", note);
    startTransition(async () => {
      const r = await recordCommissionPayout(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Payout recorded");
      setAmount("");
      setNote("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs text-slate-600 mb-1">
          Amount (USD){" "}
          {maxPending > 0 && (
            <span className="text-slate-400">
              (max ${(maxPending / 100).toFixed(2)})
            </span>
          )}
        </label>
        <div className="relative">
          <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="number"
            min="0.01"
            max={maxPending / 100}
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="input pl-7"
            disabled={pending || maxPending === 0}
          />
        </div>
        {maxPending > 0 && (
          <button
            type="button"
            onClick={() => setAmount((maxPending / 100).toFixed(2))}
            className="text-xs text-brand-navy hover:underline mt-1"
          >
            Use full pending balance
          </button>
        )}
      </div>
      <div>
        <label className="block text-xs text-slate-600 mb-1">
          Payment method / note
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Venmo @ludmila"
          className="input"
          disabled={pending}
        />
      </div>
      <button
        type="submit"
        disabled={pending || maxPending === 0}
        className="btn-primary w-full"
      >
        {pending ? "Recording..." : "Record payout"}
      </button>
    </form>
  );
}

export function AdjustForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<"points" | "commission">("points");
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("user_id", userId);
    fd.append("type", type);
    // For commission, accept dollar input and convert
    const numeric = parseFloat(delta);
    if (Number.isNaN(numeric) || numeric === 0) {
      toast.error("Enter a non-zero amount");
      return;
    }
    fd.append(
      "delta",
      type === "commission" ? String(Math.round(numeric * 100)) : String(Math.round(numeric)),
    );
    fd.append("note", note);
    startTransition(async () => {
      const r = await recordAdjustment(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Adjustment recorded");
      setDelta("");
      setNote("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs text-slate-600 mb-1">What to adjust</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as any)}
          className="input"
          disabled={pending}
        >
          <option value="points">Loyalty points</option>
          <option value="commission">Commission (USD)</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-600 mb-1">
          {type === "points" ? "Points (negative to subtract)" : "Amount $ (negative to subtract)"}
        </label>
        <div className="relative">
          {type === "commission" && (
            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          )}
          {type === "points" && (
            <Sparkles className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          )}
          <input
            type="number"
            step={type === "commission" ? "0.01" : "1"}
            required
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder={type === "points" ? "+100 or -50" : "+10.00 or -5.00"}
            className="input pl-7"
            disabled={pending}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-slate-600 mb-1">
          Reason <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Customer complaint comp, bonus, error correction"
          className="input"
          disabled={pending}
        />
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Saving..." : "Apply adjustment"}
      </button>
    </form>
  );
}
