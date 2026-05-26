"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ShieldCheck, EyeOff } from "lucide-react";
import { setCoiRequestEnabled } from "./actions";

export function CoiRequestToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState(enabled);

  function toggle() {
    const next = !optimistic;
    setOptimistic(next);
    startTransition(async () => {
      const r = await setCoiRequestEnabled(next);
      if (r.error) {
        toast.error(r.error);
        setOptimistic(!next);
        return;
      }
      toast.success(
        next
          ? "COI request option is now LIVE at checkout"
          : "COI request hidden — customers won't see the venue-COI checkbox",
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
            <ShieldCheck className="h-5 w-5 text-green-700 mt-0.5" />
          ) : (
            <EyeOff className="h-5 w-5 text-slate-500 mt-0.5" />
          )}
          <div>
            <div className="font-bold text-brand-navy">
              COI request at checkout ({optimistic ? "ON" : "OFF"})
            </div>
            <p className="text-xs text-slate-600">
              {optimistic
                ? 'Customers see the "My venue requires a Certificate of Insurance" checkbox during checkout — submissions land here.'
                : "The checkbox is hidden from checkout. Existing requests below are still managed normally — only the public option is off."}
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
