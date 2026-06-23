// Monthly P&L table — last 12 months side by side: revenue, direct costs,
// gross profit, allocated overhead, net profit, bookings count.

import { computeMonthlyPnL } from "@/lib/reports-advanced";
import { formatCurrency } from "@/lib/utils";
import { CalendarRange } from "lucide-react";

export async function MonthlyPnLTable() {
  const months = await computeMonthlyPnL();

  // Totals row
  const totals = months.reduce(
    (acc, m) => {
      acc.revenue += m.revenue_cents;
      acc.directCosts += m.direct_costs_cents;
      acc.gross += m.gross_profit_cents;
      acc.operating += m.operating_expenses_cents;
      acc.overhead += m.overhead_cents;
      acc.net += m.net_profit_cents;
      acc.bookings += m.bookings;
      return acc;
    },
    { revenue: 0, directCosts: 0, gross: 0, operating: 0, overhead: 0, net: 0, bookings: 0 },
  );

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <CalendarRange className="h-4 w-4 text-brand-navy/70" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-brand-navy/70">
          Monthly P&amp;L (last 12 months)
        </h2>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-xs min-w-[800px]">
          <thead className="bg-slate-50 text-slate-600 uppercase text-[10px]">
            <tr>
              <th className="px-3 py-2 text-left sticky left-0 bg-slate-50 z-10">Line</th>
              {months.map((m) => (
                <th key={m.month} className="px-2 py-2 text-right whitespace-nowrap">
                  {m.label}
                </th>
              ))}
              <th className="px-3 py-2 text-right bg-slate-100 font-bold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            <tr>
              <td className="px-3 py-2 text-left text-slate-700 sticky left-0 bg-white z-10">
                Bookings
              </td>
              {months.map((m) => (
                <td key={m.month} className="px-2 py-2 text-right text-slate-500">
                  {m.bookings || "—"}
                </td>
              ))}
              <td className="px-3 py-2 text-right bg-slate-50 font-bold text-slate-700">
                {totals.bookings}
              </td>
            </tr>
            <tr className="bg-emerald-50/50">
              <td className="px-3 py-2 text-left text-emerald-900 sticky left-0 bg-emerald-50/50 z-10">
                Revenue
              </td>
              {months.map((m) => (
                <td
                  key={m.month}
                  className={`px-2 py-2 text-right ${m.revenue_cents > 0 ? "text-emerald-700" : "text-slate-300"}`}
                >
                  {m.revenue_cents > 0 ? formatCurrency(m.revenue_cents) : "—"}
                </td>
              ))}
              <td className="px-3 py-2 text-right bg-emerald-100 font-bold text-emerald-800">
                {formatCurrency(totals.revenue)}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-left text-red-900 sticky left-0 bg-white z-10">
                − Direct costs
              </td>
              {months.map((m) => (
                <td
                  key={m.month}
                  className={`px-2 py-2 text-right ${m.direct_costs_cents > 0 ? "text-red-700" : "text-slate-300"}`}
                >
                  {m.direct_costs_cents > 0 ? `-${formatCurrency(m.direct_costs_cents)}` : "—"}
                </td>
              ))}
              <td className="px-3 py-2 text-right bg-slate-50 font-bold text-red-700">
                -{formatCurrency(totals.directCosts)}
              </td>
            </tr>
            <tr className="bg-blue-50/50">
              <td className="px-3 py-2 text-left text-blue-900 sticky left-0 bg-blue-50/50 z-10">
                = Gross profit
              </td>
              {months.map((m) => (
                <td
                  key={m.month}
                  className={`px-2 py-2 text-right font-semibold ${
                    m.gross_profit_cents > 0
                      ? "text-blue-700"
                      : m.gross_profit_cents < 0
                        ? "text-amber-700"
                        : "text-slate-300"
                  }`}
                >
                  {m.revenue_cents > 0 ? formatCurrency(m.gross_profit_cents) : "—"}
                </td>
              ))}
              <td className="px-3 py-2 text-right bg-blue-100 font-bold text-blue-800">
                {formatCurrency(totals.gross)}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-left text-red-900 sticky left-0 bg-white z-10">
                − Operating expenses
              </td>
              {months.map((m) => (
                <td
                  key={m.month}
                  className={`px-2 py-2 text-right ${m.operating_expenses_cents > 0 ? "text-red-700" : "text-slate-300"}`}
                >
                  {m.operating_expenses_cents > 0 ? `-${formatCurrency(m.operating_expenses_cents)}` : "—"}
                </td>
              ))}
              <td className="px-3 py-2 text-right bg-slate-50 font-bold text-red-700">
                -{formatCurrency(totals.operating)}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-left text-red-900 sticky left-0 bg-white z-10">
                − Overhead
              </td>
              {months.map((m) => (
                <td
                  key={m.month}
                  className={`px-2 py-2 text-right ${m.overhead_cents > 0 ? "text-red-700" : "text-slate-300"}`}
                >
                  {m.overhead_cents > 0 ? `-${formatCurrency(m.overhead_cents)}` : "—"}
                </td>
              ))}
              <td className="px-3 py-2 text-right bg-slate-50 font-bold text-red-700">
                -{formatCurrency(totals.overhead)}
              </td>
            </tr>
            <tr className="bg-emerald-50">
              <td className="px-3 py-2 text-left font-bold text-emerald-900 sticky left-0 bg-emerald-50 z-10">
                = NET
              </td>
              {months.map((m) => (
                <td
                  key={m.month}
                  className={`px-2 py-2 text-right font-bold ${
                    m.net_profit_cents > 0
                      ? "text-emerald-700"
                      : m.net_profit_cents < 0
                        ? "text-amber-700"
                        : "text-slate-300"
                  }`}
                >
                  {m.revenue_cents > 0 || m.overhead_cents > 0 || m.operating_expenses_cents > 0
                    ? formatCurrency(m.net_profit_cents)
                    : "—"}
                </td>
              ))}
              <td className="px-3 py-2 text-right bg-emerald-200 font-bold text-emerald-900">
                {formatCurrency(totals.net)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-400 mt-2">
        💡 12-month trailing view. Revenue is paid bookings by event_date.
        Overhead is the proration of monthly fixed costs for each month.
        Independent of the date range above.
      </p>
    </section>
  );
}
