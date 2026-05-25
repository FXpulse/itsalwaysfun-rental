"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Calendar,
  X,
  Clock,
  AlertTriangle,
  Lock,
} from "lucide-react";
import {
  confirmBookingByCustomer,
  modifyBookingDate,
  cancelBookingByCustomer,
} from "./actions";

interface Props {
  bookingId: string;
  eventDate: string;          // YYYY-MM-DD
  eventEndDate: string | null;
  startTime: string | null;
  bookingStatus: string;
  customerConfirmedAt: string | null;
}

const CUTOFF_HOURS = 48;

function hoursUntilEvent(eventDate: string, startTime: string | null): number {
  const time = startTime || "09:00:00";
  return (new Date(`${eventDate}T${time}`).getTime() - Date.now()) / (1000 * 60 * 60);
}

export function BookingActionsCustomer({
  bookingId,
  eventDate,
  eventEndDate,
  startTime,
  bookingStatus,
  customerConfirmedAt,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modifying, setModifying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [reason, setReason] = useState("");

  const hours = hoursUntilEvent(eventDate, startTime);
  const locked = hours < CUTOFF_HOURS;
  const isCancelled = bookingStatus === "cancelled";
  const isCompleted = bookingStatus === "completed" || bookingStatus === "delivered";

  // Hide actions for past / cancelled bookings
  if (isCancelled || isCompleted) {
    return (
      <div className="card text-center text-slate-400 py-6">
        <Lock className="h-6 w-6 mx-auto mb-1 opacity-40" />
        <p className="text-sm">
          {isCancelled ? "Booking is cancelled" : "Booking is complete"}
        </p>
      </div>
    );
  }

  // Locked state — too close to event
  if (locked && hours > 0) {
    return (
      <div className="card bg-amber-50 border-amber-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <h2 className="font-semibold text-amber-900 mb-1">Changes locked</h2>
            <p className="text-sm text-amber-800">
              Your event is in {Math.ceil(hours)}h — within the {CUTOFF_HOURS}h cutoff for self-service
              changes. Need to modify or cancel? Call <strong>(904) 584-3047</strong>.
            </p>
            {customerConfirmedAt && (
              <p className="text-xs text-amber-700 mt-2">
                ✓ Confirmed by you on {new Date(customerConfirmedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (hours <= 0) {
    return null; // event already happened, no actions needed
  }

  // === MODIFY DATE MODAL ===
  if (modifying) {
    return (
      <div className="card border-blue-200 bg-blue-50">
        <h2 className="font-bold text-brand-navy mb-2 flex items-center gap-2">
          <Calendar className="h-4 w-4" /> Change event date
        </h2>
        <p className="text-xs text-slate-600 mb-3">
          Pick new dates. We'll check availability for your product.
        </p>
        <form
          action={(fd) =>
            startTransition(async () => {
              const r = await modifyBookingDate(bookingId, fd);
              if (r.error) {
                toast.error(r.error);
                return;
              }
              toast.success(`Date changed to ${r.new_event_date}`);
              setModifying(false);
              router.refresh();
            })
          }
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">New start date</label>
              <input
                name="new_start_date"
                type="date"
                required
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                min={new Date(Date.now() + CUTOFF_HOURS * 3600 * 1000).toISOString().split("T")[0]}
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                New end date (if multi-day)
              </label>
              <input
                name="new_end_date"
                type="date"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
                min={newStart || undefined}
                className="input"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? "Updating..." : "Submit change"}
            </button>
            <button
              type="button"
              onClick={() => setModifying(false)}
              className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  // === CANCEL MODAL ===
  if (cancelling) {
    return (
      <div className="card border-red-200 bg-red-50">
        <h2 className="font-bold text-red-900 mb-2 flex items-center gap-2">
          <X className="h-4 w-4" /> Cancel this booking
        </h2>
        <p className="text-xs text-slate-700 mb-3">
          {bookingStatus === "confirmed" || bookingStatus === "pending_payment"
            ? "We'll cancel your booking. If you already paid, our team will process the refund within 1-2 business days."
            : "We'll cancel your booking."}
        </p>
        <form
          action={(fd) =>
            startTransition(async () => {
              const r = await cancelBookingByCustomer(bookingId, fd);
              if (r.error) {
                toast.error(r.error);
                return;
              }
              toast.success("Booking cancelled");
              setCancelling(false);
              router.refresh();
            })
          }
          className="space-y-3"
        >
          <div>
            <label className="block text-xs text-slate-600 mb-1">
              Reason (optional, helps us improve)
            </label>
            <textarea
              name="reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Change of plans, weather, etc."
              className="input"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="bg-red-600 text-white font-semibold rounded-md px-4 py-2 hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? "Cancelling..." : "Confirm cancellation"}
            </button>
            <button
              type="button"
              onClick={() => setCancelling(false)}
              className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
            >
              Keep booking
            </button>
          </div>
        </form>
      </div>
    );
  }

  // === DEFAULT: 3 action buttons ===
  return (
    <div className="card">
      <h2 className="font-bold text-brand-navy mb-1">Manage your booking</h2>
      <p className="text-xs text-slate-500 mb-3 flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {Math.floor(hours)}h until event · changes available up to {CUTOFF_HOURS}h before
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          onClick={() =>
            startTransition(async () => {
              const r = await confirmBookingByCustomer(bookingId);
              if (r.error) {
                toast.error(r.error);
                return;
              }
              toast.success(
                r.alreadyConfirmed
                  ? "Already confirmed — thanks!"
                  : "Details confirmed ✓",
              );
              router.refresh();
            })
          }
          disabled={pending}
          className="inline-flex flex-col items-center gap-1 border-2 border-green-500 text-green-700 hover:bg-green-50 rounded-md py-3 px-3 font-semibold text-sm disabled:opacity-50"
        >
          <CheckCircle2 className="h-5 w-5" />
          {customerConfirmedAt ? "Re-confirm" : "Confirm details"}
        </button>

        <button
          onClick={() => setModifying(true)}
          disabled={pending}
          className="inline-flex flex-col items-center gap-1 border-2 border-blue-500 text-blue-700 hover:bg-blue-50 rounded-md py-3 px-3 font-semibold text-sm disabled:opacity-50"
        >
          <Calendar className="h-5 w-5" />
          Change date
        </button>

        <button
          onClick={() => setCancelling(true)}
          disabled={pending}
          className="inline-flex flex-col items-center gap-1 border-2 border-red-500 text-red-700 hover:bg-red-50 rounded-md py-3 px-3 font-semibold text-sm disabled:opacity-50"
        >
          <X className="h-5 w-5" />
          Cancel
        </button>
      </div>

      {customerConfirmedAt && (
        <p className="text-xs text-green-700 mt-3 text-center">
          ✓ You confirmed details on {new Date(customerConfirmedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
