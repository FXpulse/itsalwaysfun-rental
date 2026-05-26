"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Store, EyeOff } from "lucide-react";
import { setPackagesSectionEnabled } from "./actions";

export function PackagesSectionToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState(enabled);

  function toggle() {
    const next = !optimistic;
    setOptimistic(next);
    startTransition(async () => {
      const r = await setPackagesSectionEnabled(next);
      if (r.error) {
        toast.error(r.error);
        setOptimistic(!next);
        return;
      }
      toast.success(
        next
          ? "Packages section is now LIVE on the public site"
          : "Packages section hidden — page shows 'coming soon', nav link removed",
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
              Public Packages section ({optimistic ? "ON" : "OFF"})
            </div>
            <p className="text-xs text-slate-600">
              {optimistic
                ? "Customers see the /packages page + Packages link in the nav."
                : "/packages shows 'coming soon', the nav link is hidden. Per-package toggles below still work for when you turn this back on."}
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
