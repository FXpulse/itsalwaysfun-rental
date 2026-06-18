"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, X, Sparkles } from "lucide-react";
import { approveBookingAction, rejectBookingAction } from "./approval-actions";

interface ApprovalBannerProps {
  bookingId: string;
  approvalStatus: "pending" | "approved" | "rejected" | null;
  requestedAt: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  notes: string | null;
  totalDollars: string;
  thresholdDollars: string | null;
}

export function ApprovalBanner(props: ApprovalBannerProps) {
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  function approve() {
    startTransition(async () => {
      const r = await approveBookingAction({ bookingId: props.bookingId });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Booking approved — confirmation email sent");
    });
  }

  function submitRejection() {
    if (reason.trim().length < 3) {
      toast.error("Reason required (min 3 chars)");
      return;
    }
    startTransition(async () => {
      const r = await rejectBookingAction({ bookingId: props.bookingId, notes: reason });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Booking rejected");
      setRejecting(false);
      setReason("");
    });
  }

  // Pending → action required banner
  if (props.approvalStatus === "pending") {
    return (
      <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4 mb-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-amber-900 text-sm">
              Awaiting admin approval — high-ticket booking
            </h3>
            <p className="text-xs text-amber-800 mt-0.5">
              Customer paid ${props.totalDollars}
              {props.thresholdDollars
                ? `, above the $${props.thresholdDollars} threshold`
                : ""}. Confirmation email holds until you decide.
            </p>
            {props.requestedAt && (
              <p className="text-[10px] text-amber-700 mt-0.5">
                Requested {new Date(props.requestedAt).toLocaleString()}
              </p>
            )}

            {rejecting ? (
              <div className="mt-3 space-y-2">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why are you rejecting? Customer will not see this. Required."
                  rows={2}
                  maxLength={500}
                  className="w-full text-xs border border-amber-300 rounded p-2"
                />
                <div className="flex gap-2">
                  <button
                    onClick={submitRejection}
                    disabled={pending}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded disabled:opacity-50"
                  >
                    {pending ? "Rejecting…" : "Confirm rejection"}
                  </button>
                  <button
                    onClick={() => {
                      setRejecting(false);
                      setReason("");
                    }}
                    disabled={pending}
                    className="text-xs text-slate-600 px-3 py-1.5 hover:bg-slate-100 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex gap-2 flex-wrap">
                <button
                  onClick={approve}
                  disabled={pending}
                  className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  {pending ? "Approving…" : "Approve booking"}
                </button>
                <button
                  onClick={() => setRejecting(true)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 text-red-700 hover:bg-red-50 border border-red-300 text-xs font-semibold px-3 py-1.5 rounded disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Reject
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Approved → informational chip (small, since not urgent)
  if (props.approvalStatus === "approved" && props.decidedAt) {
    return (
      <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 mb-4 text-xs text-emerald-800 flex items-center gap-1.5">
        <Sparkles className="h-3 w-3" />
        <span>
          Approved {new Date(props.decidedAt).toLocaleDateString()}
          {props.decidedBy ? ` by ${props.decidedBy}` : ""}
        </span>
        {props.notes && <span className="text-emerald-700 italic">· {props.notes}</span>}
      </div>
    );
  }

  // Rejected → red banner
  if (props.approvalStatus === "rejected") {
    return (
      <div className="rounded-lg border-2 border-red-400 bg-red-50 p-4 mb-4">
        <div className="flex items-start gap-3">
          <X className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-red-900 text-sm">Booking rejected</h3>
            {props.decidedAt && (
              <p className="text-xs text-red-800 mt-0.5">
                {new Date(props.decidedAt).toLocaleString()}
                {props.decidedBy ? ` · by ${props.decidedBy}` : ""}
              </p>
            )}
            {props.notes && (
              <p className="text-xs text-red-700 mt-2 italic">"{props.notes}"</p>
            )}
            <p className="text-[11px] text-red-600 mt-2">
              Customer did NOT receive a confirmation email. Follow up manually
              and use the standard refund flow if a payment was captured.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
