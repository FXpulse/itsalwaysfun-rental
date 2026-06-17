"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { setRequireAdminMfa } from "./actions";

export function RequireMfaToggle({
  initialValue,
  currentUserHasFactor,
}: {
  initialValue: boolean;
  currentUserHasFactor: boolean;
}) {
  const [enabled, setEnabled] = useState(initialValue);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    // Guardrail: don't let the admin enable this until THEY have 2FA enrolled.
    // Otherwise they'd lock themselves out immediately on next page load.
    if (next && !currentUserHasFactor) {
      toast.error("Enroll your own 2FA below first, then turn this on.");
      return;
    }
    startTransition(async () => {
      const r = await setRequireAdminMfa(next);
      if ((r as any).error) {
        toast.error((r as any).error || "Could not save");
        return;
      }
      setEnabled(next);
      toast.success(
        next
          ? "2FA is now required for all admins in this account."
          : "2FA requirement disabled. Admins can sign in without 2FA again.",
      );
    });
  }

  return (
    <div className="bg-white border-2 border-slate-200 rounded-lg p-5 mb-6">
      <div className="flex items-start gap-4">
        <div className="bg-brand-yellow/30 text-brand-navy rounded p-2 shrink-0">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-slate-800 text-base mb-1">
            Require 2FA for all admins
          </h3>
          <p className="text-sm text-slate-600 mb-3">
            When this is on, any admin who tries to use the dashboard
            without 2FA enrolled is sent here until they enroll. Staff
            role is not affected.
          </p>
          {!currentUserHasFactor && (
            <p className="text-xs bg-amber-50 border border-amber-200 rounded p-2 text-amber-800 mb-3">
              ⚠️ Enroll your own 2FA below first. Then you can turn this on
              without locking yourself out.
            </p>
          )}
          <label className="inline-flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              disabled={pending}
              onChange={(e) => toggle(e.target.checked)}
              className="h-5 w-5 accent-brand-navy"
            />
            <span className="text-sm font-medium">
              {enabled ? "Required (on)" : "Optional (off)"}
            </span>
            {pending && (
              <span className="text-xs text-slate-500">saving…</span>
            )}
          </label>
        </div>
      </div>
    </div>
  );
}
