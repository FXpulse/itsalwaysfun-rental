// GET /api/admin/export/<entity>.csv
// Exports current data as CSV with the same column structure as the matching
// /api/templates/<entity> template. Re-importable: download, edit, re-upload.

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { csvToText } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ExportConfig {
  headers: string[];
  fetch: () => Promise<any[][]>;
}

export async function GET(req: NextRequest, { params }: { params: { entity: string } }) {
  // Only admin can export — staff can view but not bulk-extract
  const me = await getCurrentUserRole();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (me.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const entity = params.entity.replace(/\.csv$/i, "");
  const config = buildExports();
  const conf = config[entity];
  if (!conf) return NextResponse.json({ error: "unknown_entity" }, { status: 404 });

  const rows = await conf.fetch();
  const csv = csvToText(conf.headers, rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${entity}-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

function buildExports(): Record<string, ExportConfig> {
  const scoped = createAdminClient();           // tenant-scoped
  const unscoped = createAdminClient({ unscoped: true });

  return {
    products: {
      headers: [
        "name", "slug", "category", "description",
        "price_per_day_dollars", "cost_dollars", "stock", "image_url",
        "is_active", "is_addon", "tax_exempt",
        "weekend_price_per_day_dollars", "setup_area", "actual_size",
        "outlets_required", "age_group",
      ],
      fetch: async () => {
        const { data } = await scoped
          .from("products")
          .select("name, slug, category, description, price_per_day, cost, stock, image_url, is_active, is_addon, tax_exempt, weekend_price_per_day, setup_area, actual_size, outlets_required, age_group")
          .order("name");
        return ((data as any[]) || []).map((p) => [
          p.name || "", p.slug || "", p.category || "", p.description || "",
          p.price_per_day != null ? String(p.price_per_day) : "",
          p.cost != null ? String(p.cost) : "",
          p.stock != null ? String(p.stock) : "",
          p.image_url || "",
          p.is_active ? "true" : "false",
          p.is_addon ? "true" : "false",
          p.tax_exempt ? "true" : "false",
          p.weekend_price_per_day != null ? String(p.weekend_price_per_day) : "",
          p.setup_area || "",
          p.actual_size || "",
          p.outlets_required != null ? String(p.outlets_required) : "",
          p.age_group || "",
        ]);
      },
    },

    inventory: {
      headers: [
        "name", "category", "description", "quantity_owned", "quantity_in_use",
        "location", "condition", "purchase_date", "purchase_cost_dollars",
        "notes", "is_active",
      ],
      fetch: async () => {
        const { data } = await scoped
          .from("inventory_items")
          .select("name, category, description, quantity_owned, quantity_in_use, location, condition, purchase_date, purchase_cost_cents, notes, is_active")
          .order("name");
        return ((data as any[]) || []).map((i) => [
          i.name || "", i.category || "", i.description || "",
          i.quantity_owned != null ? String(i.quantity_owned) : "",
          i.quantity_in_use != null ? String(i.quantity_in_use) : "",
          i.location || "", i.condition || "",
          i.purchase_date || "",
          i.purchase_cost_cents != null ? String((i.purchase_cost_cents / 100).toFixed(2)) : "",
          i.notes || "",
          i.is_active ? "true" : "false",
        ]);
      },
    },

    categories: {
      headers: ["name", "slug", "description", "image_url", "display_order", "is_active"],
      fetch: async () => {
        const { data } = await scoped
          .from("categories")
          .select("name, slug, description, image_url, display_order, is_active")
          .order("display_order");
        return ((data as any[]) || []).map((c) => [
          c.name || "", c.slug || "", c.description || "",
          c.image_url || "",
          c.display_order != null ? String(c.display_order) : "",
          c.is_active ? "true" : "false",
        ]);
      },
    },

    vehicles: {
      headers: ["name", "vehicle_type", "requires_trailer", "capacity_notes", "license_tag", "vin", "is_active"],
      fetch: async () => {
        const { data } = await scoped
          .from("vehicles")
          .select("name, vehicle_type, requires_trailer, capacity_notes, license_tag, vin, is_active")
          .order("name");
        return ((data as any[]) || []).map((v) => [
          v.name || "",
          v.vehicle_type || "",
          v.requires_trailer ? "true" : "false",
          v.capacity_notes || "",
          v.license_tag || "",
          v.vin || "",
          v.is_active ? "true" : "false",
        ]);
      },
    },

    trailers: {
      headers: ["name", "capacity_notes", "license_tag", "vin", "is_active"],
      fetch: async () => {
        const { data } = await scoped
          .from("trailers")
          .select("name, capacity_notes, license_tag, vin, is_active")
          .order("name");
        return ((data as any[]) || []).map((t) => [
          t.name || "", t.capacity_notes || "",
          t.license_tag || "", t.vin || "",
          t.is_active ? "true" : "false",
        ]);
      },
    },

    customers: {
      headers: ["email", "first_name", "last_name", "phone", "total_bookings", "total_spent_dollars", "first_booking", "last_booking"],
      fetch: async () => {
        // Aggregate from bookings (same logic as /admin/customers page)
        const { data: bookings } = await scoped
          .from("bookings")
          .select("customer_email, customer_first_name, customer_last_name, customer_phone, event_date, total_amount, stripe_payment_status, booking_status, created_at")
          .order("created_at", { ascending: false })
          .limit(5000);

        const map = new Map<string, any>();
        for (const b of (bookings as any[]) || []) {
          const key = (b.customer_email || "").toLowerCase().trim();
          if (!key) continue;
          const isPaid = b.stripe_payment_status === "paid" && b.booking_status !== "cancelled";
          const existing = map.get(key);
          if (!existing) {
            map.set(key, {
              email: key,
              first_name: b.customer_first_name || "",
              last_name: b.customer_last_name || "",
              phone: b.customer_phone || "",
              total_bookings: 1,
              total_spent_cents: isPaid ? (b.total_amount || 0) : 0,
              first_booking: b.event_date,
              last_booking: b.event_date,
            });
          } else {
            existing.total_bookings++;
            if (isPaid) existing.total_spent_cents += (b.total_amount || 0);
            if (b.event_date && (!existing.first_booking || b.event_date < existing.first_booking)) existing.first_booking = b.event_date;
            if (b.event_date && (!existing.last_booking || b.event_date > existing.last_booking)) existing.last_booking = b.event_date;
            if (!existing.first_name && b.customer_first_name) existing.first_name = b.customer_first_name;
            if (!existing.last_name && b.customer_last_name) existing.last_name = b.customer_last_name;
            if (!existing.phone && b.customer_phone) existing.phone = b.customer_phone;
          }
        }
        return Array.from(map.values()).map((c) => [
          c.email, c.first_name, c.last_name, c.phone,
          String(c.total_bookings),
          (c.total_spent_cents / 100).toFixed(2),
          c.first_booking || "", c.last_booking || "",
        ]);
      },
    },
  };
}
