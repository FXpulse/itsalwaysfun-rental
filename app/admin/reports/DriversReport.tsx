// Top drivers report — driver_email × total hours × payroll dollars × bookings.
// Pulls from booking_expenses where category supports_payroll_hours.

import { computeTopDrivers } from "@/lib/reports-advanced";
import { formatCurrency } from "@/lib/utils";
import { HardHat } from "lucide-react";

export async function DriversReport({ from, to }: { from: string; to: string }) {
  const drivers = await computeTopDrivers(from, to);
  const totalHours = drivers.reduce((s, d) => s + d.total_hours, 0);
  const totalPayroll = drivers.reduce((s, d) => s + d.total_payroll_cents, 0);

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <HardHat className="h-4 w-4 text-brand-navy/70" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-brand-navy/70">
          Top drivers / crew (by labor hours in range)
        </h2>
      </div>
      <div className="card p-4">
        {drivers.length === 0 ? (
          <div className="text-center text-xs text-slate-400 py-6">
            No labor expenses with a driver_email tagged in this date range.
            <br />
            Tip: when adding a payroll/setup/teardown expense on a booking, fill in
            the driver email so it shows here.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-slate-50 border border-slate-200 rounded p-2 text-center">
                <div className="text-[10px] uppercase text-slate-500">Drivers</div>
                <div className="font-mono font-bold text-brand-navy">
                  {drivers.length}
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-2 text-center">
                <div className="text-[10px] uppercase text-slate-500">Total hours</div>
                <div className="font-mono font-bold text-brand-navy">
                  {totalHours.toFixed(1)}h
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-2 text-center">
                <div className="text-[10px] uppercase text-slate-500">Total payroll</div>
                <div className="font-mono font-bold text-brand-navy">
                  {formatCurrency(totalPayroll)}
                </div>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2 text-left">Driver</th>
                  <th className="px-2 py-2 text-right">Hours</th>
                  <th className="px-2 py-2 text-right">Payroll $</th>
                  <th className="px-2 py-2 text-right">$ / hr</th>
                  <th className="px-2 py-2 text-right">Bookings</th>
                  <th className="px-2 py-2 text-right">Expenses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drivers.map((d, i) => {
                  const ratePerHour =
                    d.total_hours > 0
                      ? d.total_payroll_cents / d.total_hours
                      : 0;
                  return (
                    <tr key={d.driver_email}>
                      <td className="px-2 py-2 text-xs">
                        <span className="text-slate-400 mr-2">#{i + 1}</span>
                        <a
                          href={`mailto:${d.driver_email}`}
                          className="text-brand-navy hover:underline"
                        >
                          {d.driver_email}
                        </a>
                      </td>
                      <td className="px-2 py-2 text-right font-mono">
                        {d.total_hours.toFixed(2)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono font-semibold text-brand-navy">
                        {formatCurrency(d.total_payroll_cents)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-slate-500">
                        {ratePerHour > 0 ? `$${(ratePerHour / 100).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-mono">{d.bookings}</td>
                      <td className="px-2 py-2 text-right font-mono text-slate-400">
                        {d.expense_lines}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-[10px] text-slate-400 mt-3">
              💡 Use this for payroll periods + 1099-NEC year-end. "$ / hr"
              shows the effective rate paid (in case a driver got a one-off
              bonus or different rate for a specific job).
            </p>
          </>
        )}
      </div>
    </section>
  );
}
