"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, ExternalLink, Crown, Check } from "lucide-react";
import { startSubscriptionCheckout, openBillingPortal } from "./actions";
import type { TierInfo, Tier } from "@/lib/stripe/billing";

export function BillingPanel({
  tenant,
  tiers,
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
}) {
  const [pending, startTransition] = useTransition();

  function handleStart(tier: Tier) {
    startTransition(async () => {
      const r = await startSubscriptionCheckout(tier);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      if (r.url) window.location.href = r.url;
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

    return (
      <>
        <div className={`card border-2 ${statusVisual.bg} mb-4`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {statusVisual.icon}
              <div>
                <div className={`font-bold capitalize ${statusVisual.text}`}>
                  {currentTier?.name || tenant.plan} — {tenant.subscription_status}
                </div>
                {tenant.current_period_end && (
                  <p className="text-xs text-slate-600 mt-1">
                    {tenant.cancel_at_period_end ? "Cancels" : "Renews"} on{" "}
                    {new Date(tenant.current_period_end).toLocaleDateString()}
                  </p>
                )}
                {tenant.subscription_status === "trialing" && tenant.trial_ends_at && (
                  <p className="text-xs text-blue-700 mt-1">
                    Trial ends {new Date(tenant.trial_ends_at).toLocaleDateString()}
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

        <p className="text-xs text-slate-500">
          To change plan, update card, view invoices, or cancel: click{" "}
          <strong>Manage</strong> above to open the Stripe billing portal.
        </p>
      </>
    );
  }

  // ─── No subscription — show the single $99 tier ─────────────────────
  const proTier = tiers.find((t) => t.id === "pro")!;
  return (
    <div className="card border-2 border-brand-navy shadow-lg max-w-2xl">
      <div className="inline-block bg-brand-yellow text-brand-navy text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded mb-2">
        Everything included
      </div>
      <h3 className="text-xl font-bold text-brand-navy">RentalFlow</h3>
      <div className="my-3">
        <span className="text-5xl font-bold">${proTier.price_cents / 100}</span>
        <span className="text-base text-slate-500">/mo</span>
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
        onClick={() => handleStart(proTier.id)}
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
