"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CloudRain, Gift } from "lucide-react";
import { cancelBookingDueToWeather } from "./actions";

interface Props {
  bookingId: string;
  eventDate: string;
  startTime: string | null;
  bookingStatus: string;
  paidAmount: number;          // total_amount cents
  paymentStatus: string;       // "paid" | "pending" | ...
  cutoffHours: number;         // from site_settings.weather_cancellation_cutoff_hours
  policyText: string;
}

function hoursUntilEvent(eventDate: string, startTime: string | null): number {
  const time = startTime || "09:00:00";
  return (new Date(`${eventDate}T${time}`).getTime() - Date.now()) / (1000 * 60 * 60);
}

export function WeatherCancelPanel({
  bookingId,
  eventDate,
  startTime,
  bookingStatus,
  paidAmount,
  paymentStatus,
  cutoffHours,
  policyText,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const hours = hoursUntilEvent(eventDate, startTime);

  // Hidden: already cancelled, past event, or inside cutoff window
  if (bookingStatus === "cancelled") return null;
  if (hours <= 0) return null;
  if (hours < cutoffHours) return null;

  const paidDollars = (paidAmount / 100).toFixed(2);
  const isPaid = paymentStatus === "paid";

  if (confirming) {
    return (
      <div className="card border-2 border-blue-300 bg-blue-50/50">
        <h2 className="font-bold text-brand-navy mb-2 flex items-center gap-2">
          <CloudRain className="h-5 w-5 text-blue-700" /> Cancel due to weather
        </h2>
        <div className="bg-white border border-slate-200 rounded p-3 mb-3 text-xs whitespace-pre-line text-slate-700">
          {policyText}
        </div>
        {isPaid && paidAmount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-3 flex items-start gap-2">
            <Gift className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              You'll receive a <strong>${paidDollars} gift card credit</strong>{" "}
              valid for 1 year, applied at checkout when you rebook. Email arrives
              within a minute of confirming.
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await cancelBookingDueToWeather(bookingId);
                if (r.error) {
                  toast.error(r.error);
                  return;
                }
                if (r.credited) {
                  toast.success(`Cancelled — gift card ${r.code} emailed`);
                } else {
                  toast.success("Cancelled");
                }
                setConfirming(false);
                router.refresh();
              })
            }
            className="bg-blue-700 text-white font-semibold rounded-md px-4 py-2 hover:bg-blue-800 disabled:opacity-50"
          >
            {pending ? "Cancelling..." : "Yes, cancel + issue credit"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
          >
            Keep booking
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="card w-full text-left border border-blue-200 hover:border-blue-400 hover:bg-blue-50/50 transition"
    >
      <div className="flex items-start gap-3">
        <CloudRain className="h-5 w-5 text-blue-700 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-brand-navy text-sm">
            Bad weather forecast? Cancel for a credit
          </h3>
          <p className="text-xs text-slate-600">
            Up to <strong>{cutoffHours}h</strong> before your event you can
            self-cancel for unsafe weather. We'll issue a gift card credit
            {isPaid && paidAmount > 0 && <> for the full <strong>${paidDollars}</strong></>}{" "}
            you can use to rebook.
          </p>
        </div>
      </div>
    </button>
  );
}
