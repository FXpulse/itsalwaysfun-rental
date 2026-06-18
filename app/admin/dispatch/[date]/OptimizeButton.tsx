"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, X, CheckCircle2, AlertCircle } from "lucide-react";
import { optimizeRoutesForDate, applyOptimizedPlan } from "../actions";
import type { OptimizationResult } from "@/lib/dispatch/optimize";

export function OptimizeButton({ routeDate }: { routeDate: string }) {
  const [plan, setPlan] = useState<OptimizationResult | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function runOptimize() {
    startTransition(async () => {
      toast.info("Asking the optimizer…", { duration: 1500 });
      const r = await optimizeRoutesForDate({ route_date: routeDate });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setPlan(r.result);
      setOpen(true);
      if (r.result.routes.length === 0) {
        toast.warning(
          r.result.warnings[0] ||
            "Optimizer produced no routes (no unassigned bookings, or nothing to fit).",
        );
      } else {
        toast.success(
          `Plan ready: ${r.result.routes.length} route${r.result.routes.length > 1 ? "s" : ""}, ${r.result.routes.reduce((s, x) => s + x.stops.length, 0)} stops`,
        );
      }
    });
  }

  function apply() {
    if (!plan) return;
    startTransition(async () => {
      const r = await applyOptimizedPlan({
        route_date: routeDate,
        routes: plan.routes.map((rt) => ({
          driver_email: rt.driver_email,
          driver_name: rt.driver_name,
          vehicle_id: rt.vehicle_id,
          trailer_id: rt.trailer_id,
          stops: rt.stops,
        })),
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(
        `Created ${r.routes_created} route${r.routes_created !== 1 ? "s" : ""} with ${r.stops_created} stops`,
      );
      setOpen(false);
      setPlan(null);
      // Page revalidation happens server-side; the auto-refresh hook on
      // /admin/dispatch picks it up shortly after, no manual reload needed.
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={runOptimize}
        disabled={pending}
        className="inline-flex items-center gap-1.5 bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white font-semibold text-sm px-3 py-2 rounded shadow disabled:opacity-50"
        title="Use AI to propose driver/vehicle assignments + stop order"
      >
        <Sparkles className="h-4 w-4" />
        {pending ? "Thinking…" : "Optimize routes"}
      </button>

      {open && plan && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-auto"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-lg max-w-3xl w-full p-5 shadow-xl my-8"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-600" />
                Proposed plan — {routeDate}
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-500 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              Model: <code>{plan.model_used}</code> · Generated{" "}
              {new Date(plan.generated_at).toLocaleTimeString()}
            </p>

            {plan.warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-3 text-xs">
                <div className="font-semibold text-amber-900 flex items-center gap-1 mb-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Warnings
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-amber-800">
                  {plan.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {plan.routes.length === 0 && (
              <div className="text-center text-sm text-slate-500 py-6">
                No routes to propose. Check that there are unassigned paid
                bookings and at least 1 active driver.
              </div>
            )}

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {plan.routes.map((r, i) => (
                <div
                  key={i}
                  className="border-2 border-violet-200 bg-violet-50 rounded p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-semibold text-violet-900">
                      Route {i + 1} → {r.driver_name}
                    </div>
                    <div className="text-xs text-violet-700">
                      {r.stops.length} stop{r.stops.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 italic mb-2">
                    {r.reasoning}
                  </div>
                  <ol className="text-xs space-y-0.5 list-decimal pl-5 text-slate-700">
                    {r.stops.map((s) => (
                      <li key={s.booking_id}>
                        <code className="text-[10px] bg-white px-1 rounded">
                          {s.booking_id.slice(0, 8)}
                        </code>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>

            {plan.unassigned_booking_ids.length > 0 && (
              <div className="mt-3 bg-slate-50 border border-slate-200 rounded p-3 text-xs">
                <div className="font-semibold text-slate-700 mb-1">
                  Unassigned ({plan.unassigned_booking_ids.length})
                </div>
                <div className="text-slate-600">
                  These bookings couldn't fit — they stay on the unassigned
                  list and you can place them manually.
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                disabled={pending}
                className="text-sm text-slate-600 px-3 py-2 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={apply}
                disabled={pending || plan.routes.length === 0}
                className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded text-sm inline-flex items-center gap-1"
              >
                <CheckCircle2 className="h-4 w-4" />
                {pending ? "Applying…" : `Apply ${plan.routes.length} route${plan.routes.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
