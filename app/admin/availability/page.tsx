import { createAdminClient } from "@/lib/supabase/admin";
import { AvailabilityCalendar } from "./AvailabilityCalendar";
import { AvailabilityOverview } from "./AvailabilityOverview";
import { BulkBlockDateRange } from "./BulkBlockDateRange";
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

  if (productList.length === 0) {
    return <div className="card">No products to manage availability for.</div>;
  }

  const today = new Date();
  const threeMonthsLater = new Date(today);
  threeMonthsLater.setMonth(today.getMonth() + 3);
  const todayISO = today.toISOString().split("T")[0];
  const endISO = threeMonthsLater.toISOString().split("T")[0];

  // Default: "all" overview if no product param
  const isAllView = !searchParams.product;
  const selectedProductId = searchParams.product;

  if (isAllView) {
    // Fetch for ALL active products
    const activeIds = productList.filter((p) => p.is_active).map((p) => p.id);

    const [{ data: bookings }, { data: blocks }] = await Promise.all([
      supabase
        .from("bookings")
        .select("id, product_id, product_name, event_date, booking_status, customer_first_name, customer_last_name, hold_expires_at")
        .in("product_id", activeIds.length > 0 ? activeIds : ["00000000-0000-0000-0000-000000000000"])
        .gte("event_date", todayISO)
        .lte("event_date", endISO)
        .in("booking_status", ["pending_payment", "confirmed", "delivered", "completed"]),
      supabase
        .from("blocked_dates")
        .select("id, product_id, blocked_date, reason, created_by, products(name)")
        .in("product_id", activeIds.length > 0 ? activeIds : ["00000000-0000-0000-0000-000000000000"])
        .gte("blocked_date", todayISO)
        .lte("blocked_date", endISO),
    ]);

    // Normalize blocks to include product_name flat
    const blocksWithName = (blocks || []).map((b: any) => ({
      id: b.id,
      product_id: b.product_id,
      blocked_date: b.blocked_date,
      reason: b.reason,
      product_name: b.products?.name || "?",
    }));

    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy mb-1">Availability — All products</h1>
          <p className="text-sm text-slate-500">
            Overview of all active rentals. Click a day to see which products are booked or blocked.
          </p>
        </div>

        <BulkBlockDateRange
          products={productList.map((p) => ({ id: p.id, is_active: p.is_active }))}
        />

        <AvailabilityOverview
          products={productList}
          bookings={bookings || []}
          blocks={blocksWithName}
        />
      </div>
    );
  }

  // Single-product view (existing behavior)
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
      .eq("product_id", selectedProductId!)
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
        selectedProductId={selectedProductId!}
        bookings={bookings || []}
        blocks={blocks || []}
      />
    </div>
  );
}
