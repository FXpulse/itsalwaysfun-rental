"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle, Truck, Flag, XCircle, Save, DollarSign, RotateCcw, AlertTriangle, Undo2 } from "lucide-react";
import {
  updateBookingStatus,
  markAsPaidManually,
  updateBookingNotes,
  restoreBooking,
  refundBooking,
} from "../actions";
import type { Booking } from "@/types/database";

export function BookingActions({
  booking,
}: {
  booking: Booking & { payment_method?: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [notes, setNotes] = useState(booking.notes || "");
  const [paidMethod, setPaidMethod] = useState<string>("cash");
  const [paidNote, setPaidNote] = useState("");
  const [refundNote, setRefundNote] = useState("");
  const [showRefundForm, setShowRefundForm] = useState(false);

  function handleStatusChange(newStatus: string) {
    let msg = `Mark booking as "${newStatus.replace(/_/g, " ")}"?`;
    if (newStatus === "cancelled" && booking.stripe_payment_status === "paid") {
      msg = "⚠️ Customer already PAID for this booking. Cancelling here does NOT issue a refund — you must refund manually via Stripe Dashboard. Continue?";
    }
    if (!confirm(msg)) return;
    startTransition(async () => {
      const result = await updateBookingStatus(booking.id, newStatus);
      if (result?.error) toast.error(result.error);
      else {
        toast.success(newStatus === "cancelled" ? "Booking cancelled" : "Status updated");
        router.refresh();
      }
    });
  }

  function handleRestore() {
    if (!confirm("Restore this cancelled booking? It will go back to pending payment (or confirmed if previously paid).")) return;
    startTransition(async () => {
      const result = await restoreBooking(booking.id);
      if (result?.error) toast.error(result.error);
      else {
        toast.success(`Restored to ${(result as any)?.newStatus?.replace(/_/g, " ") || "active"}`);
        router.refresh();
      }
    });
  }

  function handleRefund() {
    const method = booking.payment_method || (booking.stripe_payment_intent_id ? "stripe" : "manual");
    const isStripe = method === "stripe";
    const msg = isStripe
      ? "Refund this booking? Stripe will be charged back automatically and the customer will see the refund in 5-10 business days. This cannot be undone."
      : `Mark this ${method} payment as refunded? You'll need to return the money to the customer manually (cash, Venmo, etc). This will move the booking to cancelled status.`;
    if (!confirm(msg)) return;
    startTransition(async () => {
      const result = await refundBooking(booking.id, refundNote);
      if (result?.error) toast.error(result.error);
      else {
        const r = result as any;
        if (r?.auto_refunded) {
          toast.success("Refunded via Stripe");
        } else {
          toast.success("Marked as refunded — return money to customer");
        }
        setShowRefundForm(false);
        setRefundNote("");
        router.refresh();
      }
    });
  }

  function handleMarkAsPaid() {
    startTransition(async () => {
      const result = await markAsPaidManually(booking.id, paidMethod, paidNote);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Marked as paid + confirmed");
        setPaidNote("");
        router.refresh();
      }
    });
  }

  function handleSaveNotes() {
    startTransition(async () => {
      const result = await updateBookingNotes(booking.id, notes);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Notes saved");
      }
    });
  }

  const isPaid = booking.stripe_payment_status === "paid";
  const isRefunded = booking.stripe_payment_status === "refunded";
  const isCancelled = booking.booking_status === "cancelled";
  const paymentMethodLabel = booking.payment_method || (booking.stripe_payment_intent_id ? "stripe" : "manual");
  const isStripePayment = paymentMethodLabel === "stripe";

  return (
    <div className="space-y-6">
      {/* Restore button when cancelled */}
      {isCancelled && (
        <div className="card border-l-4 border-l-amber-500">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-brand-navy mb-1">
                This booking is cancelled
              </h2>
              <p className="text-sm text-slate-500 mb-4">
                Payment status: <strong>{booking.stripe_payment_status}</strong>.
                {isPaid && " Customer was charged — refund manually via Stripe if needed."}
                {" "}If this was cancelled by mistake, you can restore it.
              </p>
              <button
                onClick={handleRestore}
                disabled={pending}
                className="bg-brand-navy text-white font-semibold px-4 py-2 rounded-md hover:bg-brand-navy-dark transition inline-flex items-center gap-2 disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                Restore booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund (when paid) */}
      {isPaid && !isRefunded && (
        <div className="card border-l-4 border-l-orange-500">
          <h2 className="text-lg font-semibold text-brand-navy mb-1 flex items-center gap-2">
            <Undo2 className="h-5 w-5 text-orange-600" />
            Refund payment
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Payment method: <strong>{paymentMethodLabel}</strong>.
            {isStripePayment
              ? " Stripe will auto-refund the customer's card (5-10 business days). The booking will be cancelled."
              : " You'll need to return the money to the customer manually (cash, Venmo, Zelle, etc.). The booking will be marked refunded + cancelled in the system."}
          </p>

          {!showRefundForm ? (
            <button
              onClick={() => setShowRefundForm(true)}
              className="bg-orange-600 text-white font-semibold px-4 py-2 rounded-md hover:bg-orange-700 transition inline-flex items-center gap-2"
            >
              <Undo2 className="h-4 w-4" /> Issue refund
            </button>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
                  Audit note (optional)
                </label>
                <input
                  value={refundNote}
                  onChange={(e) => setRefundNote(e.target.value)}
                  placeholder="e.g. Customer cancelled due to weather"
                  className="input"
                  disabled={pending}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleRefund}
                  disabled={pending}
                  className="bg-orange-600 text-white font-semibold px-4 py-2 rounded-md hover:bg-orange-700 transition inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <Undo2 className="h-4 w-4" />
                  {pending ? "Processing..." : isStripePayment ? "Confirm refund (Stripe)" : "Confirm — mark refunded"}
                </button>
                <button
                  onClick={() => { setShowRefundForm(false); setRefundNote(""); }}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900"
                  disabled={pending}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isRefunded && (
        <div className="card border-l-4 border-l-slate-400 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-700 mb-1 flex items-center gap-2">
            <Undo2 className="h-5 w-5" />
            Refunded
          </h2>
          <p className="text-sm text-slate-600">
            This booking was refunded. See notes for audit trail.
          </p>
        </div>
      )}

      {/* Mark as paid manually (cash/Venmo/Zelle) */}
      {!isPaid && !isCancelled && (
        <div className="card border-l-4 border-l-emerald-500">
          <h2 className="text-lg font-semibold text-brand-navy mb-1 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            Mark as paid (manual)
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Use this when customer pays by cash, Venmo, Zelle, check, or any
            non-Stripe method. Marks booking as <strong>confirmed + paid</strong>.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
                Payment method
              </label>
              <select
                value={paidMethod}
                onChange={(e) => setPaidMethod(e.target.value)}
                className="input"
                disabled={pending}
              >
                <option value="cash">Cash</option>
                <option value="venmo">Venmo</option>
                <option value="zelle">Zelle</option>
                <option value="check">Check</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
                Audit note (optional)
              </label>
              <input
                value={paidNote}
                onChange={(e) => setPaidNote(e.target.value)}
                placeholder="e.g. Venmo transaction ID, check number"
                className="input"
                disabled={pending}
              />
            </div>
          </div>

          <button
            onClick={handleMarkAsPaid}
            disabled={pending}
            className="bg-emerald-600 text-white font-semibold px-4 py-2 rounded-md hover:bg-emerald-700 transition disabled:opacity-50"
          >
            ✓ Mark as paid
          </button>
        </div>
      )}

      {/* Status transitions (hidden when cancelled — use Restore card above) */}
      {!isCancelled && (
      <div className="card">
        <h2 className="text-lg font-semibold text-brand-navy mb-1">
          Change booking status
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Current: <strong>{booking.booking_status.replace(/_/g, " ")}</strong>
        </p>

        <div className="flex flex-wrap gap-2">
          {booking.booking_status !== "confirmed" && !isCancelled && (
            <button
              onClick={() => handleStatusChange("confirmed")}
              disabled={pending}
              className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded hover:bg-blue-100 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" /> Mark Confirmed
            </button>
          )}
          {booking.booking_status !== "delivered" && booking.booking_status !== "completed" && !isCancelled && (
            <button
              onClick={() => handleStatusChange("delivered")}
              disabled={pending}
              className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 border border-purple-200 px-4 py-2 rounded hover:bg-purple-100 disabled:opacity-50"
            >
              <Truck className="h-4 w-4" /> Mark Delivered
            </button>
          )}
          {booking.booking_status !== "completed" && !isCancelled && (
            <button
              onClick={() => handleStatusChange("completed")}
              disabled={pending}
              className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 rounded hover:bg-emerald-100 disabled:opacity-50"
            >
              <Flag className="h-4 w-4" /> Mark Completed
            </button>
          )}
          {!isCancelled && (
            <button
              onClick={() => handleStatusChange("cancelled")}
              disabled={pending}
              className="inline-flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded hover:bg-red-100 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" /> Cancel Booking
            </button>
          )}
        </div>
      </div>
      )}

      {/* Notes */}
      <div className="card">
        <h2 className="text-lg font-semibold text-brand-navy mb-1">Notes</h2>
        <p className="text-sm text-slate-500 mb-3">
          Internal notes. Customer doesn't see these. Manual payment audit lines
          are auto-appended here.
        </p>
        <textarea
          rows={6}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="input font-mono text-xs"
          disabled={pending}
          placeholder="Add notes about this booking..."
        />
        <div className="mt-3">
          <button
            onClick={handleSaveNotes}
            disabled={pending}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Save className="h-4 w-4" /> Save notes
          </button>
        </div>
      </div>
    </div>
  );
}
