// Compute the delivery checklist for a booking based on the product's
// inventory requirements + booking conditions (surface + needs_power_supply).

import { createAdminClient } from "@/lib/supabase/admin";

export interface ChecklistItem {
  requirement_id: string;
  inventory_item_id: string;
  inventory_name: string;
  inventory_category: string;
  quantity: number;
  notes: string | null;
  reason: string; // why this item is in the list (debug/transparency)
}

interface RequirementRow {
  id: string;
  inventory_item_id: string;
  quantity: number;
  surface_types: string[] | null;
  only_when_needs_power: boolean;
  per_day: boolean;
  notes: string | null;
  inventory_items: {
    id: string;
    name: string;
    category: string;
  } | null;
}

interface BookingRow {
  product_id: string | null;
  surface_type: string | null;
  needs_power_supply: boolean | null;
  event_date: string;
  event_end_date: string | null;
}

function rentalDays(eventDate: string, eventEndDate: string | null): number {
  if (!eventEndDate || eventEndDate === eventDate) return 1;
  const s = new Date(eventDate + "T00:00:00").getTime();
  const e = new Date(eventEndDate + "T00:00:00").getTime();
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}

export async function getDeliveryChecklist(bookingId: string): Promise<{
  items: ChecklistItem[];
  productName: string;
  surfaceType: string | null;
  needsPowerSupply: boolean;
}> {
  const supabase = createAdminClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("product_id, surface_type, needs_power_supply, product_name, event_date, event_end_date")
    .eq("id", bookingId)
    .single();

  if (!booking || !booking.product_id) {
    return { items: [], productName: "", surfaceType: null, needsPowerSupply: false };
  }

  const b = booking as BookingRow & { product_name: string };
  const numDays = rentalDays(b.event_date, b.event_end_date);

  const { data: reqs } = await supabase
    .from("product_inventory_requirements")
    .select(`
      id,
      inventory_item_id,
      quantity,
      surface_types,
      only_when_needs_power,
      per_day,
      notes,
      inventory_items (id, name, category)
    `)
    .eq("product_id", b.product_id);

  const items: ChecklistItem[] = [];

  for (const r of (reqs as unknown as RequirementRow[]) || []) {
    if (!r.inventory_items) continue;

    // Filter by surface
    const matchesSurface =
      !r.surface_types ||
      r.surface_types.length === 0 ||
      (b.surface_type && r.surface_types.includes(b.surface_type));
    if (!matchesSurface) continue;

    // Filter by power supply
    if (r.only_when_needs_power && !b.needs_power_supply) continue;

    // Reason text — for admin visibility
    const reasonParts: string[] = [];
    if (r.surface_types && r.surface_types.length > 0) {
      reasonParts.push(`surface: ${r.surface_types.join("/")}`);
    } else {
      reasonParts.push("always");
    }
    if (r.only_when_needs_power) reasonParts.push("power supply needed");
    if (r.per_day && numDays > 1) reasonParts.push(`${r.quantity}/day × ${numDays} days`);

    // Multiply by rental days if this requirement is per-day (consumables)
    const finalQuantity = r.per_day ? r.quantity * numDays : r.quantity;

    items.push({
      requirement_id: r.id,
      inventory_item_id: r.inventory_item_id,
      inventory_name: r.inventory_items.name,
      inventory_category: r.inventory_items.category,
      quantity: finalQuantity,
      notes: r.notes,
      reason: reasonParts.join(" · "),
    });
  }

  // Sort by category then name for stable display
  items.sort((a, b) => {
    const c = a.inventory_category.localeCompare(b.inventory_category);
    return c !== 0 ? c : a.inventory_name.localeCompare(b.inventory_name);
  });

  return {
    items,
    productName: b.product_name,
    surfaceType: b.surface_type,
    needsPowerSupply: b.needs_power_supply || false,
  };
}
