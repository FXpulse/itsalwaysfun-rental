"use client";

import { useState } from "react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { toast } from "sonner";
import {
  Lock,
  AlertCircle,
  CheckCircle2,
  Mail,
  User as UserIcon,
  Gift,
  MessageSquare,
  Phone,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const PRESET_AMOUNTS = [25, 50, 100, 200, 500];

interface PurchaseDraft {
  amount_cents: number;
  purchaser_name: string;
  purchaser_email: string;
  recipient_name: string;
  recipient_email: string;
  recipient_phone: string;
  message: string;
}

export function GiftCardPurchase({
  stripeConfigured,
  stripePublishableKey,
}: {
  stripeConfigured: boolean;
  stripePublishableKey: string;
}) {
  const [step, setStep] = useState<"details" | "pay" | "done">("details");
  const [draft, setDraft] = useState<PurchaseDraft>({
    amount_cents: 5000,
    purchaser_name: "",
    purchaser_email: "",
    recipient_name: "",
    recipient_email: "",
    recipient_phone: "",
    message: "",
  });
  const [customAmount, setCustomAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [successAmount, setSuccessAmount] = useState(0);

  function setPreset(dollars: number) {
    setDraft({ ...draft, amount_cents: dollars * 100 });
    setCustomAmount("");
  }

  function setCustom(value: string) {
    setCustomAmount(value);
    const n = parseFloat(value);
    if (!Number.isNaN(n) && n >= 10 && n <= 10000) {
      setDraft({ ...draft, amount_cents: Math.round(n * 100) });
    }
  }

  async function handleSubmitDetails(e: React.FormEvent) {
    e.preventDefault();
    if (draft.amount_cents < 1000) {
      toast.error("Minimum gift card amount is $10");
      return;
    }
    if (draft.amount_cents > 1_000_000) {
      toast.error("Maximum gift card amount is $10,000");
      return;
    }

    if (!stripeConfigured) {
      toast.error("Online payments not available right now — please call to purchase.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/gift-cards/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_cents: draft.amount_cents,
          purchaser_name: draft.purchaser_name.trim(),
          purchaser_email: draft.purchaser_email.trim().toLowerCase(),
          recipient_name: draft.recipient_name.trim() || null,
          recipient_email: draft.recipient_email.trim().toLowerCase(),
          recipient_phone: draft.recipient_phone.trim() || null,
          message: draft.message.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not start checkout");
        setPending(false);
        return;
      }
      setClientSecret(data.client_secret);
      setSuccessAmount(data.amount_cents);
      setStep("pay");
    } catch (err: any) {
      toast.error(err.message || "Network error");
    } finally {
      setPending(false);
    }
  }

  if (step === "done") {
    return (
      <div className="bg-white border border-green-200 rounded-lg p-8 text-center">
        <CheckCircle2 className="h-14 w-14 text-green-600 mx-auto mb-3" />
        <h2 className="text-2xl font-bold text-brand-navy mb-2">Gift card sent!</h2>
        <p className="text-slate-600 mb-4">
          We charged <strong>{formatCurrency(successAmount)}</strong> and emailed
          the gift card code to <strong>{draft.recipient_email}</strong>. A receipt
          went to <strong>{draft.purchaser_email}</strong>.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2 max-w-md mx-auto text-left">
          <div className="flex items-start gap-2">
            <span className="text-lg flex-shrink-0">📬</span>
            <p className="text-xs text-amber-900">
              <strong>Don't see the email in a minute?</strong> Check the{" "}
              <strong>spam / junk folder</strong> — it may land there the first
              time. Mark it "not spam" so future emails arrive properly.
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setStep("details");
              setDraft({
                amount_cents: 5000,
                purchaser_name: draft.purchaser_name,
                purchaser_email: draft.purchaser_email,
                recipient_name: "",
                recipient_email: "",
                recipient_phone: "",
                message: "",
              });
              setClientSecret(null);
              setCustomAmount("");
            }}
            className="inline-flex items-center gap-2 bg-brand-navy text-white font-semibold px-4 py-2 rounded hover:bg-brand-navy-dark"
          >
            Send another gift card
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-2 border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded hover:bg-slate-50"
          >
            Back to home
          </a>
        </div>
      </div>
    );
  }

  if (step === "pay" && clientSecret) {
    const stripePromise = loadStripe(stripePublishableKey);
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <button
          type="button"
          onClick={() => setStep("details")}
          className="text-xs text-slate-500 hover:text-brand-navy mb-3"
        >
          ← Edit details
        </button>
        <h2 className="text-xl font-bold text-brand-navy mb-1">
          Pay {formatCurrency(draft.amount_cents)}
        </h2>
        <p className="text-sm text-slate-500 mb-4 flex items-center gap-1">
          <Lock className="h-3.5 w-3.5" /> Secure payment · powered by Stripe
        </p>

        <Summary draft={draft} />

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
          <CheckoutForm
            amount={draft.amount_cents}
            onSuccess={() => setStep("done")}
          />
        </Elements>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmitDetails}
      className="bg-white border border-slate-200 rounded-lg p-6 space-y-6"
    >
      {!stripeConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 flex items-start gap-2 text-sm text-amber-900">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            Online checkout isn't configured yet. Call <strong>(904) 584-3047</strong>
            {" "}to purchase a gift card by phone.
          </span>
        </div>
      )}

      {/* Amount */}
      <div>
        <label className="block text-sm font-semibold text-brand-navy mb-2">
          Amount
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {PRESET_AMOUNTS.map((d) => (
            <button
              type="button"
              key={d}
              onClick={() => setPreset(d)}
              className={`px-4 py-2 rounded-md font-bold transition border ${
                !customAmount && draft.amount_cents === d * 100
                  ? "bg-brand-navy text-white border-brand-navy"
                  : "bg-white text-brand-navy border-slate-300 hover:border-brand-navy"
              }`}
            >
              ${d}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="text-xs text-slate-500">Or enter a custom amount ($10–$10,000)</span>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">$</span>
            <input
              type="number"
              min={10}
              max={10000}
              step="1"
              value={customAmount}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Custom"
              className="input pl-7"
            />
          </div>
        </label>
      </div>

      {/* Recipient */}
      <div className="border-t pt-5">
        <h3 className="text-sm font-semibold text-brand-navy mb-3 flex items-center gap-2">
          <Gift className="h-4 w-4" /> Who's it for?
        </h3>
        <div className="grid md:grid-cols-2 gap-3">
          <Field
            label="Recipient name (optional)"
            icon={<UserIcon className="h-4 w-4" />}
            value={draft.recipient_name}
            onChange={(v) => setDraft({ ...draft, recipient_name: v })}
            placeholder="Their first name"
          />
          <Field
            label="Recipient email *"
            icon={<Mail className="h-4 w-4" />}
            type="email"
            required
            value={draft.recipient_email}
            onChange={(v) => setDraft({ ...draft, recipient_email: v })}
            placeholder="friend@email.com"
          />
        </div>
        <div className="mt-3">
          <Field
            label="Recipient phone (optional — we'll text them a heads-up)"
            icon={<Phone className="h-4 w-4" />}
            type="tel"
            value={draft.recipient_phone}
            onChange={(v) => setDraft({ ...draft, recipient_phone: v })}
            placeholder="(904) 555-1234"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            If you add a phone, we'll text them a short notice so they know to check their email (including the spam folder).
          </p>
        </div>
        <label className="block mt-3">
          <span className="text-xs text-slate-600 flex items-center gap-1 mb-1">
            <MessageSquare className="h-3 w-3" /> Personal message (optional)
          </span>
          <textarea
            rows={2}
            maxLength={1000}
            value={draft.message}
            onChange={(e) => setDraft({ ...draft, message: e.target.value })}
            placeholder="Happy birthday! Hope this brings the party to life."
            className="input"
          />
        </label>
      </div>

      {/* Purchaser */}
      <div className="border-t pt-5">
        <h3 className="text-sm font-semibold text-brand-navy mb-3">From you</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <Field
            label="Your name *"
            icon={<UserIcon className="h-4 w-4" />}
            required
            value={draft.purchaser_name}
            onChange={(v) => setDraft({ ...draft, purchaser_name: v })}
            placeholder="Your full name"
          />
          <Field
            label="Your email * (for receipt)"
            icon={<Mail className="h-4 w-4" />}
            type="email"
            required
            value={draft.purchaser_email}
            onChange={(v) => setDraft({ ...draft, purchaser_email: v })}
            placeholder="you@email.com"
          />
        </div>
      </div>

      {/* Summary + submit */}
      <div className="bg-slate-50 border border-slate-200 rounded p-4">
        <div className="flex justify-between font-bold text-brand-navy text-lg">
          <span>Total</span>
          <span>{formatCurrency(draft.amount_cents)}</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending || !stripeConfigured}
        className="w-full bg-brand-yellow text-brand-navy font-bold py-3 rounded-md hover:bg-yellow-300 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
      >
        <Lock className="h-4 w-4" />
        {pending ? "Setting up checkout..." : `Continue to payment — ${formatCurrency(draft.amount_cents)}`}
      </button>

      <p className="text-xs text-center text-slate-500">
        The recipient gets the code by email immediately after payment.
        You'll get a receipt + copy of the code.
      </p>
    </form>
  );
}

function CheckoutForm({
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
      confirmParams: {
        return_url: `${window.location.origin}/gift-cards?paid=1`,
      },
      redirect: "if_required",
    });

    setPending(false);

    if (error) {
      toast.error(error.message || "Payment failed");
      return;
    }

    toast.success("Payment successful — gift card is on its way!");
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || pending}
        className="w-full bg-brand-navy text-white font-bold py-3 rounded-md hover:bg-brand-navy-dark transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
      >
        <Lock className="h-4 w-4" />
        {pending ? "Processing..." : `Pay ${formatCurrency(amount)}`}
      </button>
    </form>
  );
}

function Summary({ draft }: { draft: PurchaseDraft }) {
  return (
    <div className="bg-slate-50 rounded p-3 mb-4 text-sm">
      <div className="flex justify-between">
        <span className="text-slate-600">Gift card amount</span>
        <strong>{formatCurrency(draft.amount_cents)}</strong>
      </div>
      <div className="flex justify-between text-xs text-slate-500 mt-1">
        <span>Delivering to</span>
        <span>{draft.recipient_email}</span>
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-700 mb-1">{label}</span>
      <div className="relative">
        {icon && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </span>
        )}
        <input
          type={type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={icon ? "input pl-8" : "input"}
        />
      </div>
    </label>
  );
}
