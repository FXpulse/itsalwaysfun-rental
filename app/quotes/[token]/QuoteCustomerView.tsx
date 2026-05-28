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
  damage_protection_offered?: boolean;
  damage_protection_cents?: number;
  waiver_required?: boolean;
  tax_exempt?: boolean;
}

interface SurfaceOption {
  value: string;
  label: string;
}

export function QuoteCustomerView({
  quote,
  clientSecret,
  stripeConfigured,
  stripePublishableKey,
  waiverTitle,
  waiverText,
  damageCoverageCents,
  powerSupplyPerDayCents,
  surfaceOptions,
  availabilityError,
  finalAmountCents,
  logoUrl,
  brandName,
  taxEnabled,
  taxRatePercent,
  taxLabel,
}: {
  quote: Quote;
  clientSecret: string | null;
  stripeConfigured: boolean;
  stripePublishableKey: string;
  waiverTitle: string;
  waiverText: string;
  damageCoverageCents: number;
  powerSupplyPerDayCents: number;
  surfaceOptions: SurfaceOption[];
  availabilityError?: string | null;
  /** Final amount the customer agreed to pay (quote + protection + power
   *  supply). Sourced from the Stripe PaymentIntent so it always matches
   *  what Stripe will actually charge. */
  finalAmountCents: number;
  logoUrl: string;
  brandName: string;
  taxEnabled: boolean;
  taxRatePercent: number;
  taxLabel: string;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-brand-navy text-white py-6">
        <div className="max-w-3xl mx-auto px-4 flex justify-between items-center gap-4">
          <div className="min-w-0">
            <div className="text-xs text-brand-yellow tracking-widest font-bold uppercase truncate">
              {brandName}
            </div>
            <h1 className="text-2xl font-bold">Quote {quote.quote_number}</h1>
          </div>
          <StatusBadge status={quote.status} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Logo above the customer message — branded reinforcement of who
            the quote is from, the first thing they see in the body. */}
        {logoUrl && (
          <div className="text-center pt-2">
            <img
              src={logoUrl}
              alt={brandName}
              className="h-20 w-auto inline-block"
            />
          </div>
        )}

        {availabilityError && (
          <div className="card border-red-200 bg-red-50">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h2 className="font-semibold text-red-900 mb-1">
                  This reservation is no longer available
                </h2>
                <p className="text-sm text-red-800">{availabilityError}</p>
                <p className="text-xs text-red-700 mt-2">
                  Your 24-hour hold expired and another customer reserved the
                  date(s). Please contact us so we can find another date or
                  substitute items for you.
                </p>
              </div>
            </div>
          </div>
        )}

        <QuoteDetails quote={quote} />

        {(quote.status === "sent" || quote.status === "viewed") && (
          <ApproveDecline
            quote={quote}
            waiverTitle={waiverTitle}
            waiverText={waiverText}
            damageCoverageCents={damageCoverageCents}
            powerSupplyPerDayCents={powerSupplyPerDayCents}
            surfaceOptions={surfaceOptions}
            taxEnabled={taxEnabled}
            taxRatePercent={taxRatePercent}
            taxLabel={taxLabel}
          />
        )}

        {quote.status === "approved" && !availabilityError && (
          <PaymentSection
            quote={quote}
            clientSecret={clientSecret}
            stripeConfigured={stripeConfigured}
            stripePublishableKey={stripePublishableKey}
            finalAmountCents={finalAmountCents}
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

function numDaysInRange(start: string, end: string | null): number {
  const s = new Date((start || "") + "T00:00:00");
  const e = new Date(((end || start) || "") + "T00:00:00");
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 1;
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1);
}

function ApproveDecline({
  quote,
  waiverTitle,
  waiverText,
  damageCoverageCents,
  powerSupplyPerDayCents,
  surfaceOptions,
  taxEnabled,
  taxRatePercent,
  taxLabel,
}: {
  quote: Quote;
  waiverTitle: string;
  waiverText: string;
  damageCoverageCents: number;
  powerSupplyPerDayCents: number;
  surfaceOptions: SurfaceOption[];
  taxEnabled: boolean;
  taxRatePercent: number;
  taxLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showDecline, setShowDecline] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [reason, setReason] = useState("");

  // Customer setup choices — required before booking creation
  const [surfaceType, setSurfaceType] = useState<string>("");
  const [needsPower, setNeedsPower] = useState<boolean | null>(null);
  const [protectionAccepted, setProtectionAccepted] = useState<boolean | null>(null);
  const [waiverName, setWaiverName] = useState("");
  const [waiverAgreed, setWaiverAgreed] = useState(false);

  // Live total breakdown — recalculates as the customer toggles options
  const numDays = numDaysInRange(quote.event_date, quote.event_end_date);
  const protectionPriceCents = quote.damage_protection_cents || 0;
  const protectionAddCents = protectionAccepted === true ? protectionPriceCents : 0;
  const powerSupplyTotalCents = needsPower === true ? powerSupplyPerDayCents * numDays : 0;
  const preTaxTotalCents = quote.total_cents + protectionAddCents + powerSupplyTotalCents;
  // Tax resolution: tax_exempt wins, then manual override, then auto-calc.
  const taxCents = quote.tax_exempt
    ? 0
    : (quote.tax_cents || 0) > 0
      ? quote.tax_cents
      : taxEnabled && taxRatePercent > 0
        ? Math.round((preTaxTotalCents * taxRatePercent) / 100)
        : 0;
  const finalTotalCents = preTaxTotalCents + taxCents;

  function handleSubmitSetup() {
    if (!surfaceType) {
      toast.error("Pick where the inflatable will be set up.");
      return;
    }
    if (needsPower === null) {
      toast.error("Tell us whether you have a power outlet within ~75ft.");
      return;
    }
    if (quote.damage_protection_offered && protectionAccepted === null) {
      toast.error("Choose Yes or No for damage protection.");
      return;
    }
    if (quote.waiver_required) {
      if (!waiverAgreed) {
        toast.error("Please agree to the liability waiver to continue.");
        return;
      }
      if (waiverName.trim().length < 2) {
        toast.error("Type your full name as your signature.");
        return;
      }
    }

    startTransition(async () => {
      const r = await approveQuote(quote.token, {
        surface_type: surfaceType,
        needs_power_supply: needsPower,
        damage_protection_accepted: quote.damage_protection_offered ? protectionAccepted : null,
        waiver_signed_name: quote.waiver_required ? waiverName.trim() : null,
      });
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
      const r = await declineQuote(quote.token, reason);
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

  // Setup form — shown after the customer clicks "Approve". Captures
  // surface, power, damage protection opt-in (if offered), and waiver
  // signature (if required) before creating the booking + payment intent.
  if (showSetup) {
    const protectionPrice = quote.damage_protection_cents || 0;
    return (
      <div className="card space-y-6">
        <div>
          <h2 className="text-lg font-bold text-brand-navy">Almost there</h2>
          <p className="text-sm text-slate-600">
            Just a few quick details so our crew can set everything up properly.
          </p>
        </div>

        {/* Surface */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Setup surface <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-slate-500 mb-2">
            Where will it be set up? We bring different anchors depending on the surface.
          </p>
          {surfaceOptions.length === 0 ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              No setup surface options configured. Contact us before booking.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {surfaceOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSurfaceType(opt.value)}
                  className={`text-xs font-semibold py-2 px-2 rounded border transition ${
                    surfaceType === opt.value
                      ? "bg-brand-navy text-white border-brand-navy"
                      : "bg-white text-slate-700 border-slate-300 hover:border-brand-navy"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Power */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Power source available? <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-slate-500 mb-2">
            Inflatables need an outlet within ~75ft. If not available, we bring a portable generator.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setNeedsPower(false)}
              className={`text-sm font-semibold py-3 px-2 rounded border transition ${
                needsPower === false
                  ? "bg-brand-navy text-white border-brand-navy"
                  : "bg-white text-slate-700 border-slate-300 hover:border-brand-navy"
              }`}
            >
              ✓ Yes, I have an outlet
            </button>
            <button
              type="button"
              onClick={() => setNeedsPower(true)}
              className={`text-sm font-semibold py-3 px-2 rounded border transition ${
                needsPower === true
                  ? "bg-amber-600 text-white border-amber-600"
                  : "bg-white text-slate-700 border-slate-300 hover:border-amber-600"
              }`}
            >
              No — bring power supply
              {powerSupplyPerDayCents > 0 && (
                <div className="text-[10px] font-normal opacity-80 mt-0.5">
                  +{formatCurrency(powerSupplyPerDayCents)} × {numDays} day{numDays > 1 ? "s" : ""}{" "}
                  = {formatCurrency(powerSupplyPerDayCents * numDays)}
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Damage protection (optional, only if offered by admin) */}
        {quote.damage_protection_offered && (
          <div className="border-t border-slate-100 pt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Damage protection (optional) <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-slate-500 mb-2">
              For {formatCurrency(protectionPrice)}, we cover up to{" "}
              {formatCurrency(damageCoverageCents)} in accidental damage. Your choice.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setProtectionAccepted(true)}
                className={`text-sm font-semibold py-3 px-2 rounded border transition ${
                  protectionAccepted === true
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-slate-700 border-slate-300 hover:border-emerald-600"
                }`}
              >
                ✓ Yes, add protection (+{formatCurrency(protectionPrice)})
              </button>
              <button
                type="button"
                onClick={() => setProtectionAccepted(false)}
                className={`text-sm font-semibold py-3 px-2 rounded border transition ${
                  protectionAccepted === false
                    ? "bg-slate-700 text-white border-slate-700"
                    : "bg-white text-slate-700 border-slate-300 hover:border-slate-700"
                }`}
              >
                No thanks
              </button>
            </div>
          </div>
        )}

        {/* Waiver (required if admin enabled it) */}
        {quote.waiver_required && (
          <div className="border-t border-slate-100 pt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {waiverTitle} <span className="text-red-500">*</span>
            </label>
            <div className="border border-slate-200 rounded p-3 bg-slate-50 max-h-40 overflow-y-auto text-xs text-slate-700 whitespace-pre-wrap mb-2">
              {waiverText || "Liability waiver text not configured. Contact the rental owner."}
            </div>
            <label className="flex items-start gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={waiverAgreed}
                onChange={(e) => setWaiverAgreed(e.target.checked)}
              />
              <span className="text-sm text-slate-700">
                I have read and agree to the liability waiver above.
              </span>
            </label>
            <input
              type="text"
              className="input"
              placeholder="Type your full name as signature"
              value={waiverName}
              onChange={(e) => setWaiverName(e.target.value)}
              maxLength={200}
            />
            <p className="text-xs text-slate-400 mt-1">
              Typing your name acts as your electronic signature (UETA/E-SIGN compliant).
            </p>
          </div>
        )}

        {/* Live total breakdown — recomputes as the customer toggles options */}
        <div className="border-t border-slate-100 pt-4 bg-slate-50 -mx-4 px-4 pb-4 sm:rounded-b-lg">
          <div className="text-xs uppercase tracking-wide font-bold text-slate-500 mb-2">
            Total you'll pay
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Original quote</span>
              <span className="font-mono">{formatCurrency(quote.total_cents)}</span>
            </div>
            {protectionAddCents > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>+ Damage protection</span>
                <span className="font-mono">{formatCurrency(protectionAddCents)}</span>
              </div>
            )}
            {powerSupplyTotalCents > 0 && (
              <div className="flex justify-between text-amber-700">
                <span>
                  + Power supply ({numDays} day{numDays > 1 ? "s" : ""})
                </span>
                <span className="font-mono">{formatCurrency(powerSupplyTotalCents)}</span>
              </div>
            )}
            {taxCents > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>
                  + {taxLabel}
                  {taxRatePercent > 0 && (quote.tax_cents || 0) === 0
                    ? ` (${taxRatePercent}%)`
                    : ""}
                </span>
                <span className="font-mono">{formatCurrency(taxCents)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 mt-2 border-t border-slate-200 text-base font-bold text-brand-navy">
              <span>Total</span>
              <span className="font-mono text-lg">{formatCurrency(finalTotalCents)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={() => setShowSetup(false)}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-3 text-slate-700 hover:bg-slate-50"
            disabled={pending}
          >
            ← Back
          </button>
          <button
            onClick={handleSubmitSetup}
            disabled={pending}
            className="flex-1 bg-brand-navy text-white font-bold py-3 px-6 rounded-md hover:bg-brand-navy-dark transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="h-5 w-5" />
            {pending
              ? "Approving..."
              : `Approve & pay ${formatCurrency(finalTotalCents)}`}
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
          onClick={() => setShowSetup(true)}
          disabled={pending}
          className="flex-1 bg-brand-navy text-white font-bold py-3 px-6 rounded-md hover:bg-brand-navy-dark transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="h-5 w-5" />
          Approve quote
        </button>
        <button
          onClick={() => setShowDecline(true)}
          className="sm:w-auto inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-3 text-slate-700 hover:bg-slate-50"
        >
          Decline
        </button>
      </div>
      <p className="text-xs text-slate-500 mt-2 text-center">
        Questions? Call us before approving.
      </p>
    </div>
  );
}

function PaymentSection({
  quote,
  clientSecret,
  stripeConfigured,
  stripePublishableKey,
  finalAmountCents,
}: {
  quote: Quote;
  clientSecret: string | null;
  stripeConfigured: boolean;
  stripePublishableKey: string;
  finalAmountCents: number;
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

  // Breakdown — only show extras if the final differs from the original quote
  const extras = finalAmountCents - quote.total_cents;

  return (
    <div className="card border-brand-yellow border-2">
      <h2 className="text-lg font-bold text-brand-navy mb-1">Complete payment</h2>
      <p className="text-sm text-slate-500 mb-4 flex items-center gap-1">
        <Lock className="h-3.5 w-3.5" /> Secure payment via Stripe · 100% upfront
      </p>

      {/* Final amount breakdown — confirms what Stripe will charge */}
      <div className="bg-slate-50 border border-slate-200 rounded p-3 mb-4 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Original quote</span>
          <span className="font-mono">{formatCurrency(quote.total_cents)}</span>
        </div>
        {extras > 0 && (
          <div className="flex justify-between text-slate-600">
            <span>+ Damage protection / power supply</span>
            <span className="font-mono">{formatCurrency(extras)}</span>
          </div>
        )}
        <div className="flex justify-between pt-2 mt-2 border-t border-slate-200 text-base font-bold text-brand-navy">
          <span>Total to pay now</span>
          <span className="font-mono text-lg">{formatCurrency(finalAmountCents)}</span>
        </div>
      </div>

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
        <PaymentForm token={quote.token} amount={finalAmountCents} />
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
