// Cash flow projection card — shows upcoming bookings bucketed by event_date.
// Confirmed (paid) vs Pending (awaiting payment).

import { computeCashFlowProjection } from "@/lib/reports-advanced";
import { formatCurrency } from "@/lib/utils";
import { Wallet, ArrowUpRight, Clock } from "lucide-react";

export async function CashFlowProjection() {
  const buckets = await computeCashFlowProjection();
  const totalConfirmed = buckets.reduce((s, b) => s + b.confirmed_cents, 0);
  const totalPending = buckets.reduce((s, b) => s + b.pending_cents, 0);
  const maxBar = Math.max(
    1,
    ...buckets.map((b) => b.confirmed_cents + b.pending_cents),
  );

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Wallet className="h-4 w-4 text-brand-navy/70" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-brand-navy/70">
          Cash flow projection (next 90 days)
        </h2>
      </div>
      <div className="card p-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded p-2">
            <div className="text-[10px] uppercase tracking-wide text-emerald-700 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" /> Confirmed (paid)
            </div>
            <div className="text-xl font-bold font-mono text-emerald-800 mt-0.5">
              {formatCurrency(totalConfirmed)}
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded p-2">
            <div className="text-[10px] uppercase tracking-wide text-amber-700 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Pending payment
            </div>
            <div className="text-xl font-bold font-mono text-amber-800 mt-0.5">
              {formatCurrency(totalPending)}
            </div>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-500">
              <th className="px-2 py-2 text-left">Bucket</th>
              <th className="px-2 py-2 text-right">Confirmed</th>
              <th className="px-2 py-2 text-right">Pending</th>
              <th className="px-2 py-2 text-right">Total</th>
              <th className="px-2 py-2 text-left">Distribution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {buckets.map((b) => {
              const total = b.confirmed_cents + b.pending_cents;
              const confirmedPct = (b.confirmed_cents / maxBar) * 100;
              const pendingPct = (b.pending_cents / maxBar) * 100;
              return (
                <tr key={b.bucket_label}>
                  <td className="px-2 py-2 text-xs">
                    <div className="font-medium">{b.bucket_label}</div>
                    <div className="text-[10px] text-slate-400">
                      {b.bookings_confirmed + b.bookings_pending} booking
                      {b.bookings_confirmed + b.bookings_pending === 1 ? "" : "s"}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-emerald-700">
                    {formatCurrency(b.confirmed_cents)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-amber-700">
                    {formatCurrency(b.pending_cents)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono font-bold text-brand-navy">
                    {formatCurrency(total)}
                  </td>
                  <td className="px-2 py-2 w-1/3">
                    <div className="h-4 bg-slate-100 rounded relative overflow-hidden flex">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${confirmedPct}%` }}
                        title={`Confirmed ${formatCurrency(b.confirmed_cents)}`}
                      />
                      <div
                        className="h-full bg-amber-400"
                        style={{ width: `${pendingPct}%` }}
                        title={`Pending ${formatCurrency(b.pending_cents)}`}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {totalConfirmed === 0 && totalPending === 0 && (
          <div className="text-center text-xs text-slate-400 py-4">
            No upcoming bookings in the next 90 days.
          </div>
        )}

        <p className="text-[10px] text-slate-400 mt-3">
          💡 Pending = bookings where Stripe payment hasn't cleared yet (cash on
          delivery, awaiting payment link, etc.). Treat it as <em>potential</em>,
          not guaranteed.
        </p>
      </div>
    </section>
  );
}
