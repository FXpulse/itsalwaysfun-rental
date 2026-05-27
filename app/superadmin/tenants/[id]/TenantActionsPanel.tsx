"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Pause, Play, ExternalLink } from "lucide-react";
import { suspendTenant, unsuspendTenant } from "./actions";

export function TenantActionsPanel({
  tenantId,
  isSuspended,
  suspendedReason,
  stripeCustomerId,
  stripeAccountId,
}: {
  tenantId: string;
  isSuspended: boolean;
  suspendedReason: string | null;
  stripeCustomerId: string | null;
  stripeAccountId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showSuspend, setShowSuspend] = useState(false);
  const [reason, setReason] = useState("");

  function handleSuspend() {
    if (!reason.trim()) {
      toast.error("Enter a reason");
      return;
    }
    startTransition(async () => {
      const r = await suspendTenant(tenantId, reason);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Tenant suspended");
      setShowSuspend(false);
      setReason("");
      router.refresh();
    });
  }

  function handleUnsuspend() {
    if (!confirm("Unsuspend this tenant? They'll regain full access immediately.")) return;
    startTransition(async () => {
      const r = await unsuspendTenant(tenantId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Tenant reactivated");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      {/* Suspend/unsuspend */}
      {isSuspended ? (
        <button
          onClick={handleUnsuspend}
          disabled={pending}
          className="inline-flex items-center gap-1 bg-emerald-600 text-white text-sm px-3 py-2 rounded hover:bg-emerald-700"
        >
          <Play className="h-3 w-3" /> Unsuspend tenant
        </button>
      ) : (
        <button
          onClick={() => setShowSuspend(true)}
          disabled={pending}
          className="inline-flex items-center gap-1 bg-red-600 text-white text-sm px-3 py-2 rounded hover:bg-red-700"
        >
          <Pause className="h-3 w-3" /> Suspend tenant
        </button>
      )}

      {/* Quick Stripe links */}
      <div className="flex gap-1 text-xs">
        {stripeCustomerId && (
          <a
            href={`https://dashboard.stripe.com/customers/${stripeCustomerId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-brand-navy inline-flex items-center gap-0.5 px-2 py-1 border border-slate-200 rounded"
          >
            Stripe customer <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {stripeAccountId && (
          <a
            href={`https://dashboard.stripe.com/connect/accounts/${stripeAccountId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-brand-navy inline-flex items-center gap-0.5 px-2 py-1 border border-slate-200 rounded"
          >
            Connect account <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Suspended reason callout */}
      {isSuspended && suspendedReason && (
        <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-900 max-w-xs text-right">
          <div className="font-bold mb-0.5">Suspended:</div>
          {suspendedReason}
        </div>
      )}

      {/* Suspend modal */}
      {showSuspend && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowSuspend(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-red-700 mb-2">Suspend tenant?</h2>
            <p className="text-sm text-slate-600 mb-3">
              Tenant + all their users lose access immediately. Reason is logged
              to audit_log. You can unsuspend any time.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Payment failed for 30+ days / TOS violation / Customer request..."
              rows={3}
              className="input w-full"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowSuspend(false)}
                className="text-sm text-slate-600 hover:text-slate-900 px-3 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleSuspend}
                disabled={pending || !reason.trim()}
                className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Suspending..." : "Suspend"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
