// GET /api/templates/products.csv (etc.)
// Serves a CSV template file with the right headers + example row for each entity.

import { NextResponse } from "next/server";
import { csvToText } from "@/lib/csv";

export const dynamic = "force-static";

const TEMPLATES: Record<string, { headers: string[]; sampleRows: any[][] }> = {
  products: {
    headers: [
      "name",
      "slug",
      "category",
      "description",
      "price_per_day_dollars",
      "cost_dollars",
      "stock",
      "image_url",
      "is_active",
      "is_addon",
      "weekend_price_per_day_dollars",
      "setup_area",
      "actual_size",
      "outlets_required",
      "age_group",
    ],
    sampleRows: [
      [
        "Game On",
        "game-on",
        "Bounce Houses",
        "Sports-themed bounce house for active kids",
        "299",
        "1800",
        "1",
        "https://example.com/game-on.jpg",
        "true",
        "false",
        "349",
        "15x15 ft",
        "13x13 ft",
        "1",
        "All ages",
      ],
      [
        "Folding chair",
        "folding-chair",
        "Add-ons",
        "Comfortable folding chair",
        "5",
        "0",
        "50",
        "",
        "true",
        "true",
        "",
        "",
        "",
        "0",
        "",
      ],
    ],
  },

  inventory: {
    headers: [
      "name",
      "category",
      "description",
      "quantity_owned",
      "quantity_in_use",
      "location",
      "condition",
      "purchase_date",
      "purchase_cost_dollars",
      "notes",
      "is_active",
    ],
    sampleRows: [
      [
        "Honda EU2200i Generator",
        "Generators",
        "Quiet portable generator",
        "2",
        "0",
        "Warehouse A",
        "good",
        "2025-08-15",
        "1200",
        "Annual service due Q1",
        "true",
      ],
      [
        "Sandbag (50 lb)",
        "Anchors & Stakes",
        "",
        "20",
        "0",
        "Warehouse",
        "good",
        "",
        "8",
        "",
        "true",
      ],
    ],
  },

  categories: {
    headers: ["name", "slug", "description", "image_url", "display_order", "is_active"],
    sampleRows: [
      [
        "Bounce Houses",
        "bounce-houses",
        "Classic bounce houses for kids parties",
        "https://example.com/cat-bounce.jpg",
        "1",
        "true",
      ],
      [
        "Dry Slides",
        "dry-slides",
        "Tall inflatable slides for active play",
        "",
        "2",
        "true",
      ],
    ],
  },

  vehicles: {
    headers: ["name", "vehicle_type", "requires_trailer", "capacity_notes", "is_active"],
    sampleRows: [
      ["Truck 1", "truck", "true", "Pulls trailer — 2-3 large bouncers", "true"],
      ["Van A", "van", "false", "Small to medium bouncers + accessories direct", "true"],
    ],
  },

  trailers: {
    headers: ["name", "capacity_notes", "is_active"],
    sampleRows: [
      ["Trailer A (16ft)", "2 large bouncers + accessories", "true"],
      ["Trailer B (12ft)", "1 large or 2 small bouncers", "true"],
    ],
  },
};

export async function GET(
  _req: Request,
  { params }: { params: { entity: string } },
) {
  // Strip .csv extension if present
  const entity = params.entity.replace(/\.csv$/i, "");
  const tmpl = TEMPLATES[entity];
  if (!tmpl) {
    return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  }
  const csv = csvToText(tmpl.headers, tmpl.sampleRows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${entity}-template.csv"`,
    },
  });
}
