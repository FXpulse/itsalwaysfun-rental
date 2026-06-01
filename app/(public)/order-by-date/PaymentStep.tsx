"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { toast } from "sonner";
import { Lock, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/types/database";

interface BookingResult {
  booking_id: string;
  client_secret: string | null;
  amount: number;
  subtotal?: number;
  discount?: number;
  coupon_code?: string | null;
  product_name: string;
}

interface PaymentStepProps {
  bookingResult: BookingResult;
  selectedProduct: Product;
  eventDate: string;
  eventEndDate: string;
  startTime: string;
  endTime: string;
  numDays: number;
  productTotal: number;
  powerSupplyCost: number;
  addonsTotal: number;
  protectionCost: number;
  taxAmount: number;
  stripeConfigured: boolean;
  stripePublishableKey: string;
  onComplete: () => void;
}

export function PaymentStep(props: PaymentStepProps) {
  const { bookingResult, stripeConfigured, stripePublishableKey, onComplete } = props;

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

        <BookingSummary {...props} />

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

      <BookingSummary {...props} />

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
  bookingResult,
  selectedProduct,
  eventDate,
  eventEndDate,
  startTime,
  endTime,
  numDays,
  productTotal,
  powerSupplyCost,
  addonsTotal,
  protectionCost,
  taxAmount,
}: PaymentStepProps) {
  const subtotalAfterDiscount = bookingResult.subtotal ?? (productTotal + powerSupplyCost + addonsTotal + protectionCost);
  const discount = bookingResult.discount || 0;
  const total = bookingResult.amount;

  const sameDay = eventDate === eventEndDate;
  const dateLabel = sameDay
    ? format(new Date(eventDate + "T00:00:00"), "EEE, MMM d, yyyy")
    : `${format(new Date(eventDate + "T00:00:00"), "MMM d")} – ${format(new Date(eventEndDate + "T00:00:00"), "MMM d, yyyy")}`;

  const pricePerDay = selectedProduct.price_per_day;

  return (
    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
      <h3 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-3">
        Order summary
      </h3>

      {/* Date + time */}
      <div className="bg-white border border-slate-200 rounded p-3 mb-3 text-xs">
        <div className="flex justify-between mb-1">
          <span className="text-slate-500">📅 Date{numDays > 1 ? "s" : ""}</span>
          <span className="font-semibold text-brand-navy">{dateLabel}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">⏰ Hours</span>
          <span className="font-semibold text-brand-navy">{startTime} – {endTime}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-slate-500">🗓 Days</span>
          <span className="font-semibold text-brand-navy">{numDays} day{numDays === 1 ? "" : "s"}</span>
        </div>
      </div>

      {/* Line items */}
      <dl className="space-y-1.5 text-sm">
        {/* Product base */}
        <div className="flex justify-between">
          <dt className="text-slate-700">
            <span className="font-medium">{selectedProduct.name}</span>
            <div className="text-[11px] text-slate-500">
              {numDays === 1
                ? `1 day × ${formatCurrency(pricePerDay)}`
                : `${formatCurrency(pricePerDay)} day 1 + ${numDays - 1} extra day${numDays > 2 ? "s" : ""} × 30%`}
            </div>
          </dt>
          <dd className="font-mono text-slate-800">{formatCurrency(productTotal)}</dd>
        </div>

        {/* Power supply */}
        {powerSupplyCost > 0 && (
          <div className="flex justify-between text-xs">
            <dt className="text-slate-600">⚡ Power supply / generator</dt>
            <dd className="font-mono text-slate-700">{formatCurrency(powerSupplyCost)}</dd>
          </div>
        )}

        {/* Add-ons */}
        {addonsTotal > 0 && (
          <div className="flex justify-between text-xs">
            <dt className="text-slate-600">➕ Add-ons</dt>
            <dd className="font-mono text-slate-700">{formatCurrency(addonsTotal)}</dd>
          </div>
        )}

        {/* Damage protection */}
        {protectionCost > 0 && (
          <div className="flex justify-between text-xs">
            <dt className="text-slate-600">🛡 Damage protection</dt>
            <dd className="font-mono text-slate-700">{formatCurrency(protectionCost)}</dd>
          </div>
        )}

        {/* Subtotal pre-discount (if discount applied) */}
        {discount > 0 && (
          <div className="flex justify-between text-xs pt-1.5 border-t border-slate-200">
            <dt className="text-slate-600">Subtotal</dt>
            <dd className="font-mono text-slate-700">
              {formatCurrency(productTotal + powerSupplyCost + addonsTotal + protectionCost)}
            </dd>
          </div>
        )}

        {/* Discount */}
        {discount > 0 && (
          <div className="flex justify-between text-xs text-emerald-700">
            <dt>
              🎟 Discount{bookingResult.coupon_code && <span className="font-mono"> ({bookingResult.coupon_code})</span>}
            </dt>
            <dd className="font-mono font-semibold">−{formatCurrency(discount)}</dd>
          </div>
        )}

        {/* Tax */}
        {taxAmount > 0 && (
          <div className="flex justify-between text-xs pt-1.5 border-t border-slate-200">
            <dt className="text-slate-600">Tax</dt>
            <dd className="font-mono text-slate-700">{formatCurrency(taxAmount)}</dd>
          </div>
        )}
      </dl>

      {/* Total */}
      <div className="border-t-2 border-slate-300 mt-3 pt-3 flex justify-between font-bold text-lg text-brand-navy">
        <dt>Total</dt>
        <dd className="font-mono">{formatCurrency(total)}</dd>
      </div>

      <p className="text-[10px] text-slate-400 mt-2 text-center">
        Charged once at checkout. No hidden fees.
      </p>
    </div>
  );
}
