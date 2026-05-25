// Compute the aggregated truck load for a dispatch route.
// Sums inventory items needed across all stops (bookings) on that route.

import { createAdminClient } from "@/lib/supabase/admin";
import { getDeliveryChecklist, type ChecklistItem } from "@/lib/delivery-checklist";

export interface AggregatedItem {
  inventory_item_id: string;
  inventory_name: string;
  inventory_category: string;
  total_quantity: number;
  per_booking: { booking_id: string; product_name: string; quantity: number }[];
}

export interface RouteLoad {
  items: AggregatedItem[];
  total_bookings: number;
}

/** Get aggregated inventory load for all stops in a dispatch route. */
export async function getRouteLoad(routeId: string): Promise<RouteLoad> {
  const supabase = createAdminClient();

  const { data: stops } = await supabase
    .from("dispatch_stops")
    .select("booking_id, bookings!inner(product_name)")
    .eq("route_id", routeId)
    .order("stop_order");

  const stopList = (stops as any[]) || [];
  if (stopList.length === 0) return { items: [], total_bookings: 0 };

  // Compute checklist for each booking
  const byItem = new Map<string, AggregatedItem>();
  for (const s of stopList) {
    const checklist = await getDeliveryChecklist(s.booking_id);
    for (const it of checklist.items) {
      const existing = byItem.get(it.inventory_item_id);
      if (existing) {
        existing.total_quantity += it.quantity;
        existing.per_booking.push({
          booking_id: s.booking_id,
          product_name: s.bookings?.product_name || "(unknown)",
          quantity: it.quantity,
        });
      } else {
        byItem.set(it.inventory_item_id, {
          inventory_item_id: it.inventory_item_id,
          inventory_name: it.inventory_name,
          inventory_category: it.inventory_category,
          total_quantity: it.quantity,
          per_booking: [
            {
              booking_id: s.booking_id,
              product_name: s.bookings?.product_name || "(unknown)",
              quantity: it.quantity,
            },
          ],
        });
      }
    }
  }

  const items = Array.from(byItem.values()).sort((a, b) => {
    const c = a.inventory_category.localeCompare(b.inventory_category);
    return c !== 0 ? c : a.inventory_name.localeCompare(b.inventory_name);
  });

  return { items, total_bookings: stopList.length };
}
