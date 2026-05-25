import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Package,
  Repeat,
  CheckCircle2,
} from "lucide-react";
import { BookingActionsCustomer } from "./BookingActionsCustomer";

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

export default async function PortalBookingDetail({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return null;

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("*")
    .eq("id", params.id)
    .single();

  // Only allow viewing your own bookings (email match)
  if (!booking || booking.customer_email.toLowerCase() !== user.email.toLowerCase()) {
    notFound();
  }

  // Look up the product slug for rebook link
  let rebookHref = "/order-by-date";
  if (booking.product_id) {
    const { data: prod } = await admin
      .from("products")
      .select("slug")
      .eq("id", booking.product_id)
      .single();
    if (prod?.slug) {
      rebookHref = `/order-by-date?product=${prod.slug}`;
    }
  }

  const isPaid = booking.stripe_payment_status === "paid";
  const isCancelled = booking.booking_status === "cancelled";

  return (
    <div className="max-w-3xl">
      <Link
        href="/portal/bookings"
        className="text-sm text-slate-500 hover:text-brand-navy inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-3 w-3" /> Back to bookings
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">{booking.product_name}</h1>
          <p className="text-sm text-slate-500 mt-1">
            Booked on {new Date(booking.created_at).toLocaleDateString()}
          </p>
        </div>
        <span
          className={`text-xs rounded px-3 py-1 ${STATUS_STYLES[booking.booking_status] || ""}`}
        >
          {STATUS_LABEL[booking.booking_status] || booking.booking_status}
        </span>
      </div>

      {isPaid && !isCancelled && (
        <div className="card bg-green-50 border-green-200 mb-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <p className="text-sm text-green-900">
              Payment received — {formatCurrency(booking.total_amount || 0)} on{" "}
              {new Date(booking.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">
            Event
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-slate-400 mt-0.5" />
              <div>
                <div className="font-semibold">
                  {new Date(booking.event_date + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
                {booking.event_end_date && booking.event_end_date !== booking.event_date && (
                  <div className="text-slate-500 text-xs">
                    Multi-day until{" "}
                    {new Date(booking.event_end_date + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </div>
                )}
              </div>
            </div>
            {(booking.start_time || booking.end_time) && (
              <div className="flex items-center gap-2 text-slate-700">
                <Clock className="h-4 w-4 text-slate-400" />
                {booking.start_time} – {booking.end_time}
              </div>
            )}
            {booking.customer_address && (
              <div className="flex items-start gap-2 text-slate-700">
                <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                {booking.customer_address}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">
            Order
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-slate-400" />
              <span className="font-semibold">{booking.product_name}</span>
            </div>
            <div className="flex justify-between border-t pt-2 mt-2">
              <span className="text-slate-600">Total paid</span>
              <span className="font-mono font-semibold text-brand-navy">
                {formatCurrency(booking.total_amount || 0)}
              </span>
            </div>
            {booking.discount_amount > 0 && (
              <div className="flex justify-between text-xs text-amber-700">
                <span>Discount{booking.coupon_code && ` (${booking.coupon_code})`}</span>
                <span>-{formatCurrency(booking.discount_amount)}</span>
              </div>
            )}
            <div className="text-xs text-slate-400 pt-2 border-t">
              {booking.payment_method === "stripe" || !booking.payment_method
                ? "Paid online (card)"
                : `Paid via ${booking.payment_method}`}
            </div>
          </div>
        </div>
      </div>

      {/* Customer actions: confirm / modify date / cancel */}
      <div className="mb-6">
        <BookingActionsCustomer
          bookingId={booking.id}
          eventDate={booking.event_date}
          eventEndDate={booking.event_end_date}
          startTime={booking.start_time}
          bookingStatus={booking.booking_status}
          customerConfirmedAt={booking.customer_confirmed_at || null}
        />
      </div>

      {/* Rebook CTA */}
      {!isCancelled && (
        <div className="card border-brand-yellow border-2 bg-brand-yellow/5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-brand-navy mb-1 flex items-center gap-2">
                <Repeat className="h-4 w-4" /> Loved this rental?
              </h2>
              <p className="text-sm text-slate-600">
                Rebook with one click — we'll fill in your info automatically.
              </p>
            </div>
            <Link href={rebookHref} className="btn-primary whitespace-nowrap">
              Book again
            </Link>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-slate-400 mt-6">
        Questions about this booking? Call <strong>(904) 584-3047</strong>
      </p>
    </div>
  );
}
