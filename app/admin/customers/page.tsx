import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus, Upload } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { formatCurrency } from "@/lib/utils";
import { CustomerSearch } from "./CustomerSearch";

export const dynamic = "force-dynamic";

export interface CustomerSummary {
  email: string;
  display_email: string; // original case
  first_name: string;
  last_name: string;
  phone: string;
  total_bookings: number;
  total_spent_cents: number;
  last_booking_date: string;
  first_booking_date: string;
  is_returning: boolean;
}

interface BookingRow {
  customer_email: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_phone: string;
  event_date: string;
  total_amount: number;
  stripe_payment_status: string;
  booking_status: string;
  created_at: string;
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string };
}) {
  // Staff or admin can view customers
  const me = await getCurrentUserRole();
  if (!me) redirect("/admin/login");

  const supabase = createAdminClient();

  // Pull ALL bookings (limit 5000 — when we cross that, paginate)
  const { data: rawBookings } = await supabase
    .from("bookings")
    .select(
      "customer_email, customer_first_name, customer_last_name, customer_phone, event_date, total_amount, stripe_payment_status, booking_status, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  const bookings: BookingRow[] = (rawBookings as BookingRow[]) || [];

  // Aggregate by email (lowercase)
  const map = new Map<string, CustomerSummary>();
  for (const b of bookings) {
    const key = (b.customer_email || "").toLowerCase().trim();
    if (!key) continue;
    const existing = map.get(key);
    const isPaid = b.stripe_payment_status === "paid" && b.booking_status !== "cancelled";

    if (!existing) {
      map.set(key, {
        email: key,
        display_email: b.customer_email,
        first_name: b.customer_first_name || "",
        last_name: b.customer_last_name || "",
        phone: b.customer_phone || "",
        total_bookings: 1,
        total_spent_cents: isPaid ? b.total_amount || 0 : 0,
        last_booking_date: b.event_date,
        first_booking_date: b.event_date,
        is_returning: false,
      });
    } else {
      existing.total_bookings += 1;
      if (isPaid) existing.total_spent_cents += b.total_amount || 0;
      if (b.event_date > existing.last_booking_date) existing.last_booking_date = b.event_date;
      if (b.event_date < existing.first_booking_date) existing.first_booking_date = b.event_date;
      // Latest booking wins for contact info (first iteration is most recent due to ORDER BY)
      // so we keep what's already there
    }
  }

  // Mark returning customers (>1 booking)
  let customers = Array.from(map.values()).map((c) => ({
    ...c,
    is_returning: c.total_bookings > 1,
  }));

  // Filter by search
  const q = (searchParams.q || "").toLowerCase().trim();
  if (q) {
    customers = customers.filter((c) => {
      const hay = `${c.first_name} ${c.last_name} ${c.email} ${c.phone}`.toLowerCase();
      return hay.includes(q);
    });
  }

  // Sort
  const sort = searchParams.sort || "recent";
  if (sort === "recent") {
    customers.sort((a, b) => b.last_booking_date.localeCompare(a.last_booking_date));
  } else if (sort === "spent") {
    customers.sort((a, b) => b.total_spent_cents - a.total_spent_cents);
  } else if (sort === "bookings") {
    customers.sort((a, b) => b.total_bookings - a.total_bookings);
  } else if (sort === "name") {
    customers.sort((a, b) =>
      `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`),
    );
  }

  // Aggregate stats
  const totalCustomers = customers.length;
  const totalReturning = customers.filter((c) => c.is_returning).length;
  const totalSpent = customers.reduce((s, c) => s + c.total_spent_cents, 0);

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy mb-1">Customers</h1>
          <p className="text-sm text-slate-500">
            Aggregated from bookings (grouped by email). Add manually below for portal-only customers.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/customers/bulk-import"
            className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold rounded-lg px-4 py-2 text-sm inline-flex items-center gap-1 shadow-sm"
          >
            <Upload className="h-4 w-4" /> Bulk import
          </Link>
          <Link
            href="/admin/customers/new"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg px-4 py-2 text-sm inline-flex items-center gap-1 shadow-sm"
          >
            <UserPlus className="h-4 w-4" /> Add customer
          </Link>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card py-3">
          <div className="text-xs text-slate-500 uppercase">Total customers</div>
          <div className="text-2xl font-bold text-brand-navy">{totalCustomers}</div>
        </div>
        <div className="card py-3">
          <div className="text-xs text-slate-500 uppercase">Returning</div>
          <div className="text-2xl font-bold text-brand-navy">
            {totalReturning}
            <span className="text-sm font-normal text-slate-400 ml-1">
              ({totalCustomers > 0 ? Math.round((totalReturning / totalCustomers) * 100) : 0}%)
            </span>
          </div>
        </div>
        <div className="card py-3">
          <div className="text-xs text-slate-500 uppercase">Lifetime revenue</div>
          <div className="text-2xl font-bold text-brand-navy">
            {formatCurrency(totalSpent)}
          </div>
        </div>
      </div>

      <CustomerSearch initialQuery={q} initialSort={sort} />

      {customers.length === 0 ? (
        <div className="card text-center text-slate-400 py-12">
          {q ? `No customers match "${q}"` : "No customers yet."}
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Contact</th>
                <th className="px-4 py-3 text-center">Bookings</th>
                <th className="px-4 py-3 text-right">Lifetime spent</th>
                <th className="px-4 py-3 text-left">Last booking</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.slice(0, 200).map((c) => (
                <tr key={c.email} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {c.first_name} {c.last_name}
                    </div>
                    {c.is_returning && (
                      <span className="inline-block text-[10px] bg-green-100 text-green-800 rounded px-1.5 py-0.5 mt-0.5">
                        Returning
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div>{c.display_email}</div>
                    <div className="text-slate-500">{c.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-center font-mono">{c.total_bookings}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-brand-navy">
                    {formatCurrency(c.total_spent_cents)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.last_booking_date}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/customers/${encodeURIComponent(c.email)}`}
                      className="text-xs text-brand-navy hover:underline"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {customers.length > 200 && (
            <div className="px-4 py-3 text-center text-xs text-slate-400 bg-slate-50 border-t">
              Showing 200 of {customers.length}. Refine search to see more.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
