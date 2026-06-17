"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save, CheckCircle2 } from "lucide-react";
import { saveTenantGhlConfig } from "./actions";

interface ConfigState {
  ghl_location_id: string;
  ghl_booking_webhook_url: string;
  ghl_abandoned_cart_webhook_url: string;
  ghl_referral_webhook_url: string;
  ghl_quote_webhook_url: string;
}

export function GhlConfigForm({
  tenantId,
  businessName,
  initial,
}: {
  tenantId: string;
  businessName: string;
  initial: ConfigState;
}) {
  const [state, setState] = useState<ConfigState>(initial);
  const [pending, startTransition] = useTransition();

  function update<K extends keyof ConfigState>(key: K, val: string) {
    setState((s) => ({ ...s, [key]: val }));
  }

  function handleSave() {
    startTransition(async () => {
      const r = await saveTenantGhlConfig({
        tenantId,
        ghl_location_id: state.ghl_location_id || null,
        ghl_booking_webhook_url: state.ghl_booking_webhook_url || null,
        ghl_abandoned_cart_webhook_url:
          state.ghl_abandoned_cart_webhook_url || null,
        ghl_referral_webhook_url: state.ghl_referral_webhook_url || null,
        ghl_quote_webhook_url: state.ghl_quote_webhook_url || null,
      });
      if ((r as any).error) {
        toast.error((r as any).error);
        return;
      }
      toast.success(`Saved GHL config for ${businessName}`);
    });
  }

  const hasLocation = !!state.ghl_location_id.trim();

  return (
    <div className="space-y-5">
      {/* Location ID — the gate */}
      <div className="bg-white border-2 border-slate-200 rounded-lg p-4">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
          GHL Location ID *
        </label>
        <p className="text-xs text-slate-500 mb-2">
          The sub-account ID under the master agency. Without this, no GHL
          pushes happen for this tenant.
        </p>
        <input
          type="text"
          value={state.ghl_location_id}
          onChange={(e) => update("ghl_location_id", e.target.value)}
          className="w-full border-2 border-slate-200 rounded px-3 py-2 font-mono text-sm focus:border-brand-navy outline-none"
          placeholder="e.g. 0TI1hA6fSt9I7GDtcZbh"
        />
        {hasLocation && (
          <p className="text-xs text-emerald-600 mt-1 inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Will route to this Location
          </p>
        )}
      </div>

      {/* Webhook URLs */}
      <div className="bg-white border-2 border-slate-200 rounded-lg p-4 space-y-4">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Workflow Webhook URLs (optional)
        </p>
        <p className="text-xs text-slate-500 -mt-2">
          Trigger URLs from per-workflow inbound webhook nodes in the
          tenant's HighLevel sub-account. If empty, the matching push is
          skipped (with a Sentry breadcrumb).
        </p>

        {(
          [
            {
              key: "ghl_booking_webhook_url" as const,
              label: "Booking confirmed",
              hint: "Fires when a customer pays for a booking (Stripe webhook).",
            },
            {
              key: "ghl_abandoned_cart_webhook_url" as const,
              label: "Abandoned cart",
              hint: "Fires 30 min after a customer fills email but doesn't complete checkout.",
            },
            {
              key: "ghl_quote_webhook_url" as const,
              label: "Quote sent",
              hint: "Fires when staff send a quote to a customer.",
            },
            {
              key: "ghl_referral_webhook_url" as const,
              label: "Referral commission",
              hint: "Fires when a referrer earns commission on a referred booking.",
            },
          ] as const
        ).map((f) => (
          <div key={f.key}>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              {f.label}
            </label>
            <p className="text-xs text-slate-500 mb-1">{f.hint}</p>
            <input
              type="url"
              value={state[f.key]}
              onChange={(e) => update(f.key, e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 font-mono text-xs focus:border-brand-navy outline-none"
              placeholder="https://services.leadconnectorhq.com/hooks/..."
            />
          </div>
        ))}
      </div>

      {/* Save */}
      <button
        type="button"
        onClick={handleSave}
        disabled={pending}
        className="w-full bg-brand-navy text-white font-bold py-3 rounded-lg hover:bg-brand-navy/90 disabled:opacity-50 transition flex items-center justify-center gap-2"
      >
        {pending ? "Saving..." : "Save GHL config"}
        {!pending && <Save className="h-4 w-4" />}
      </button>

      <p className="text-xs text-slate-400 text-center">
        Changes are live immediately for the next booking / contact / quote
        / referral event. No deploy needed.
      </p>
    </div>
  );
}
