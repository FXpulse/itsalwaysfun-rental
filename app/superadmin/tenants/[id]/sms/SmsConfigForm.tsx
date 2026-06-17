"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save, CheckCircle2, AlertCircle } from "lucide-react";
import { saveTenantSmsConfig } from "./actions";

interface ConfigState {
  twilio_from_number: string;
  twilio_messaging_service_sid: string;
}

const E164_RE = /^\+[1-9]\d{9,14}$/;
const MSG_SVC_RE = /^MG[0-9a-fA-F]{32}$/;

export function SmsConfigForm({
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

  const fromTrim = state.twilio_from_number.trim();
  const svcTrim = state.twilio_messaging_service_sid.trim();
  const fromValid = !fromTrim || E164_RE.test(fromTrim);
  const svcValid = !svcTrim || MSG_SVC_RE.test(svcTrim);
  const canSave = fromValid && svcValid && !pending;

  function handleSave() {
    if (!canSave) return;
    startTransition(async () => {
      const r = await saveTenantSmsConfig({
        tenantId,
        twilio_from_number: fromTrim || null,
        twilio_messaging_service_sid: svcTrim || null,
      });
      if ((r as any).error) {
        toast.error((r as any).error);
        return;
      }
      toast.success(`Saved Twilio number for ${businessName}`);
    });
  }

  return (
    <div className="space-y-5">
      {/* From number — the gate */}
      <div className="bg-white border-2 border-slate-200 rounded-lg p-4">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
          Twilio from-number (E.164) *
        </label>
        <p className="text-xs text-slate-500 mb-2">
          The phone number that appears as the sender on the customer's
          phone. Format must start with <code>+</code> then country code,
          then digits — e.g. <code>+19045551234</code>.
        </p>
        <input
          type="text"
          value={state.twilio_from_number}
          onChange={(e) => update("twilio_from_number", e.target.value)}
          className={
            "w-full border-2 rounded px-3 py-2 font-mono text-sm outline-none " +
            (fromValid
              ? "border-slate-200 focus:border-brand-navy"
              : "border-red-400 focus:border-red-500")
          }
          placeholder="+19045551234"
        />
        {!fromValid && (
          <p className="text-xs text-red-600 mt-1 inline-flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Not a valid E.164 phone (e.g. +19045551234)
          </p>
        )}
        {fromValid && fromTrim && (
          <p className="text-xs text-emerald-600 mt-1 inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> SMS will send from this number
          </p>
        )}
      </div>

      {/* Messaging Service SID — optional */}
      <div className="bg-white border-2 border-slate-200 rounded-lg p-4">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
          Messaging Service SID (optional)
        </label>
        <p className="text-xs text-slate-500 mb-2">
          If this tenant has multiple numbers in a Twilio Messaging Service
          pool (for A2P consolidation), paste the service SID here. Twilio
          will pick the best number per destination automatically. Format:{" "}
          <code>MG</code> + 32 hex characters.
        </p>
        <input
          type="text"
          value={state.twilio_messaging_service_sid}
          onChange={(e) =>
            update("twilio_messaging_service_sid", e.target.value)
          }
          className={
            "w-full border-2 rounded px-3 py-2 font-mono text-xs outline-none " +
            (svcValid
              ? "border-slate-200 focus:border-brand-navy"
              : "border-red-400 focus:border-red-500")
          }
          placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        />
        {!svcValid && (
          <p className="text-xs text-red-600 mt-1 inline-flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Not a valid Messaging Service SID
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className="w-full bg-brand-navy text-white font-bold py-3 rounded-lg hover:bg-brand-navy/90 disabled:opacity-50 transition flex items-center justify-center gap-2"
      >
        {pending ? "Saving..." : "Save SMS config"}
        {!pending && <Save className="h-4 w-4" />}
      </button>

      <p className="text-xs text-slate-400 text-center">
        Changes take effect immediately for the next SMS — no deploy needed.
      </p>
    </div>
  );
}
