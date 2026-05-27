"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, ExternalLink, RefreshCcw } from "lucide-react";
import {
  startStripeOnboarding,
  openStripeDashboard,
  refreshStripeStatus,
} from "./actions";
import type { StripeConnectStatus } from "@/lib/stripe/connect";

export function StripeConnectPanel({
  tenant,
  status,
}: {
  tenant: {
    id: string;
    business_name: string;
    stripe_account_id: string | null;
  };
  status: StripeConnectStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleConnect() {
    startTransition(async () => {
      const r = await startStripeOnboarding();
      if (r.error) {
        toast.error(r.error);
        return;
      }
      if (r.url) window.location.href = r.url;
    });
  }

  function handleDashboard() {
    startTransition(async () => {
      const r = await openStripeDashboard();
      if (r.error) {
        toast.error(r.error);
        return;
      }
      if (r.url) window.open(r.url, "_blank");
    });
  }

  function handleRefresh() {
    startTransition(async () => {
      const r = await refreshStripeStatus();
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Status: ${r.status}`);
      router.refresh();
    });
  }

  // Visual state per status
  const visual = {
    not_connected: {
      bg: "bg-amber-50 border-amber-300",
      icon: <AlertTriangle className="h-6 w-6 text-amber-700" />,
      title: "Not connected",
      subtitle: "Connect Stripe to start taking payments.",
      cta: "Connect Stripe",
    },
    pending_onboarding: {
      bg: "bg-amber-50 border-amber-300",
      icon: <AlertTriangle className="h-6 w-6 text-amber-700" />,
      title: "Onboarding incomplete",
      subtitle: "Finish entering your details in Stripe.",
      cta: "Resume onboarding",
    },
    missing_details: {
      bg: "bg-amber-50 border-amber-300",
      icon: <AlertTriangle className="h-6 w-6 text-amber-700" />,
      title: "More information required",
      subtitle: "Stripe needs additional verification before charges can be enabled.",
      cta: "Update in Stripe",
    },
    disabled: {
      bg: "bg-red-50 border-red-300",
      icon: <AlertTriangle className="h-6 w-6 text-red-700" />,
      title: "Account disabled",
      subtitle: "Your Stripe account has been suspended. Contact Stripe support.",
      cta: "Open Stripe Dashboard",
    },
    active: {
      bg: "bg-emerald-50 border-emerald-300",
      icon: <CheckCircle2 className="h-6 w-6 text-emerald-700" />,
      title: "Active",
      subtitle: "All systems go. Payments flow to your bank.",
      cta: "Open Stripe Dashboard",
    },
  }[status.status];

  const showConnect = status.status === "not_connected" || status.status === "pending_onboarding";

  return (
    <div className={`card border-2 ${visual.bg}`}>
      <div className="flex items-start gap-3 mb-4">
        {visual.icon}
        <div className="flex-1">
          <div className="font-bold text-slate-900">Stripe Connect — {visual.title}</div>
          <p className="text-sm text-slate-600 mt-1">{visual.subtitle}</p>
          {tenant.stripe_account_id && (
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              Account: {tenant.stripe_account_id}
            </p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={pending}
          className="text-xs text-slate-500 hover:text-brand-navy inline-flex items-center gap-1"
          title="Re-check status"
        >
          <RefreshCcw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {/* Capability checklist */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
        <Capability label="Details submitted" ok={status.details_submitted} />
        <Capability label="Charges enabled" ok={status.charges_enabled} />
        <Capability label="Payouts enabled" ok={status.payouts_enabled} />
      </div>

      <div className="flex gap-2">
        {showConnect ? (
          <button
            onClick={handleConnect}
            disabled={pending}
            className="btn-primary inline-flex items-center gap-2"
          >
            {pending ? "Loading..." : visual.cta}
            <ExternalLink className="h-3 w-3" />
          </button>
        ) : (
          <button
            onClick={handleDashboard}
            disabled={pending}
            className="btn-primary inline-flex items-center gap-2"
          >
            {pending ? "Loading..." : visual.cta}
            <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function Capability({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={`rounded p-2 border text-center ${
      ok ? "bg-white border-emerald-200" : "bg-white border-slate-200"
    }`}>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`text-base font-bold ${ok ? "text-emerald-700" : "text-slate-400"}`}>
        {ok ? "✓" : "—"}
      </div>
    </div>
  );
}
