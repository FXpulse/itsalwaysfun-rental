"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { toast } from "sonner";
import { Lock, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/types/database";

interface BookingResult {
  booking_id: string;
  client_secret: string | null;
  amount: number;
  product_name: string;
}

export function PaymentStep({
  bookingResult,
  selectedProduct,
  eventDate,
  startTime,
  stripeConfigured,
  stripePublishableKey,
  onComplete,
}: {
  bookingResult: BookingResult;
  selectedProduct: Product;
  eventDate: string;
  startTime: string;
  stripeConfigured: boolean;
  stripePublishableKey: string;
  onComplete: () => void;
}) {
  // If Stripe not configured, show manual-confirmation message
  if (!stripeConfigured || !bookingResult.client_secret) {
    return (
      <div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-900 mb-1">
              Booking request received — payment by phone
            </h3>
            <p className="text-sm text-amber-800">
              Online payments are not configured yet on this site. We've saved your
              booking request and will contact you within 24 hours to confirm
              availability and process payment.
            </p>
          </div>
        </div>

        <BookingSummary product={selectedProduct} eventDate={eventDate} startTime={startTime} amount={bookingResult.amount} />

        <p className="text-sm text-slate-600 mt-4">
          A representative will call you at the phone number you provided to
          collect payment (cash, Venmo, or credit card by phone). Your booking
          is reserved for 15 minutes — if you'd rather confirm right now, call
          us at <strong>(904) 584-3047</strong>.
        </p>

        <div className="flex justify-end mt-6">
          <button onClick={onComplete} className="btn-primary">
            Got it — see confirmation
          </button>
        </div>
      </div>
    );
  }

  // Stripe flow
  const stripePromise = loadStripe(stripePublishableKey);

  return (
    <div>
      <h2 className="text-xl font-bold text-brand-navy mb-1">Payment</h2>
      <p className="text-sm text-slate-500 mb-6 flex items-center gap-1">
        <Lock className="h-3.5 w-3.5" /> Secure payment · 100% upfront · powered by Stripe
      </p>

      <BookingSummary product={selectedProduct} eventDate={eventDate} startTime={startTime} amount={bookingResult.amount} />

      <div className="mt-6">
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret: bookingResult.client_secret,
            appearance: {
              theme: "stripe",
              variables: {
                colorPrimary: "#1a1a6e",
                colorBackground: "#ffffff",
                colorText: "#0f172a",
                colorDanger: "#dc2626",
                fontFamily: "system-ui, sans-serif",
                borderRadius: "6px",
              },
            },
          }}
        >
          <CheckoutForm amount={bookingResult.amount} onComplete={onComplete} />
        </Elements>
      </div>
    </div>
  );
}

function CheckoutForm({
  amount,
  onComplete,
}: {
  amount: number;
  onComplete: () => void;
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
      confirmParams: {
        return_url: `${window.location.origin}/order-by-date?confirmed=1`,
      },
      redirect: "if_required",
    });

    setPending(false);

    if (error) {
      toast.error(error.message || "Payment failed");
      return;
    }

    // No redirect → payment succeeded (or 3DS done)
    toast.success("Payment successful!");
    onComplete();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || pending}
        className="w-full bg-brand-navy text-white font-bold py-3 rounded-md hover:bg-brand-navy-dark transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
      >
        <Lock className="h-4 w-4" />
        {pending ? "Processing..." : `Pay & Confirm Rental — ${formatCurrency(amount)}`}
      </button>
      <p className="text-xs text-center text-slate-500">
        Your card will be charged immediately. No deposit. 100% upfront.
      </p>
    </form>
  );
}

function BookingSummary({
  product,
  eventDate,
  startTime,
  amount,
}: {
  product: Product;
  eventDate: string;
  startTime: string;
  amount: number;
}) {
  return (
    <div className="bg-slate-50 rounded-lg p-4">
      <h3 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-3">
        Order summary
      </h3>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-600">{product.name} rental</dt>
          <dd>{formatCurrency(amount)}</dd>
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          <dt>{format(new Date(eventDate), "EEE, MMM d, yyyy")} · {startTime}</dt>
          <dd></dd>
        </div>
      </dl>
      <div className="border-t border-slate-200 mt-3 pt-3 flex justify-between font-bold text-brand-navy">
        <dt>Total</dt>
        <dd>{formatCurrency(amount)}</dd>
      </div>
    </div>
  );
}
