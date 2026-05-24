"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { approveQuote, declineQuote, markQuoteConverted } from "./actions";

interface Quote {
  id: string;
  quote_number: string;
  token: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_company: string | null;
  customer_email: string;
  customer_phone: string;
  customer_address: string | null;
  event_date: string;
  event_end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  line_items: any[];
  subtotal_cents: number;
  discount_cents: number;
  discount_note: string | null;
  tax_cents: number;
  total_cents: number;
  customer_message: string | null;
  status: string;
  approved_at: string | null;
  declined_at: string | null;
  expires_at: string | null;
}

export function QuoteCustomerView({
  quote,
  clientSecret,
  stripeConfigured,
  stripePublishableKey,
}: {
  quote: Quote;
  clientSecret: string | null;
  stripeConfigured: boolean;
  stripePublishableKey: string;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-brand-navy text-white py-6">
        <div className="max-w-3xl mx-auto px-4 flex justify-between items-center">
          <div>
            <div className="text-xs text-brand-yellow tracking-widest font-bold">
              IT'S ALWAYS FUN, LLC
            </div>
            <h1 className="text-2xl font-bold">Quote {quote.quote_number}</h1>
          </div>
          <StatusBadge status={quote.status} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <QuoteDetails quote={quote} />

        {(quote.status === "sent" || quote.status === "viewed") && (
          <ApproveDecline token={quote.token} />
        )}

        {quote.status === "approved" && (
          <PaymentSection
            quote={quote}
            clientSecret={clientSecret}
            stripeConfigured={stripeConfigured}
            stripePublishableKey={stripePublishableKey}
          />
        )}

        {quote.status === "converted" && (
          <SuccessSection quote={quote} />
        )}

        {quote.status === "declined" && (
          <div className="card border-red-200 bg-red-50">
            <div className="flex items-start gap-3">
              <XCircle className="h-6 w-6 text-red-600 mt-0.5" />
              <div>
                <h2 className="font-semibold text-red-900 mb-1">Quote declined</h2>
                <p className="text-sm text-red-800">
                  You declined this quote on{" "}
                  {quote.declined_at && new Date(quote.declined_at).toLocaleDateString()}.
                  Need to talk? Call us at <strong>(904) 584-3047</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        {quote.status === "expired" && (
          <div className="card border-amber-200 bg-amber-50">
            <div className="flex items-start gap-3">
              <Clock className="h-6 w-6 text-amber-600 mt-0.5" />
              <div>
                <h2 className="font-semibold text-amber-900 mb-1">Quote expired</h2>
                <p className="text-sm text-amber-800">
                  This quote is no longer valid. Contact us at{" "}
                  <strong>(904) 584-3047</strong> and we'll send you a new one.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    sent: { label: "Awaiting your approval", cls: "bg-blue-100 text-blue-800" },
    viewed: { label: "Awaiting your approval", cls: "bg-blue-100 text-blue-800" },
    approved: { label: "Approved — pay below", cls: "bg-green-100 text-green-800" },
    converted: { label: "Paid ✓", cls: "bg-purple-100 text-purple-800" },
    declined: { label: "Declined", cls: "bg-red-100 text-red-800" },
    expired: { label: "Expired", cls: "bg-amber-100 text-amber-800" },
    draft: { label: "Draft", cls: "bg-slate-200 text-slate-700" },
  };
  const e = map[status] || map.sent;
  return (
    <span className={`text-xs font-semibold rounded-full px-3 py-1 ${e.cls}`}>
      {e.label}
    </span>
  );
}

function QuoteDetails({ quote }: { quote: Quote }) {
  const items = quote.line_items || [];
  return (
    <>
      {quote.customer_message && (
        <div className="card bg-brand-yellow/10 border-brand-yellow/30">
          <p className="text-sm text-slate-800 whitespace-pre-wrap italic">
            "{quote.customer_message}"
          </p>
        </div>
      )}

      <div className="card">
        <h2 className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-3">
          Prepared for
        </h2>
        <div className="text-sm">
          <div className="font-semibold text-base">
            {quote.customer_first_name} {quote.customer_last_name}
          </div>
          {quote.customer_company && (
            <div className="text-slate-600 italic">{quote.customer_company}</div>
          )}
          <div className="text-slate-600">{quote.customer_email}</div>
          <div className="text-slate-600">{quote.customer_phone}</div>
          {quote.customer_address && (
            <div className="text-slate-600 mt-1">{quote.customer_address}</div>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-3 flex items-center gap-1">
          <Calendar className="h-3 w-3" /> Event
        </h2>
        <div className="text-sm">
          <div className="font-semibold">
            {new Date(quote.event_date + "T00:00:00").toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            {quote.event_end_date && quote.event_end_date !== quote.event_date && (
              <>
                {" "}
                →{" "}
                {new Date(quote.event_end_date + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </>
            )}
          </div>
          {(quote.start_time || quote.end_time) && (
            <div className="text-slate-600">
              {quote.start_time} – {quote.end_time}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-3">
          Quote
        </h2>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left py-2">Item</th>
              <th className="text-center py-2 w-16">Qty</th>
              <th className="text-right py-2 w-24">Unit</th>
              <th className="text-right py-2 w-28">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((it: any, i: number) => (
              <tr key={i}>
                <td className="py-2">{it.name}</td>
                <td className="py-2 text-center font-mono">{it.quantity}</td>
                <td className="py-2 text-right font-mono">
                  {formatCurrency(it.unit_price_cents)}
                </td>
                <td className="py-2 text-right font-mono">
                  {formatCurrency(
                    it.line_total_cents || it.unit_price_cents * it.quantity,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="text-sm">
            <tr>
              <td colSpan={3} className="text-right py-1 text-slate-600">
                Subtotal
              </td>
              <td className="text-right font-mono py-1">
                {formatCurrency(quote.subtotal_cents)}
              </td>
            </tr>
            {quote.discount_cents > 0 && (
              <tr>
                <td colSpan={3} className="text-right py-1 text-slate-600">
                  Discount {quote.discount_note && `(${quote.discount_note})`}
                </td>
                <td className="text-right font-mono py-1 text-amber-700">
                  -{formatCurrency(quote.discount_cents)}
                </td>
              </tr>
            )}
            {quote.tax_cents > 0 && (
              <tr>
                <td colSpan={3} className="text-right py-1 text-slate-600">
                  Tax
                </td>
                <td className="text-right font-mono py-1">
                  {formatCurrency(quote.tax_cents)}
                </td>
              </tr>
            )}
            <tr className="border-t">
              <td colSpan={3} className="text-right pt-3 font-semibold text-lg">
                Total
              </td>
              <td className="text-right font-mono pt-3 font-bold text-brand-navy text-xl">
                {formatCurrency(quote.total_cents)}
              </td>
            </tr>
          </tfoot>
        </table>

        {quote.expires_at && quote.status !== "converted" && quote.status !== "declined" && (
          <p className="text-xs text-slate-500 mt-4 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Valid until {new Date(quote.expires_at).toLocaleDateString()}
          </p>
        )}
      </div>
    </>
  );
}

function ApproveDecline({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showDecline, setShowDecline] = useState(false);
  const [reason, setReason] = useState("");

  function handleApprove() {
    if (!confirm("Approve this quote and proceed to payment?")) return;
    startTransition(async () => {
      const r = await approveQuote(token);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Approved! Now complete payment below.");
      router.refresh();
    });
  }

  function handleDecline() {
    startTransition(async () => {
      const r = await declineQuote(token, reason);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Quote declined");
      router.refresh();
    });
  }

  if (showDecline) {
    return (
      <div className="card">
        <h2 className="font-semibold text-brand-navy mb-2">Decline quote</h2>
        <p className="text-sm text-slate-600 mb-3">
          Want to share why? (optional, helps us improve)
        </p>
        <textarea
          rows={3}
          className="input mb-3"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Too expensive, going with another vendor, change of plans..."
        />
        <div className="flex gap-2">
          <button
            onClick={handleDecline}
            disabled={pending}
            className="bg-red-600 text-white font-semibold rounded-md px-4 py-2 hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? "Declining..." : "Confirm decline"}
          </button>
          <button
            onClick={() => setShowDecline(false)}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card sticky bottom-4 shadow-lg border-2 border-brand-yellow">
      <h2 className="text-lg font-bold text-brand-navy mb-3">Ready to book?</h2>
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={handleApprove}
          disabled={pending}
          className="flex-1 bg-brand-navy text-white font-bold py-3 px-6 rounded-md hover:bg-brand-navy-dark transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="h-5 w-5" />
          {pending ? "Approving..." : "Approve & pay"}
        </button>
        <button
          onClick={() => setShowDecline(true)}
          className="sm:w-auto inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-3 text-slate-700 hover:bg-slate-50"
        >
          Decline
        </button>
      </div>
      <p className="text-xs text-slate-500 mt-2 text-center">
        Questions? Call <strong>(904) 584-3047</strong> before approving.
      </p>
    </div>
  );
}

function PaymentSection({
  quote,
  clientSecret,
  stripeConfigured,
  stripePublishableKey,
}: {
  quote: Quote;
  clientSecret: string | null;
  stripeConfigured: boolean;
  stripePublishableKey: string;
}) {
  if (!stripeConfigured || !clientSecret) {
    return (
      <div className="card border-amber-200 bg-amber-50">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-amber-600 mt-0.5" />
          <div>
            <h2 className="font-semibold text-amber-900 mb-1">
              Quote approved — payment by phone
            </h2>
            <p className="text-sm text-amber-800">
              Online payments aren't set up yet. We've received your approval and
              will call you at <strong>{quote.customer_phone}</strong> shortly to
              process payment. Prefer to call us first?{" "}
              <strong>(904) 584-3047</strong>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const stripePromise = loadStripe(stripePublishableKey);

  return (
    <div className="card border-brand-yellow border-2">
      <h2 className="text-lg font-bold text-brand-navy mb-1">Complete payment</h2>
      <p className="text-sm text-slate-500 mb-4 flex items-center gap-1">
        <Lock className="h-3.5 w-3.5" /> Secure payment via Stripe · 100% upfront
      </p>
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
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
        <PaymentForm token={quote.token} amount={quote.total_cents} />
      </Elements>
    </div>
  );
}

function PaymentForm({ token, amount }: { token: string; amount: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setPending(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/quotes/${token}?paid=1`,
      },
      redirect: "if_required",
    });

    if (error) {
      setPending(false);
      toast.error(error.message || "Payment failed");
      return;
    }

    // No redirect → payment succeeded
    await markQuoteConverted(token);
    toast.success("Payment successful!");
    router.refresh();
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
        {pending ? "Processing..." : `Pay ${formatCurrency(amount)} & confirm`}
      </button>
    </form>
  );
}

function SuccessSection({ quote }: { quote: Quote }) {
  return (
    <div className="card border-green-200 bg-green-50">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-8 w-8 text-green-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h2 className="font-bold text-green-900 text-lg mb-1">
            Booking confirmed! 🎉
          </h2>
          <p className="text-sm text-green-800 mb-3">
            Thank you, {quote.customer_first_name}. Your payment of{" "}
            <strong>{formatCurrency(quote.total_cents)}</strong> has been received
            for your event on{" "}
            <strong>
              {new Date(quote.event_date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </strong>
            .
          </p>
          <p className="text-sm text-green-800">
            We'll send a confirmation email with the receipt and contact you 1-2
            days before to confirm delivery details. Questions? Call{" "}
            <strong>(904) 584-3047</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
