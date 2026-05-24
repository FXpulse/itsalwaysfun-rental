import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";
import { Calendar, Package, DollarSign, Gift, ArrowRight, Sparkles } from "lucide-react";

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

export default async function PortalHome() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return null;

  const admin = createAdminClient();
  const { data: bookings } = await admin
    .from("bookings")
    .select(
      "id, event_date, event_end_date, product_name, total_amount, stripe_payment_status, booking_status, created_at",
    )
    .ilike("customer_email", user.email)
    .order("event_date", { ascending: false })
    .limit(50);

  const list = bookings || [];
  const paid = list.filter(
    (b: any) => b.stripe_payment_status === "paid" && b.booking_status !== "cancelled",
  );
  const totalSpent = paid.reduce((s: number, b: any) => s + (b.total_amount || 0), 0);
  const totalBookings = paid.length;
  const isReturning = totalBookings >= 1;
  const firstName = (user.user_metadata?.first_name as string) || user.email.split("@")[0];
  const recentBookings = list.slice(0, 3);

  // Look up any active "returning customer" coupon in the DB. If present, surface it.
  const { data: loyaltyCoupon } = await admin
    .from("coupons")
    .select("code, description, discount_type, discount_value")
    .ilike("code", "LOYAL%")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold text-brand-navy">
          Welcome back, {firstName}!
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {isReturning
            ? `Customer since ${list[list.length - 1]?.event_date || "today"}`
            : "Ready to plan your next event?"}
        </p>
      </div>

      {/* Loyalty banner */}
      {isReturning && loyaltyCoupon && (
        <div className="card bg-gradient-to-r from-brand-navy to-brand-navy-dark text-white border-0">
          <div className="flex items-start gap-3">
            <Sparkles className="h-6 w-6 text-brand-yellow flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="font-bold text-lg mb-1">Loyal customer reward 🎉</h2>
              <p className="text-sm text-white/80 mb-3">
                {loyaltyCoupon.description ||
                  `Thanks for booking with us again! Use the code below at checkout.`}
              </p>
              <div className="inline-block bg-brand-yellow text-brand-navy font-mono font-bold text-lg px-4 py-2 rounded">
                {loyaltyCoupon.code}
              </div>
              <p className="text-xs text-white/60 mt-2">
                {loyaltyCoupon.discount_type === "percent"
                  ? `${loyaltyCoupon.discount_value}% off your next rental`
                  : `${formatCurrency(loyaltyCoupon.discount_value)} off your next rental`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {isReturning && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard icon={Package} label="Bookings" value={String(totalBookings)} />
          <StatCard icon={DollarSign} label="Total spent" value={formatCurrency(totalSpent)} />
          <StatCard
            icon={Calendar}
            label="Next event"
            value={
              list.find((b: any) => new Date(b.event_date) >= new Date())?.event_date || "—"
            }
          />
        </div>
      )}

      {/* Quick action */}
      <div className="card flex items-center justify-between">
        <div>
          <h2 className="font-bold text-brand-navy">Ready to rent again?</h2>
          <p className="text-sm text-slate-500">
            Fast checkout — we'll fill in your info automatically.
          </p>
        </div>
        <Link href="/order-by-date" className="btn-primary inline-flex items-center gap-2">
          Book a rental <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Recent bookings */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-brand-navy">Recent bookings</h2>
          {list.length > 3 && (
            <Link
              href="/portal/bookings"
              className="text-sm text-brand-navy hover:underline inline-flex items-center gap-1"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        {recentBookings.length === 0 ? (
          <div className="card text-center py-12 text-slate-400">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="mb-3">No bookings yet — let's plan your first one!</p>
            <Link href="/order-by-date" className="btn-primary inline-block">
              Browse rentals
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentBookings.map((b: any) => (
              <Link
                key={b.id}
                href={`/portal/bookings/${b.id}`}
                className="card hover:shadow-md transition flex items-center justify-between gap-3 p-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-brand-navy truncate">
                    {b.product_name}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {b.event_date}
                    {b.event_end_date && b.event_end_date !== b.event_date && (
                      <> → {b.event_end_date}</>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold text-brand-navy">
                    {formatCurrency(b.total_amount || 0)}
                  </div>
                  <span
                    className={`inline-block text-[10px] rounded px-2 py-0.5 mt-1 ${STATUS_STYLES[b.booking_status] || ""}`}
                  >
                    {STATUS_LABEL[b.booking_status] || b.booking_status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="card py-3">
      <div className="flex items-center gap-2 text-xs text-slate-500 uppercase">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-xl font-bold text-brand-navy mt-1">{value}</div>
    </div>
  );
}
