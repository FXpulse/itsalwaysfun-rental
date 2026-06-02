"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Crown,
  Check,
  CreditCard,
  FileText,
  Calendar,
  Download,
  TrendingUp,
  Pause,
  Play,
  ArrowLeftRight,
} from "lucide-react";
import {
  startSubscriptionCheckout,
  openBillingPortal,
  pauseSubscriptionAction,
  resumeSubscriptionAction,
  switchCadenceAction,
} from "./actions";
import {
  ANNUAL_PRICE_CENTS,
  ANNUAL_DISCOUNT_PCT,
  type TierInfo,
  type Tier,
  type Cadence,
} from "@/lib/stripe/billing";
import type {
  BillingPaymentMethod,
  BillingInvoice,
  UpcomingCharge,
  SubscriptionMeta,
} from "@/lib/stripe/billing-data";
import { formatCurrency } from "@/lib/utils";
import { formatDateInTz } from "@/lib/tenant/timezone";

export function BillingPanel({
  tenant,
  tiers,
  paymentMethod,
  invoices = [],
  upcomingCharge,
  subscriptionMeta,
  paidThisYearCents = 0,
  tz = "America/New_York",
}: {
  tenant: {
    plan: "starter" | "pro" | "enterprise" | "founder";
    subscription_status: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    trial_ends_at: string | null;
    has_customer: boolean;
  };
  tiers: TierInfo[];
  paymentMethod?: BillingPaymentMethod | null;
  invoices?: BillingInvoice[];
  upcomingCharge?: UpcomingCharge | null;
  subscriptionMeta?: SubscriptionMeta | null;
  paidThisYearCents?: number;
  tz?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [signupCadence, setSignupCadence] = useState<Cadence>("monthly");

  function handleStart(tier: Tier, cadence: Cadence = signupCadence) {
    startTransition(async () => {
      const r = await startSubscriptionCheckout(tier, cadence);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      if (r.url) window.location.href = r.url;
    });
  }

  function handlePause(months: 1 | 3 | 6) {
    if (!confirm(`Pause billing for ${months} month${months > 1 ? "s" : ""}? You won't be charged during the pause and Stripe auto-resumes on the date shown.`)) return;
    startTransition(async () => {
      const r = await pauseSubscriptionAction(months);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Paused until ${formatDateInTz(r.paused_until!, tz)}`);
      window.location.reload();
    });
  }

  function handleResume() {
    if (!confirm("Resume billing now? You'll be charged on the next regular cycle.")) return;
    startTransition(async () => {
      const r = await resumeSubscriptionAction();
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Subscription resumed");
      window.location.reload();
    });
  }

  function handleSwitchCadence(newCadence: Cadence) {
    const yearly = formatCurrency(ANNUAL_PRICE_CENTS);
    const msg = newCadence === "annual"
      ? `Switch to annual ($${ANNUAL_PRICE_CENTS / 100}/yr, ${ANNUAL_DISCOUNT_PCT}% off)? Stripe will prorate the difference on your next invoice.`
      : "Switch back to monthly ($99/mo)? Stripe will prorate the difference.";
    if (!confirm(msg)) return;
    startTransition(async () => {
      const r = await switchCadenceAction(newCadence);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Switched to ${newCadence}`);
      window.location.reload();
    });
  }

  function handlePortal() {
    startTransition(async () => {
      const r = await openBillingPortal();
      if (r.error) {
        toast.error(r.error);
        return;
      }
      if (r.url) window.location.href = r.url;
    });
  }

  // ─── Founder (free forever) ─────────────────────────────────────────
  if (tenant.plan === "founder") {
    return (
      <div className="card bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300 border-2">
        <div className="flex items-start gap-3">
          <Crown className="h-8 w-8 text-amber-600 flex-shrink-0" />
          <div>
            <h2 className="text-xl font-bold text-brand-navy mb-1">Founder plan</h2>
            <p className="text-sm text-slate-700 mb-2">
              Free forever — you built this platform, after all. Full feature
              access, no usage limits, no billing.
            </p>
            <p className="text-xs text-slate-500">
              When you onboard your first paying tenant, this panel will show
              their billing dashboard instead.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Has active subscription ────────────────────────────────────────
  if (tenant.subscription_status && tenant.subscription_status !== "incomplete") {
    const statusVisual = {
      trialing: { bg: "bg-blue-50 border-blue-300", text: "text-blue-900", icon: <CheckCircle2 className="h-5 w-5 text-blue-700" /> },
      active: { bg: "bg-emerald-50 border-emerald-300", text: "text-emerald-900", icon: <CheckCircle2 className="h-5 w-5 text-emerald-700" /> },
      past_due: { bg: "bg-amber-50 border-amber-300", text: "text-amber-900", icon: <AlertTriangle className="h-5 w-5 text-amber-700" /> },
      canceled: { bg: "bg-red-50 border-red-300", text: "text-red-900", icon: <AlertTriangle className="h-5 w-5 text-red-700" /> },
    }[tenant.subscription_status] || { bg: "bg-slate-50 border-slate-300", text: "text-slate-900", icon: <AlertTriangle className="h-5 w-5 text-slate-700" /> };

    const currentTier = tiers.find((t) => t.id === tenant.plan);

    const isPaused = !!subscriptionMeta?.paused_until;
    const cadence = subscriptionMeta?.cadence;

    return (
      <div className="space-y-6">
        {/* Paused banner — only when collection is paused */}
        {isPaused && (
          <div className="card bg-violet-50 border-2 border-violet-300">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-3">
                <Pause className="h-6 w-6 text-violet-700 flex-shrink-0" />
                <div>
                  <div className="font-bold text-violet-900">Subscription paused</div>
                  <p className="text-sm text-violet-800 mt-1">
                    Billing resumes automatically on{" "}
                    <strong>
                      {formatDateInTz(subscriptionMeta!.paused_until!, tz)}
                    </strong>
                    . You're not being charged during the pause.
                  </p>
                </div>
              </div>
              <button
                onClick={handleResume}
                disabled={pending}
                className="bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-3 py-1.5 rounded inline-flex items-center gap-1"
              >
                <Play className="h-3 w-3" /> Resume now
              </button>
            </div>
          </div>
        )}

        {/* Current subscription card */}
        <div className={`card border-2 ${statusVisual.bg}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {statusVisual.icon}
              <div>
                <div className={`font-bold capitalize ${statusVisual.text}`}>
                  {currentTier?.name || tenant.plan} — {tenant.subscription_status}
                  {cadence && cadence !== "unknown" && (
                    <span className="ml-2 text-xs font-normal text-slate-600">
                      ({cadence === "annual" ? "Annual" : "Monthly"})
                    </span>
                  )}
                </div>
                {tenant.current_period_end && (
                  <p className="text-xs text-slate-600 mt-1">
                    {tenant.cancel_at_period_end ? "Cancels" : "Renews"} on{" "}
                    {formatDateInTz(tenant.current_period_end, tz)}
                  </p>
                )}
                {tenant.subscription_status === "trialing" && tenant.trial_ends_at && (
                  <p className="text-xs text-blue-700 mt-1">
                    Trial ends {formatDateInTz(tenant.trial_ends_at, tz)}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handlePortal}
              disabled={pending}
              className="btn-primary text-sm inline-flex items-center gap-1"
            >
              Manage <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Quick actions: switch cadence + pause — hidden when paused */}
        {!isPaused && tenant.subscription_status === "active" && (
          <div className="card border border-slate-200">
            <h3 className="text-xs uppercase tracking-wider text-slate-500 mb-3">
              Subscription options
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Switch cadence */}
              {cadence === "monthly" && (
                <button
                  onClick={() => handleSwitchCadence("annual")}
                  disabled={pending}
                  className="border-2 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-left p-3 rounded transition disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 text-emerald-900 font-semibold text-sm">
                    <ArrowLeftRight className="h-4 w-4" />
                    Switch to annual
                  </div>
                  <p className="text-xs text-emerald-800 mt-1">
                    Save {ANNUAL_DISCOUNT_PCT}% — pay ${ANNUAL_PRICE_CENTS / 100}/yr (${(ANNUAL_PRICE_CENTS / 1200).toFixed(2)}/mo effective)
                  </p>
                </button>
              )}
              {cadence === "annual" && (
                <button
                  onClick={() => handleSwitchCadence("monthly")}
                  disabled={pending}
                  className="border border-slate-300 hover:bg-slate-50 text-left p-3 rounded transition disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
                    <ArrowLeftRight className="h-4 w-4" />
                    Switch to monthly
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Pay $99/mo. You lose the annual discount.
                  </p>
                </button>
              )}

              {/* Pause subscription */}
              <details className="border border-slate-300 hover:bg-slate-50 rounded">
                <summary className="cursor-pointer p-3 list-none">
                  <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
                    <Pause className="h-4 w-4" />
                    Pause subscription (off-season)
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    No charges during pause — Stripe auto-resumes.
                  </p>
                </summary>
                <div className="px-3 pb-3 flex gap-2 flex-wrap">
                  <button
                    onClick={() => handlePause(1)}
                    disabled={pending}
                    className="text-xs border border-slate-300 px-2 py-1 rounded hover:bg-white"
                  >
                    1 month
                  </button>
                  <button
                    onClick={() => handlePause(3)}
                    disabled={pending}
                    className="text-xs border border-slate-300 px-2 py-1 rounded hover:bg-white"
                  >
                    3 months
                  </button>
                  <button
                    onClick={() => handlePause(6)}
                    disabled={pending}
                    className="text-xs border border-slate-300 px-2 py-1 rounded hover:bg-white"
                  >
                    6 months
                  </button>
                </div>
              </details>
            </div>
          </div>
        )}

        {/* Upcoming charge + Paid this year — 2 mini cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {upcomingCharge && upcomingCharge.amount_cents > 0 && !tenant.cancel_at_period_end ? (
            <div className="card border border-slate-200">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 mb-1">
                <Calendar className="h-3.5 w-3.5" /> Next charge
              </div>
              <div className="text-2xl font-bold text-brand-navy font-mono">
                {formatCurrency(upcomingCharge.amount_cents)}
              </div>
              {upcomingCharge.next_payment_at && (
                <div className="text-xs text-slate-500 mt-1">
                  on {formatDateInTz(upcomingCharge.next_payment_at, tz)}
                </div>
              )}
            </div>
          ) : (
            <div className="card border border-slate-200">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 mb-1">
                <Calendar className="h-3.5 w-3.5" /> Next charge
              </div>
              <div className="text-sm text-slate-500 pt-1">
                {tenant.cancel_at_period_end
                  ? "No future charges — subscription ending"
                  : "Not scheduled"}
              </div>
            </div>
          )}

          <div className="card border border-slate-200">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> Paid this year
            </div>
            <div className="text-2xl font-bold text-brand-navy font-mono">
              {formatCurrency(paidThisYearCents)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {new Date().getFullYear()} — track as a business expense
            </div>
          </div>
        </div>

        {/* Payment method on file */}
        <div className="card border border-slate-200">
          <h3 className="text-xs uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
            <CreditCard className="h-3.5 w-3.5" /> Payment method on file
          </h3>
          {paymentMethod ? (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm uppercase font-semibold text-brand-navy">
                    {paymentMethod.brand}
                  </span>
                  <span className="text-sm text-slate-600">
                    ending in <strong className="font-mono">{paymentMethod.last4}</strong>
                  </span>
                </div>
                <div className="text-xs mt-1">
                  Expires{" "}
                  <span className={paymentMethod.is_expired ? "text-red-600 font-semibold" : paymentMethod.expires_soon ? "text-amber-700 font-semibold" : "text-slate-500"}>
                    {String(paymentMethod.exp_month).padStart(2, "0")}/{paymentMethod.exp_year}
                  </span>
                  {paymentMethod.is_expired && " — expired, update now"}
                  {!paymentMethod.is_expired && paymentMethod.expires_soon && " — expires soon"}
                </div>
              </div>
              <button
                onClick={handlePortal}
                disabled={pending}
                className="text-sm border border-slate-300 px-3 py-1.5 rounded hover:bg-slate-50 inline-flex items-center gap-1"
              >
                Update card <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                No card on file. Add one before your trial ends to avoid
                interruption.
              </p>
              <button
                onClick={handlePortal}
                disabled={pending}
                className="btn-primary text-sm inline-flex items-center gap-1"
              >
                Add card <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          )}
          <p className="text-[11px] text-slate-400 mt-3">
            🔒 Cards are stored by Stripe directly — RentalFlow never sees or
            saves your card number. The "Update card" button opens Stripe's
            secure portal in a new tab.
          </p>
        </div>

        {/* Invoice history */}
        <div className="card border border-slate-200 p-0">
          <div className="px-4 pt-4 pb-3 flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" /> Invoice history
            </h3>
            {invoices.length > 0 && (
              <span className="text-[11px] text-slate-400">
                Last {invoices.length}
              </span>
            )}
          </div>
          {invoices.length === 0 ? (
            <p className="text-sm text-slate-500 px-4 pb-4">
              No invoices yet. After your first charge, receipts will appear here.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Period</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-center">Status</th>
                  <th className="px-4 py-2 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 text-xs text-slate-600 font-mono">
                      {formatDateInTz(inv.created_at, tz)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {inv.period_start && inv.period_end ? (
                        <>
                          {formatDateInTz(inv.period_start, tz)} – {formatDateInTz(inv.period_end, tz)}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-brand-navy">
                      {formatCurrency(inv.amount_paid_cents || inv.amount_due_cents)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusPill status={inv.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {inv.pdf_url ? (
                        <a
                          href={inv.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-brand-navy hover:underline inline-flex items-center gap-1"
                        >
                          <Download className="h-3 w-3" /> PDF
                        </a>
                      ) : inv.hosted_url ? (
                        <a
                          href={inv.hosted_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-brand-navy hover:underline inline-flex items-center gap-1"
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-xs text-slate-500">
          To change plan, cancel, or update billing details click{" "}
          <strong>Manage</strong> in the top card to open Stripe's billing
          portal.
        </p>
      </div>
    );
  }

  // ─── No subscription — show the single $99 tier ─────────────────────
  const proTier = tiers.find((t) => t.id === "pro")!;
  const annualMonthlyEffective = ANNUAL_PRICE_CENTS / 1200;
  return (
    <div className="card border-2 border-brand-navy shadow-lg max-w-2xl">
      <div className="inline-block bg-brand-yellow text-brand-navy text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded mb-2">
        Everything included
      </div>
      <h3 className="text-xl font-bold text-brand-navy">RentalFlow</h3>

      {/* Cadence toggle */}
      <div className="inline-flex border border-slate-200 rounded-lg p-1 mt-3 mb-3 bg-slate-50">
        <button
          type="button"
          onClick={() => setSignupCadence("monthly")}
          className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
            signupCadence === "monthly"
              ? "bg-white text-brand-navy shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setSignupCadence("annual")}
          className={`px-3 py-1.5 rounded text-xs font-semibold transition relative ${
            signupCadence === "annual"
              ? "bg-white text-brand-navy shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Annual
          <span className="ml-1 bg-emerald-500 text-white text-[9px] font-bold px-1 py-0.5 rounded">
            -{ANNUAL_DISCOUNT_PCT}%
          </span>
        </button>
      </div>

      <div className="my-2">
        {signupCadence === "monthly" ? (
          <>
            <span className="text-5xl font-bold">${proTier.price_cents / 100}</span>
            <span className="text-base text-slate-500">/mo</span>
          </>
        ) : (
          <>
            <span className="text-5xl font-bold">${ANNUAL_PRICE_CENTS / 100}</span>
            <span className="text-base text-slate-500">/yr</span>
            <div className="text-xs text-emerald-700 font-medium mt-1">
              ${annualMonthlyEffective.toFixed(2)}/mo effective · save ${(proTier.price_cents * 12 - ANNUAL_PRICE_CENTS) / 100}/year
            </div>
          </>
        )}
      </div>
      <p className="text-sm text-slate-600 mb-4">
        Replaces $300/mo competitors. No tiers, no transaction fees, no upsells.
        30-day free trial.
      </p>
      <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1 mb-5 text-xs">
        {proTier.features.map((f) => (
          <li key={f} className="flex items-start gap-1.5">
            <Check className="h-3 w-3 text-emerald-600 mt-0.5 flex-shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={() => handleStart(proTier.id, signupCadence)}
        disabled={pending}
        className="btn-primary w-full text-lg py-3"
      >
        {pending ? "Loading..." : "Start 30-day free trial"}
      </button>
      <p className="text-xs text-slate-400 mt-2 text-center">
        Cancel anytime. No credit card required until trial ends.
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    paid: { label: "Paid", cls: "bg-emerald-100 text-emerald-800" },
    open: { label: "Open", cls: "bg-blue-100 text-blue-800" },
    void: { label: "Void", cls: "bg-slate-200 text-slate-600" },
    uncollectible: { label: "Failed", cls: "bg-red-100 text-red-800" },
    draft: { label: "Draft", cls: "bg-slate-100 text-slate-600" },
  };
  const v = map[status] || { label: status, cls: "bg-slate-100 text-slate-600" };
  return (
    <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${v.cls}`}>
      {v.label}
    </span>
  );
}
