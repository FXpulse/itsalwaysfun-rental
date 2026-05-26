"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Plus, Calendar, Lock, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Props {
  bookingId: string;
  currentEndDate: string;        // YYYY-MM-DD (current event_end_date or event_date)
  eventDate: string;
  startTime: string | null;
  bookingStatus: string;         // confirmed / delivered / etc.
  paymentStatus: string;         // paid / pending / etc.
  stripeConfigured: boolean;
  stripePublishableKey: string;
}

const MIN_LEAD_HOURS = 6;

function hoursUntilEvent(eventDate: string, startTime: string | null): number {
  const time = startTime || "09:00:00";
  return (new Date(`${eventDate}T${time}`).getTime() - Date.now()) / (1000 * 60 * 60);
}

export function ExtendRentalPanel({
  bookingId,
  currentEndDate,
  eventDate,
  startTime,
  bookingStatus,
  paymentStatus,
  stripeConfigured,
  stripePublishableKey,
}: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [newEndDate, setNewEndDate] = useState("");
  const [pending, setPending] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amountCents, setAmountCents] = useState(0);
  const [addedDays, setAddedDays] = useState(0);

  const hoursLeft = hoursUntilEvent(eventDate, startTime);

  // Hide when not applicable
  if (bookingStatus === "cancelled") return null;
  if (bookingStatus === "completed") return null;
  if (paymentStatus !== "paid") return null;
  if (hoursLeft < MIN_LEAD_HOURS) return null;  // too close — must call

  // Minimum new end date = day after current end
  const minDate = (() => {
    const d = new Date(currentEndDate + "T00:00:00");
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  })();

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!newEndDate || newEndDate <= currentEndDate) {
      toast.error("Pick a date AFTER your current end date");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/bookings/extend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, new_end_date: newEndDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not extend");
        setPending(false);
        return;
      }
      setClientSecret(data.client_secret);
      setAmountCents(data.additional_amount_cents);
      setAddedDays(data.additional_days);
    } catch (err: any) {
      toast.error(err.message || "Network error");
    } finally {
      setPending(false);
    }
  }

  function reset() {
    setExpanded(false);
    setClientSecret(null);
    setNewEndDate("");
    setAmountCents(0);
    setAddedDays(0);
  }

  // Collapsed CTA
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="card w-full text-left border border-amber-200 hover:border-amber-400 hover:bg-amber-50/50 transition"
      >
        <div className="flex items-start gap-3">
          <Plus className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-brand-navy text-sm">
              Need more time? Extend your rental
            </h3>
            <p className="text-xs text-slate-600">
              Add days to your booking — same equipment stays with you longer.
              Pay only for the extra days (30% surcharge per added day).
            </p>
          </div>
        </div>
      </button>
    );
  }

  // Payment step (after price is calculated)
  if (clientSecret) {
    const stripePromise = loadStripe(stripePublishableKey);
    return (
      <div className="card border-2 border-amber-300 bg-amber-50/30">
        <button
          type="button"
          onClick={reset}
          className="text-xs text-slate-500 hover:text-brand-navy mb-3 inline-flex items-center gap-1"
        >
          <X className="h-3 w-3" /> Cancel extension
        </button>
        <h2 className="font-bold text-brand-navy mb-1">
          Pay {formatCurrency(amountCents)} to extend
        </h2>
        <p className="text-xs text-slate-500 mb-3 inline-flex items-center gap-1">
          <Lock className="h-3 w-3" /> +{addedDays} day{addedDays > 1 ? "s" : ""} until {newEndDate} · Stripe secure payment
        </p>
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: "stripe",
              variables: { colorPrimary: "#1a1a6e" },
            },
          }}
        >
          <ExtensionCheckoutForm
            amount={amountCents}
            onSuccess={() => {
              toast.success(`Extended! New end date: ${newEndDate}`);
              reset();
              router.refresh();
            }}
          />
        </Elements>
      </div>
    );
  }

  // Date picker step
  return (
    <form
      onSubmit={handleRequest}
      className="card border-2 border-amber-300 bg-amber-50/30"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-brand-navy flex items-center gap-2">
          <Calendar className="h-5 w-5 text-amber-700" /> Extend rental
        </h2>
        <button type="button" onClick={reset} className="text-slate-400 hover:text-slate-700">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-slate-600 mb-3">
        Your rental currently ends on{" "}
        <strong>{new Date(currentEndDate + "T00:00:00").toLocaleDateString()}</strong>.
        Pick a new end date — must be at least 1 day later, max 14 days total rental.
      </p>
      <div className="mb-3">
        <label className="block text-xs text-slate-600 mb-1">New end date</label>
        <input
          type="date"
          value={newEndDate}
          onChange={(e) => setNewEndDate(e.target.value)}
          min={minDate}
          required
          className="input"
        />
      </div>
      {!stripeConfigured && (
        <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-800 mb-3">
          Online payments not configured — please call us to extend.
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || !newEndDate || !stripeConfigured}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {pending ? "Checking availability..." : "Check price"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
      <p className="text-[10px] text-slate-500 mt-2">
        💡 Pricing: each added day = 30% of the day rate (with weekend rate honored).
      </p>
    </form>
  );
}

function ExtensionCheckoutForm({
  amount,
  onSuccess,
}: {
  amount: number;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPending(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/portal/bookings` },
      redirect: "if_required",
    });
    setPending(false);
    if (error) {
      toast.error(error.message || "Payment failed");
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mt-2">
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || pending}
        className="w-full bg-brand-navy text-white font-bold py-2.5 rounded-md hover:bg-brand-navy-dark transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
      >
        <Lock className="h-4 w-4" />
        {pending ? "Processing..." : `Pay ${formatCurrency(amount)} & extend`}
      </button>
    </form>
  );
}
