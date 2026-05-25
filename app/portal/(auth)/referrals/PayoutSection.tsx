"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  Gift,
  X,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { requestPayout, cancelPayoutRequest } from "./payout-actions";
import { formatCurrency } from "@/lib/utils";

interface PayoutHistoryRow {
  id: string;
  amount_cents: number;
  payout_type: "stripe" | "credit";
  status: string;
  requested_at: string;
  approved_at: string | null;
  processed_at: string | null;
  rejected_reason: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-blue-100 text-blue-800",
  processed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-slate-200 text-slate-600",
};

export function PayoutSection({
  pendingBalance,
  hasW9OnFile,
  w9UploadedAt,
  w9TaxYear,
  payoutHistory,
}: {
  pendingBalance: number;
  hasW9OnFile: boolean;
  w9UploadedAt: string | null;
  w9TaxYear: number | null;
  payoutHistory: PayoutHistoryRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [requesting, setRequesting] = useState(false);

  const [payoutType, setPayoutType] = useState<"stripe" | "credit">("credit");
  const [amount, setAmount] = useState((pendingBalance / 100).toFixed(2));
  const [notes, setNotes] = useState("");
  const [w9File, setW9File] = useState<File | null>(null);

  const hasPending = payoutHistory.some((p) => p.status === "pending");

  function reset() {
    setPayoutType("credit");
    setAmount((pendingBalance / 100).toFixed(2));
    setNotes("");
    setW9File(null);
    setRequesting(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (payoutType === "stripe" && !hasW9OnFile && !w9File) {
      toast.error("Please upload your W9 form (required for cash payouts)");
      return;
    }
    const fd = new FormData();
    fd.append("amount_dollars", amount);
    fd.append("payout_type", payoutType);
    if (notes) fd.append("notes", notes);
    if (w9File) fd.append("w9_file", w9File);

    startTransition(async () => {
      const r = await requestPayout(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Payout request submitted — admin will review shortly");
      reset();
      router.refresh();
    });
  }

  function handleCancel(requestId: string) {
    if (!confirm("Cancel this payout request?")) return;
    startTransition(async () => {
      const r = await cancelPayoutRequest(requestId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Request cancelled");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Request payout button or form */}
      {!requesting && pendingBalance > 0 && !hasPending && (
        <div className="card border-2 border-brand-yellow bg-brand-yellow/5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-brand-navy mb-1">
                💵 Request your commission payout
              </h2>
              <p className="text-sm text-slate-700">
                You have <strong>{formatCurrency(pendingBalance)}</strong> pending.
                Get paid in cash (Stripe/Venmo/Zelle) OR take it as a credit on your next rental.
              </p>
            </div>
            <button
              onClick={() => setRequesting(true)}
              className="btn-primary whitespace-nowrap"
            >
              Request payout
            </button>
          </div>
        </div>
      )}

      {hasPending && (
        <div className="card bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h2 className="font-bold text-amber-900">Payout request pending review</h2>
              <p className="text-sm text-amber-800">
                Admin will process it soon. You'll get an email when approved.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Request form modal */}
      {requesting && (
        <div className="card border-2 border-blue-300 bg-blue-50/30">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-brand-navy">Request payout</h2>
            <button onClick={reset} className="text-slate-400 hover:text-slate-700">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Payout type selection */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPayoutType("credit")}
                className={`text-left rounded-md border-2 p-3 transition ${
                  payoutType === "credit"
                    ? "border-brand-navy bg-white"
                    : "border-slate-200 bg-white/50 hover:border-slate-400"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Gift className="h-4 w-4 text-green-700" />
                  <strong className="text-sm">As rental credit</strong>
                </div>
                <p className="text-xs text-slate-600">
                  Get a gift card you can use at checkout. <strong>No W9 needed.</strong>{" "}
                  Faster — auto-issued on admin approval.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setPayoutType("stripe")}
                className={`text-left rounded-md border-2 p-3 transition ${
                  payoutType === "stripe"
                    ? "border-brand-navy bg-white"
                    : "border-slate-200 bg-white/50 hover:border-slate-400"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-blue-700" />
                  <strong className="text-sm">Cash payout</strong>
                </div>
                <p className="text-xs text-slate-600">
                  Paid via Stripe/Venmo/Zelle. <strong>W9 required</strong> for tax reporting (1099 at year-end).
                </p>
              </button>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Amount to request{" "}
                <span className="text-xs text-slate-400">
                  (max {formatCurrency(pendingBalance)})
                </span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="number"
                  min="1"
                  max={pendingBalance / 100}
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input pl-7"
                />
              </div>
              <button
                type="button"
                onClick={() => setAmount((pendingBalance / 100).toFixed(2))}
                className="text-xs text-brand-navy hover:underline mt-1"
              >
                Use full balance
              </button>
            </div>

            {/* W9 — only for stripe type */}
            {payoutType === "stripe" && (
              <div className="bg-amber-50 border border-amber-200 rounded p-3">
                <div className="flex items-start gap-2 mb-2">
                  <FileText className="h-5 w-5 text-amber-700 mt-0.5" />
                  <div>
                    <strong className="text-sm text-amber-900">W9 form required</strong>
                    <p className="text-xs text-amber-800">
                      For tax reporting (we file 1099 at year-end if you earn ≥$600).
                      Download blank W9 from{" "}
                      <a
                        href="https://www.irs.gov/pub/irs-pdf/fw9.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline font-semibold"
                      >
                        IRS.gov
                      </a>
                      , fill it out + sign, then upload here.
                    </p>
                  </div>
                </div>

                {hasW9OnFile ? (
                  <div className="bg-white border border-amber-300 rounded p-2 text-xs flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>
                      W9 on file (uploaded{" "}
                      {w9UploadedAt && new Date(w9UploadedAt).toLocaleDateString()})
                      {w9TaxYear && ` for tax year ${w9TaxYear}`}. You can upload a new one to replace it.
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-amber-800 mb-2">No W9 on file yet.</p>
                )}

                <label className="block mt-2">
                  <span className="text-xs font-semibold text-slate-700">
                    Upload W9 (PDF or image)
                    {!hasW9OnFile && <span className="text-red-500"> *</span>}
                  </span>
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    onChange={(e) => setW9File(e.target.files?.[0] || null)}
                    className="input mt-1 text-sm"
                  />
                </label>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Notes (optional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Preferred payment method (Venmo handle, Zelle email, etc.)"
                className="input"
              />
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={pending} className="btn-primary">
                {pending ? "Submitting..." : "Submit request"}
              </button>
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* History */}
      {payoutHistory.length > 0 && (
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">
            Payout history
          </h3>
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 text-left">Requested</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payoutHistory.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 text-xs">
                      {new Date(p.requested_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {p.payout_type === "credit" ? "🎁 Credit" : "💵 Cash"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatCurrency(p.amount_cents)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-xs rounded px-2 py-0.5 ${STATUS_STYLES[p.status]}`}
                      >
                        {p.status}
                      </span>
                      {p.rejected_reason && (
                        <div className="text-[10px] text-red-700 mt-0.5">
                          {p.rejected_reason}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {p.status === "pending" && (
                        <button
                          onClick={() => handleCancel(p.id)}
                          disabled={pending}
                          className="text-xs text-amber-700 hover:text-amber-900"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pendingBalance === 0 && payoutHistory.length === 0 && (
        <div className="card text-center text-slate-400 text-sm py-6">
          You haven't earned commission yet. Share your link to start!
        </div>
      )}
    </div>
  );
}
