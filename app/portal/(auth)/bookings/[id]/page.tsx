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
import { WeatherCancelPanel } from "./WeatherCancelPanel";
import { TrackingTimeline, type TrackingStop } from "./TrackingTimeline";
import { ExtendRentalPanel } from "./ExtendRentalPanel";
import { isStripeConfigured } from "@/lib/stripe/server";

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

  // Weather cancellation settings
  const { data: weatherRows } = await admin
    .from("site_settings")
    .select("key, value")
    .in("key", [
      "weather_cancellation_enabled",
      "weather_cancellation_cutoff_hours",
      "weather_cancellation_policy_text",
    ]);
  const weatherMap = new Map((weatherRows as any[] || []).map((r) => [r.key, r.value]));
  const weatherEnabled =
    (weatherMap.get("weather_cancellation_enabled") || "true").toLowerCase() !== "false";
  const weatherCutoff = parseInt(weatherMap.get("weather_cancellation_cutoff_hours") || "6", 10) || 6;
  const weatherPolicy = weatherMap.get("weather_cancellation_policy_text") || "";

  // COI request status for this booking (if any)
  const { data: coiRow } = await admin
    .from("coi_requests")
    .select("status, venue_name, coi_file_url, uploaded_at")
    .eq("booking_id", booking.id)
    .maybeSingle();

  // Dispatch stops + route info for the tracking timeline (delivery + pickup)
  const { data: stopRows } = await admin
    .from("dispatch_stops")
    .select(
      `status, route_id,
       dispatch_routes!inner ( route_type, status, driver_name, vehicles ( name ) )`,
    )
    .eq("booking_id", booking.id);

  let deliveryStop: TrackingStop | null = null;
  let pickupStop: TrackingStop | null = null;
  for (const s of (stopRows as any[]) || []) {
    const route = s.dispatch_routes;
    if (!route) continue;
    const ts: TrackingStop = {
      // Route status (planned/loaded/out_for_delivery/completed) is what
      // moves through the day — surface that to the customer.
      status: (route.status || "pending") as TrackingStop["status"],
      type: route.route_type,
      driver_name: route.driver_name || null,
      vehicle_name: route.vehicles?.name || null,
    };
    if (route.route_type === "pickup") pickupStop = ts;
    else deliveryStop = ts;
  }

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

      {/* Customer tracking timeline — "where is my rental right now?" */}
      <div className="mb-6">
        <TrackingTimeline
          bookingStatus={booking.booking_status}
          paymentStatus={booking.stripe_payment_status}
          eventDate={booking.event_date}
          eventEndDate={booking.event_end_date}
          cancelledDueToWeather={booking.cancelled_due_to_weather || false}
          deliveryStop={deliveryStop}
          pickupStop={pickupStop}
        />
      </div>

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
      <div className="mb-6 space-y-3">
        <BookingActionsCustomer
          bookingId={booking.id}
          eventDate={booking.event_date}
          eventEndDate={booking.event_end_date}
          startTime={booking.start_time}
          bookingStatus={booking.booking_status}
          customerConfirmedAt={booking.customer_confirmed_at || null}
        />
        {weatherEnabled && (
          <WeatherCancelPanel
            bookingId={booking.id}
            eventDate={booking.event_date}
            startTime={booking.start_time}
            bookingStatus={booking.booking_status}
            paidAmount={booking.total_amount}
            paymentStatus={booking.stripe_payment_status}
            cutoffHours={weatherCutoff}
            policyText={weatherPolicy}
          />
        )}
        {booking.cancelled_due_to_weather && booking.weather_credit_cents > 0 && (
          <div className="card bg-blue-50 border-blue-200">
            <p className="text-sm text-blue-900">
              <strong>Weather cancellation processed.</strong> Your{" "}
              {formatCurrency(booking.weather_credit_cents)} gift card credit
              was emailed to you and is valid for 1 year.
            </p>
          </div>
        )}

        <ExtendRentalPanel
          bookingId={booking.id}
          currentEndDate={booking.event_end_date || booking.event_date}
          eventDate={booking.event_date}
          startTime={booking.start_time}
          bookingStatus={booking.booking_status}
          paymentStatus={booking.stripe_payment_status}
          stripeConfigured={isStripeConfigured()}
          stripePublishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""}
        />

        {coiRow && (
          <div className="card border-blue-200 bg-blue-50/50">
            <div className="flex items-start gap-3">
              <div className="text-2xl">📄</div>
              <div className="flex-1">
                <h3 className="font-bold text-brand-navy mb-1">
                  Certificate of Insurance — {coiRow.venue_name}
                </h3>
                {coiRow.status === "requested" && (
                  <p className="text-sm text-amber-800">
                    <strong>Requested.</strong> We're generating it with our
                    broker — usually ready within 1-2 business days. You'll get
                    an email when it's ready.
                  </p>
                )}
                {(coiRow.status === "uploaded" || coiRow.status === "delivered_to_venue") && coiRow.coi_file_url && (
                  <>
                    <p className="text-sm text-green-800 mb-2">
                      <strong>Ready!</strong> Uploaded{" "}
                      {coiRow.uploaded_at && new Date(coiRow.uploaded_at).toLocaleDateString()}.
                      Download below and forward to your venue.
                    </p>
                    <a
                      href={coiRow.coi_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-brand-navy text-white text-sm font-semibold rounded px-3 py-1.5 hover:bg-brand-navy-dark"
                    >
                      Download COI →
                    </a>
                  </>
                )}
                {coiRow.status === "cancelled" && (
                  <p className="text-sm text-slate-600">
                    Request was cancelled. Call us if you still need a COI.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
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
