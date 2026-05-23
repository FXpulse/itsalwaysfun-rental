import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Booking } from "@/types/database";
import { ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: { status?: string; from?: string; to?: string };
}) {
  const supabase = createAdminClient();

  // Default range: from today to 90 days out
  const todayISO = new Date().toISOString().split("T")[0];
  const ninetyDays = new Date();
  ninetyDays.setDate(ninetyDays.getDate() + 90);
  const ninetyDaysISO = ninetyDays.toISOString().split("T")[0];

  const from = searchParams.from || todayISO;
  const to = searchParams.to || ninetyDaysISO;

  let query = supabase
    .from("bookings")
    .select("*")
    .gte("event_date", from)
    .lte("event_date", to)
    .order("event_date", { ascending: true });

  if (searchParams.status && searchParams.status !== "all") {
    query = query.eq("booking_status", searchParams.status);
  }

  const { data: bookings, error } = await query;

  if (error) {
    return <div className="card text-red-600">Error: {error.message}</div>;
  }

  const list = (bookings as Booking[]) || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy mb-1">Bookings</h1>
          <p className="text-sm text-slate-500">
            {list.length} bookings between {formatDate(from)} and {formatDate(to)}
          </p>
        </div>
        <Link
          href="/admin/bookings/new"
          className="btn-accent inline-flex items-center gap-2"
        >
          + New booking
        </Link>
      </div>

      {/* Filters */}
      <form className="card mb-6 flex flex-col md:flex-row gap-3 md:items-end">
        <div className="flex-1">
          <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
            From
          </label>
          <input type="date" name="from" defaultValue={from} className="input" />
        </div>
        <div className="flex-1">
          <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
            To
          </label>
          <input type="date" name="to" defaultValue={to} className="input" />
        </div>
        <div className="flex-1">
          <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
            Status
          </label>
          <select
            name="status"
            defaultValue={searchParams.status || "all"}
            className="input"
          >
            <option value="all">All statuses</option>
            <option value="pending_payment">Pending payment</option>
            <option value="confirmed">Confirmed</option>
            <option value="delivered">Delivered</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <button type="submit" className="btn-primary">
          Apply filters
        </button>
      </form>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {list.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            No bookings in this range. Once customers book on itsalwaysfun.net, they show up here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Customer</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Product</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Amount</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Payment</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Booking</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((b) => (
                  <tr key={b.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{formatDate(b.event_date)}</div>
                      {b.event_end_date && b.event_end_date !== b.event_date && (
                        <div className="text-xs text-purple-600 font-semibold">
                          → {formatDate(b.event_end_date)}
                          {(() => {
                            const days = Math.round(
                              (new Date(b.event_end_date).getTime() - new Date(b.event_date).getTime()) / 86400000
                            ) + 1;
                            return ` (${days} days)`;
                          })()}
                        </div>
                      )}
                      {b.start_time && (
                        <div className="text-xs text-slate-400">
                          {b.start_time}
                          {b.end_time && ` – ${b.end_time}`}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {b.customer_first_name} {b.customer_last_name}
                      </div>
                      <div className="text-xs text-slate-500">{b.customer_email}</div>
                    </td>
                    <td className="px-4 py-3">{b.product_name}</td>
                    <td className="px-4 py-3 font-mono">{formatCurrency(b.total_amount)}</td>
                    <td className="px-4 py-3">
                      <PaymentBadge status={b.stripe_payment_status} />
                    </td>
                    <td className="px-4 py-3">
                      <BookingBadge status={b.booking_status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/bookings/${b.id}`}
                        className="inline-flex items-center gap-1 text-brand-navy hover:underline text-sm"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 mt-4">
        Click <strong>View</strong> on any booking to manage it (mark as paid, change status, add notes).
      </p>
    </div>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:  { label: "Pending",   cls: "bg-amber-50 text-amber-700 border-amber-200" },
    paid:     { label: "Paid",      cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    refunded: { label: "Refunded",  cls: "bg-slate-100 text-slate-600 border-slate-200" },
    failed:   { label: "Failed",    cls: "bg-red-50 text-red-700 border-red-200" },
  };
  const s = map[status] || { label: status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded border ${s.cls}`}>
      {s.label}
    </span>
  );
}

function BookingBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending_payment: { label: "Pending pmt",  cls: "bg-amber-50 text-amber-700 border-amber-200" },
    confirmed:       { label: "Confirmed",    cls: "bg-blue-50 text-blue-700 border-blue-200" },
    delivered:       { label: "Delivered",    cls: "bg-purple-50 text-purple-700 border-purple-200" },
    completed:       { label: "Completed",    cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    cancelled:       { label: "Cancelled",    cls: "bg-slate-100 text-slate-500 border-slate-200" },
  };
  const s = map[status] || { label: status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded border ${s.cls}`}>
      {s.label}
    </span>
  );
}
