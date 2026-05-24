import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";
import { ArrowRight, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Pending payment",
  confirmed: "Confirmed",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<string, string> = {
  pending_payment: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  delivered: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-slate-200 text-slate-600",
};

export default async function PortalBookingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return null;

  const admin = createAdminClient();
  const { data: bookings } = await admin
    .from("bookings")
    .select("*")
    .ilike("customer_email", user.email)
    .order("event_date", { ascending: false })
    .limit(200);

  const list = bookings || [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-navy mb-1">All bookings</h1>
      <p className="text-sm text-slate-500 mb-6">
        Past, current, and upcoming rentals tied to <strong>{user.email}</strong>.
      </p>

      {list.length === 0 ? (
        <div className="card text-center py-12 text-slate-400">
          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="mb-3">No bookings yet.</p>
          <Link href="/order-by-date" className="btn-primary inline-block">
            Browse rentals
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Event</th>
                <th className="px-4 py-3 text-left">Rental</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((b: any) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="text-sm">{b.event_date}</div>
                    {b.event_end_date && b.event_end_date !== b.event_date && (
                      <div className="text-xs text-slate-500">→ {b.event_end_date}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">{b.product_name}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCurrency(b.total_amount || 0)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs rounded px-2 py-0.5 ${STATUS_STYLES[b.booking_status] || ""}`}
                    >
                      {STATUS_LABEL[b.booking_status] || b.booking_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/portal/bookings/${b.id}`}
                      className="text-xs text-brand-navy hover:underline inline-flex items-center gap-1"
                    >
                      View <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
