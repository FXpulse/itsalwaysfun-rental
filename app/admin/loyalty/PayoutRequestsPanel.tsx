"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Check,
  X,
  FileText,
  DollarSign,
  Gift,
  Clock,
  ExternalLink,
} from "lucide-react";
import {
  approvePayoutRequest,
  markPayoutProcessed,
  rejectPayoutRequest,
} from "./payout-admin-actions";
import { formatCurrency } from "@/lib/utils";

interface PayoutRequest {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  amount_cents: number;
  payout_type: "stripe" | "credit";
  status: string;
  w9_url: string | null;
  requested_at: string;
  approved_at: string | null;
  customer_notes: string | null;
  admin_notes: string | null;
}

export function PayoutRequestsPanel({ requests }: { requests: PayoutRequest[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [mode, setMode] = useState<"approve" | "reject" | "process" | null>(null);

  function handleApprove(r: PayoutRequest) {
    startTransition(async () => {
      const result = await approvePayoutRequest(r.id, adminNote || undefined);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.type === "credit_issued") {
        toast.success(`Gift card ${result.code} issued + emailed to customer`);
      } else {
        toast.success("Approved — process the cash payment then click 'Mark paid'");
      }
      setActioningId(null);
      setMode(null);
      setAdminNote("");
      router.refresh();
    });
  }

  function handleProcess(r: PayoutRequest) {
    startTransition(async () => {
      const result = await markPayoutProcessed(r.id, adminNote);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Payout marked as processed");
      setActioningId(null);
      setMode(null);
      setAdminNote("");
      router.refresh();
    });
  }

  function handleReject(r: PayoutRequest) {
    if (!rejectReason.trim()) {
      toast.error("Reason required");
      return;
    }
    startTransition(async () => {
      const result = await rejectPayoutRequest(r.id, rejectReason);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Rejected");
      setActioningId(null);
      setMode(null);
      setRejectReason("");
      router.refresh();
    });
  }

  if (requests.length === 0) return null;

  return (
    <div className="card border-l-4 border-l-amber-500 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-5 w-5 text-amber-600" />
        <h2 className="text-lg font-semibold text-brand-navy">
          Payout requests ({requests.length})
        </h2>
      </div>

      <div className="space-y-3">
        {requests.map((r) => {
          const isActioning = actioningId === r.id;
          return (
            <div
              key={r.id}
              className={`border rounded-lg p-3 ${
                r.status === "pending"
                  ? "bg-amber-50 border-amber-300"
                  : r.status === "approved"
                    ? "bg-blue-50 border-blue-300"
                    : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-brand-navy">{r.user_name}</span>
                    <span className="text-xs text-slate-500">· {r.user_email}</span>
                    {r.payout_type === "credit" ? (
                      <span className="text-xs bg-green-100 text-green-800 rounded px-2 py-0.5 inline-flex items-center gap-1">
                        <Gift className="h-3 w-3" /> Credit (no W9)
                      </span>
                    ) : (
                      <span className="text-xs bg-blue-100 text-blue-800 rounded px-2 py-0.5 inline-flex items-center gap-1">
                        <DollarSign className="h-3 w-3" /> Cash
                      </span>
                    )}
                    {r.status === "approved" && (
                      <span className="text-xs bg-blue-100 text-blue-800 rounded px-2 py-0.5">
                        approved · waiting for payment
                      </span>
                    )}
                  </div>
                  {r.customer_notes && (
                    <p className="text-xs text-slate-600 mb-1">
                      <strong>Note:</strong> {r.customer_notes}
                    </p>
                  )}
                  {r.w9_url && (
                    <a
                      href={r.w9_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-700 hover:underline inline-flex items-center gap-1"
                    >
                      <FileText className="h-3 w-3" /> View W9 form
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <div className="text-[10px] text-slate-400 mt-1">
                    Requested {new Date(r.requested_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-brand-navy text-lg">
                    {formatCurrency(r.amount_cents)}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              {!isActioning && (
                <div className="flex gap-2 mt-2">
                  {r.status === "pending" && (
                    <>
                      <button
                        onClick={() => {
                          setActioningId(r.id);
                          setMode("approve");
                        }}
                        disabled={pending}
                        className="inline-flex items-center gap-1 bg-green-600 text-white text-sm font-semibold rounded px-3 py-1.5 hover:bg-green-700"
                      >
                        <Check className="h-3 w-3" /> Approve
                      </button>
                      <button
                        onClick={() => {
                          setActioningId(r.id);
                          setMode("reject");
                        }}
                        disabled={pending}
                        className="inline-flex items-center gap-1 border border-red-300 text-red-700 text-sm font-semibold rounded px-3 py-1.5 hover:bg-red-50"
                      >
                        <X className="h-3 w-3" /> Reject
                      </button>
                    </>
                  )}
                  {r.status === "approved" && r.payout_type === "stripe" && (
                    <button
                      onClick={() => {
                        setActioningId(r.id);
                        setMode("process");
                      }}
                      disabled={pending}
                      className="inline-flex items-center gap-1 bg-brand-navy text-white text-sm font-semibold rounded px-3 py-1.5 hover:bg-brand-navy-dark"
                    >
                      <Check className="h-3 w-3" /> Mark as paid
                    </button>
                  )}
                </div>
              )}

              {/* Inline action form */}
              {isActioning && mode === "approve" && (
                <div className="mt-3 space-y-2 bg-white border rounded p-2">
                  <p className="text-xs text-slate-600">
                    {r.payout_type === "credit"
                      ? "→ Will auto-issue a gift card to the customer + email them."
                      : "→ Will mark as approved. Then YOU process payment externally (Stripe/Venmo/Zelle), come back, click 'Mark as paid'."}
                  </p>
                  <input
                    type="text"
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="Admin note (optional)"
                    className="input text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(r)}
                      disabled={pending}
                      className="bg-green-600 text-white text-sm font-semibold rounded px-3 py-1.5 hover:bg-green-700"
                    >
                      {pending ? "Approving..." : "Confirm approve"}
                    </button>
                    <button
                      onClick={() => {
                        setActioningId(null);
                        setMode(null);
                        setAdminNote("");
                      }}
                      className="text-xs text-slate-600 hover:text-slate-900 px-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {isActioning && mode === "reject" && (
                <div className="mt-3 space-y-2 bg-white border rounded p-2">
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason (shown to customer)"
                    className="input text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReject(r)}
                      disabled={pending}
                      className="bg-red-600 text-white text-sm font-semibold rounded px-3 py-1.5 hover:bg-red-700"
                    >
                      {pending ? "Rejecting..." : "Confirm reject"}
                    </button>
                    <button
                      onClick={() => {
                        setActioningId(null);
                        setMode(null);
                        setRejectReason("");
                      }}
                      className="text-xs text-slate-600 hover:text-slate-900 px-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {isActioning && mode === "process" && (
                <div className="mt-3 space-y-2 bg-white border rounded p-2">
                  <input
                    type="text"
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="How paid? e.g. Stripe transfer, Venmo @user, Zelle confirmation #"
                    className="input text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleProcess(r)}
                      disabled={pending}
                      className="bg-brand-navy text-white text-sm font-semibold rounded px-3 py-1.5 hover:bg-brand-navy-dark"
                    >
                      {pending ? "Saving..." : "Mark paid + close"}
                    </button>
                    <button
                      onClick={() => {
                        setActioningId(null);
                        setMode(null);
                        setAdminNote("");
                      }}
                      className="text-xs text-slate-600 hover:text-slate-900 px-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
