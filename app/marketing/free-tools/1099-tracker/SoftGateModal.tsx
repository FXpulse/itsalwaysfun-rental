"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { Summary } from "@/lib/marketing/1099-tracker-logic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export function SoftGateModal({
  open,
  onClose,
  summary,
  ref_,
}: {
  open: boolean;
  onClose: () => void;
  summary: Summary;
  ref_: string | null;
}) {
  const [email, setEmail] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = email.trim();
    if (!EMAIL_RE.test(v)) {
      toast.error("That email looks wrong — check it?");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/free-tools/1099-tracker/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: v,
          summary: {
            tax_year: summary.taxYear,
            driver_count: summary.driverCount,
            drivers_over_threshold: summary.driversOverThreshold,
            total_paid_cents: summary.totalPaidCents,
          },
          marketing_opt_in: optIn,
          source: "free_tools/1099-tracker",
          ref: ref_ || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 429) {
          toast.error("Too many requests — try again in an hour.");
        } else {
          toast.error(data?.error === "invalid_email" ? "Invalid email" : "Couldn't save, try again");
        }
        return;
      }
      toast.success("Sent ✅ Check your inbox in ~2 min");
      onClose();
    } catch {
      toast.error("Network issue — try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-brand-navy">📧 Send to inbox?</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-slate-600 mb-3">We'll email you:</p>
        <ul className="text-sm text-slate-700 space-y-1 mb-4 list-disc list-inside">
          <li>CSV of your tracker (today's snapshot)</li>
          <li>3-email tax season tips series</li>
          <li>Reminder before Jan 31 deadline</li>
        </ul>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            autoFocus
            required
            placeholder="you@yourbusiness.com"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={optIn}
              onChange={(e) => setOptIn(e.target.checked)}
              disabled={submitting}
              className="mt-0.5"
            />
            Yes, email me RentalFlow updates too (you can unsub anytime).
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-slate-500 px-3 py-2 hover:text-slate-700"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary inline-flex items-center gap-1"
              disabled={submitting}
            >
              {submitting ? "Sending…" : "Send →"}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
            We only store your email. Driver data stays in your browser.
          </p>
        </form>
      </div>
    </div>
  );
}
