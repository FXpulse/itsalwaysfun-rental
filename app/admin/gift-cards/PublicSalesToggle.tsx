"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Store, EyeOff } from "lucide-react";
import { setGiftCardSalesEnabled } from "./actions";

export function PublicSalesToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState(enabled);

  function toggle() {
    const next = !optimistic;
    setOptimistic(next);
    startTransition(async () => {
      const r = await setGiftCardSalesEnabled(next);
      if (r.error) {
        toast.error(r.error);
        setOptimistic(!next);
        return;
      }
      toast.success(
        next
          ? "Public gift card sales ENABLED — /gift-cards is live"
          : "Public gift card sales DISABLED — customers see 'unavailable'",
      );
      router.refresh();
    });
  }

  return (
    <div
      className={`card mb-6 border-l-4 ${
        optimistic ? "border-l-green-500 bg-green-50/50" : "border-l-slate-400 bg-slate-50"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          {optimistic ? (
            <Store className="h-5 w-5 text-green-700 mt-0.5" />
          ) : (
            <EyeOff className="h-5 w-5 text-slate-500 mt-0.5" />
          )}
          <div>
            <div className="font-bold text-brand-navy">
              Public gift card sales ({optimistic ? "ON" : "OFF"})
            </div>
            <p className="text-xs text-slate-600">
              {optimistic
                ? "Customers can buy gift cards at /gift-cards via Stripe."
                : "/gift-cards page shows 'unavailable' to customers. You can still issue cards manually below."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          role="switch"
          aria-checked={optimistic}
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition flex-shrink-0 ${
            optimistic ? "bg-green-600" : "bg-slate-300"
          } ${pending ? "opacity-50" : ""}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
              optimistic ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
