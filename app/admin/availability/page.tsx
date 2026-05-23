import { createAdminClient } from "@/lib/supabase/admin";
import { AvailabilityCalendar } from "./AvailabilityCalendar";
import type { Product } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: { product?: string };
}) {
  const supabase = createAdminClient();

  const { data: products } = await supabase
    .from("products")
    .select("id, name, slug, category, is_active")
    .order("category")
    .order("name");

  const productList = (products || []) as Pick<Product, "id" | "name" | "slug" | "category" | "is_active">[];
  const selectedProductId = searchParams.product || productList[0]?.id;

  if (!selectedProductId) {
    return <div className="card">No products to manage availability for.</div>;
  }

  // Compute the date range for the next 3 months
  const today = new Date();
  const threeMonthsLater = new Date(today);
  threeMonthsLater.setMonth(today.getMonth() + 3);
  const todayISO = today.toISOString().split("T")[0];
  const endISO = threeMonthsLater.toISOString().split("T")[0];

  // Fetch bookings + blocks for selected product
  const [{ data: bookings }, { data: blocks }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, event_date, booking_status, customer_first_name, customer_last_name, hold_expires_at")
      .eq("product_id", selectedProductId)
      .gte("event_date", todayISO)
      .lte("event_date", endISO)
      .in("booking_status", ["pending_payment", "confirmed", "delivered", "completed"]),
    supabase
      .from("blocked_dates")
      .select("id, blocked_date, reason, created_by")
      .eq("product_id", selectedProductId)
      .gte("blocked_date", todayISO)
      .lte("blocked_date", endISO),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-navy mb-1">Availability</h1>
      <p className="text-sm text-slate-500 mb-6">
        Manage which dates are blocked for maintenance, damaged units, or personal holds.
      </p>

      <AvailabilityCalendar
        products={productList}
        selectedProductId={selectedProductId}
        bookings={bookings || []}
        blocks={blocks || []}
      />
    </div>
  );
}
