import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, DollarSign, Package } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  pending_payment: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  delivered: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-slate-200 text-slate-600",
};

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  paid: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
  refunded: "bg-slate-200 text-slate-600",
};

export default async function CustomerDetailPage({
  params,
}: {
  params: { email: string };
}) {
  const me = await getCurrentUserRole();
  if (!me) redirect("/admin/login");

  const email = decodeURIComponent(params.email).toLowerCase();
  if (!email || !email.includes("@")) notFound();

  const supabase = createAdminClient();
  const { data: rawBookings } = await supabase
    .from("bookings")
    .select("*")
    .ilike("customer_email", email)
    .order("event_date", { ascending: false });

  const bookings = rawBookings || [];
  if (bookings.length === 0) notFound();

  const latest = bookings[0];
  const firstBookingDate = bookings[bookings.length - 1].event_date;
  const totalBookings = bookings.length;
  const paidBookings = bookings.filter(
    (b: any) => b.stripe_payment_status === "paid" && b.booking_status !== "cancelled",
  );
  const totalSpent = paidBookings.reduce((s: number, b: any) => s + (b.total_amount || 0), 0);
  const avgBooking = paidBookings.length > 0 ? Math.round(totalSpent / paidBookings.length) : 0;

  // Product breakdown
  const byProduct = new Map<string, { name: string; count: number }>();
  bookings.forEach((b: any) => {
    const k = b.product_name || "(unknown)";
    const entry = byProduct.get(k) || { name: k, count: 0 };
    entry.count += 1;
    byProduct.set(k, entry);
  });
  const topProducts = Array.from(byProduct.values()).sort((a, b) => b.count - a.count);

  return (
    <div className="max-w-5xl">
      <Link
        href="/admin/customers"
        className="text-sm text-slate-500 hover:text-brand-navy inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-3 w-3" /> Back to customers
      </Link>

      <h1 className="text-2xl font-bold text-brand-navy mb-1">
        {latest.customer_first_name} {latest.customer_last_name}
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Customer since {firstBookingDate}
        {totalBookings > 1 && (
          <span className="inline-block text-[10px] bg-green-100 text-green-800 rounded px-2 py-0.5 ml-2 align-middle">
            Returning ×{totalBookings}
          </span>
        )}
      </p>

      {/* Contact + stats */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <div className="card">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">
            Contact
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-400" />
              <a href={`mailto:${latest.customer_email}`} className="hover:underline">
                {latest.customer_email}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-slate-400" />
              <a href={`tel:${latest.customer_phone}`} className="hover:underline">
                {latest.customer_phone}
              </a>
            </div>
            {latest.customer_address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                <span className="text-slate-700">{latest.customer_address}</span>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">
            Lifetime stats
          </h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-slate-500 flex items-center gap-1">
                <Package className="h-3 w-3" /> Bookings
              </div>
              <div className="text-xl font-bold text-brand-navy">{totalBookings}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Total spent
              </div>
              <div className="text-xl font-bold text-brand-navy">
                {formatCurrency(totalSpent)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Avg booking</div>
              <div className="text-sm font-semibold text-slate-700">
                {formatCurrency(avgBooking)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Last booking
              </div>
              <div className="text-sm font-semibold text-slate-700">{latest.event_date}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Top products for this customer */}
      {topProducts.length > 1 && (
        <div className="card mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">
            Favorite rentals
          </h2>
          <div className="flex flex-wrap gap-2">
            {topProducts.slice(0, 6).map((p) => (
              <span
                key={p.name}
                className="text-xs bg-slate-100 text-slate-700 rounded-full px-3 py-1"
              >
                {p.name} <span className="text-slate-400">×{p.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Booking history */}
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">
        All bookings ({totalBookings})
      </h2>
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Event date</th>
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-left">Payment</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bookings.map((b: any) => (
              <tr key={b.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">{b.event_date}</td>
                <td className="px-4 py-3">{b.product_name}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatCurrency(b.total_amount || 0)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs rounded px-2 py-0.5 ${PAYMENT_STATUS_STYLES[b.stripe_payment_status] || ""}`}
                  >
                    {b.stripe_payment_status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs rounded px-2 py-0.5 ${STATUS_STYLES[b.booking_status] || ""}`}
                  >
                    {b.booking_status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/bookings/${b.id}`}
                    className="text-xs text-brand-navy hover:underline"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
