"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarX, AlertCircle } from "lucide-react";
import { bulkBlockDateRange } from "./actions";

interface Product {
  id: string;
  is_active: boolean;
}

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function daysBetween(startISO: string, endISO: string): number {
  const s = new Date(startISO + "T00:00:00");
  const e = new Date(endISO + "T00:00:00");
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
  return Math.round((e.getTime() - s.getTime()) / 86400_000) + 1;
}

export function BulkBlockDateRange({ products }: { products: Product[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toISODate(d);
  }, []);
  const defaultEnd = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 8);
    return toISODate(d);
  }, []);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [reason, setReason] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);

  const activeCount = products.filter((p) => p.is_active).length;
  const totalCount = products.length;
  const productCount = includeInactive ? totalCount : activeCount;
  const dayCount = daysBetween(startDate, endDate);
  const totalOperations = productCount * dayCount;

  const rangeValid = dayCount > 0 && dayCount <= 90;

  function handleSubmit() {
    startTransition(async () => {
      const result = await bulkBlockDateRange({
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim() || null,
        include_inactive: includeInactive,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      const { blocked_count = 0, skipped_count = 0 } = result;
      if (blocked_count === 0 && skipped_count > 0) {
        toast.info(
          `Nothing new — all ${skipped_count} dates were already blocked.`,
        );
      } else if (skipped_count > 0) {
        toast.success(
          `Blocked ${blocked_count} new dates. Skipped ${skipped_count} already-blocked.`,
        );
      } else {
        toast.success(`Blocked ${blocked_count} dates across all products.`);
      }
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <>
      <div className="card border-l-4 border-l-red-400">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-brand-navy flex items-center gap-2">
              <CalendarX className="h-5 w-5 text-red-500" />
              Block a date range
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Block every active product for a range of days (vacation,
              off-season, event closure). Existing bookings on those days are
              left alone.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="bg-red-600 text-white hover:bg-red-700 text-sm font-semibold rounded-md px-4 py-2 inline-flex items-center gap-1.5"
          >
            <CalendarX className="h-4 w-4" /> Block date range…
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-brand-navy mb-1">
              Block date range across all products
            </h3>
            <p className="text-sm text-slate-500 mb-5">
              Every product will be blocked for every day in this range.
              Customers won't be able to book on these dates.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Start date
                </label>
                <input
                  type="date"
                  className="input"
                  value={startDate}
                  min={toISODate(new Date())}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  End date
                </label>
                <input
                  type="date"
                  className="input"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={pending}
                />
              </div>
            </div>

            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reason (shows on the calendar cell)
            </label>
            <input
              className="input mb-4"
              placeholder="e.g. Vacation, Closed for the holidays, Maintenance"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending}
            />

            <label className="flex items-center gap-2 text-sm text-slate-700 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                disabled={pending}
                className="h-4 w-4"
              />
              Also block inactive products (
              {totalCount - activeCount} inactive)
            </label>

            {rangeValid ? (
              <div className="bg-slate-50 border border-slate-200 rounded p-3 text-sm mb-5">
                <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">
                  Preview
                </div>
                <div className="text-slate-700">
                  Blocking <strong>{productCount}</strong> product
                  {productCount === 1 ? "" : "s"} × <strong>{dayCount}</strong>{" "}
                  day{dayCount === 1 ? "" : "s"} ={" "}
                  <strong>{totalOperations}</strong> block
                  {totalOperations === 1 ? "" : "s"}
                </div>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700 mb-5">
                {dayCount === 0
                  ? "End date must be on or after start date."
                  : "Range too large — maximum is 90 days."}
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800 mb-5 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                Existing bookings on these dates are <strong>not</strong>{" "}
                cancelled — they'll still appear on the calendar. This only
                stops <em>new</em> customers from booking these dates.
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
                disabled={pending}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="bg-red-600 text-white hover:bg-red-700 text-sm font-semibold rounded-md px-4 py-2 disabled:opacity-50"
                disabled={pending || !rangeValid || productCount === 0}
              >
                {pending
                  ? "Blocking…"
                  : `Block ${totalOperations} date${totalOperations === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
