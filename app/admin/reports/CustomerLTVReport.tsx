// Customer Lifetime Value — top 25 customers by all-time revenue.
// Independent of the date range (LTV is by definition cumulative).

import { computeCustomerLTV } from "@/lib/reports-advanced";
import { formatCurrency } from "@/lib/utils";
import { Award } from "lucide-react";

export async function CustomerLTVReport() {
  const customers = await computeCustomerLTV(25);
  const totalLTV = customers.reduce((s, c) => s + c.total_revenue_cents, 0);

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Award className="h-4 w-4 text-brand-navy/70" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-brand-navy/70">
          Top customers by lifetime value (all-time)
        </h2>
      </div>
      <div className="card p-0 overflow-hidden">
        {customers.length === 0 ? (
          <div className="text-center text-xs text-slate-400 py-6">
            No paid bookings on record yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500 bg-slate-50">
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-right">Bookings</th>
                <th className="px-3 py-2 text-right">LTV</th>
                <th className="px-3 py-2 text-right">Avg / booking</th>
                <th className="px-3 py-2 text-left">First / last</th>
                <th className="px-3 py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c, i) => {
                const isWhale = i < 3 && c.bookings >= 2;
                const isLapsed = c.days_since_last > 365;
                const isActive = c.days_since_last <= 90 && c.bookings >= 2;
                return (
                  <tr key={c.email}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs">#{i + 1}</span>
                        {isWhale && (
                          <span title="Top whale (top 3 by LTV with 2+ bookings)">
                            🐳
                          </span>
                        )}
                        <div>
                          <div className="font-medium text-sm">
                            {c.name || "(no name)"}
                          </div>
                          <a
                            href={`mailto:${c.email}`}
                            className="text-[11px] text-slate-500 hover:text-brand-navy hover:underline"
                          >
                            {c.email}
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{c.bookings}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-brand-navy">
                      {formatCurrency(c.total_revenue_cents)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-500">
                      {formatCurrency(c.avg_booking_cents)}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-slate-500">
                      <div>{c.first_booking_date}</div>
                      <div className="text-[10px] text-slate-400">
                        → {c.last_booking_date} ({c.days_since_last}d ago)
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isActive ? (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                          Active
                        </span>
                      ) : isLapsed ? (
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                          Lapsed 1yr+
                        </span>
                      ) : c.bookings === 1 ? (
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          One-time
                        </span>
                      ) : (
                        <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                          Returning
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-slate-50 font-bold">
                <td className="px-3 py-2 text-xs text-slate-600" colSpan={2}>
                  Top 25 LTV total
                </td>
                <td className="px-3 py-2 text-right font-mono text-brand-navy">
                  {formatCurrency(totalLTV)}
                </td>
                <td colSpan={3}></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
      <p className="text-[10px] text-slate-400 mt-2">
        💡 🐳 = top 3 customers with 2+ bookings. <strong>Lapsed 1yr+</strong> =
        good win-back candidates (send a "we miss you" coupon).{" "}
        <strong>Active</strong> = booked within last 90 days + repeat.
      </p>
    </section>
  );
}
