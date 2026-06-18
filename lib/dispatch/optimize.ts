// AI route optimizer for /admin/dispatch/[date].
//
// Strategy: collect all the unassigned bookings on a date + the available
// drivers + their skill/availability profiles + vehicles/trailers, send
// the bundle to GPT-4o with a structured JSON schema, get back a proposed
// plan of routes. The operator reviews and clicks Apply, which inserts
// dispatch_routes + dispatch_stops rows.
//
// We DO NOT auto-apply — the LLM is fast but fallible; a human always
// confirms before drivers see anything in /driver.
//
// Cost per optimization: ~$0.02 with gpt-4o on a typical 10-stop day.
// Returns null if OPENAI_API_KEY isn't set so we degrade cleanly.

import { createAdminClient } from "@/lib/supabase/admin";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o";

export interface BookingForOptimize {
  id: string;
  customer_name: string;
  customer_address: string;
  customer_zip: string | null;
  product_name: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
}

export interface DriverForOptimize {
  email: string;
  full_name: string;
  skills: string[];
  home_zip: string | null;
  weekly_max_hours: number;
  available_days: number[];
  hours_scheduled_this_week: number;
  notes: string | null;
}

export interface VehicleForOptimize {
  id: string;
  name: string;
  type: string;
  trailer_compatible: boolean;
}

export interface TrailerForOptimize {
  id: string;
  name: string;
}

export interface ProposedStop {
  booking_id: string;
  stop_order: number;
}

export interface ProposedRoute {
  driver_email: string;
  driver_name: string;
  vehicle_id: string | null;
  trailer_id: string | null;
  stops: ProposedStop[];
  reasoning: string;
}

export interface OptimizationResult {
  routes: ProposedRoute[];
  unassigned_booking_ids: string[];
  warnings: string[];
  model_used: string;
  generated_at: string;
}

/** Fetch the inputs the optimizer needs for a given date + tenant. */
export async function gatherOptimizationInputs(
  tenantId: string,
  routeDate: string,
): Promise<{
  bookings: BookingForOptimize[];
  drivers: DriverForOptimize[];
  vehicles: VehicleForOptimize[];
  trailers: TrailerForOptimize[];
}> {
  const supabase = createAdminClient({ unscoped: true });

  // Bookings on the date, paid, not cancelled, not already on a route
  const { data: bookingsRaw } = await supabase
    .from("bookings")
    .select(
      "id, customer_first_name, customer_last_name, customer_address, customer_zip, product_name, event_date, start_time, end_time",
    )
    .eq("tenant_id", tenantId)
    .eq("event_date", routeDate)
    .eq("stripe_payment_status", "paid")
    .neq("booking_status", "cancelled");

  // Exclude bookings already on a stop for this date so re-running the
  // optimizer doesn't double-book them.
  const { data: existingStops } = await supabase
    .from("dispatch_stops")
    .select("booking_id, dispatch_routes(route_date, tenant_id)")
    .eq("tenant_id", tenantId);
  const usedBookingIds = new Set<string>(
    ((existingStops as any[]) || [])
      .filter((s) => s.dispatch_routes?.route_date === routeDate)
      .map((s) => s.booking_id),
  );

  const bookings: BookingForOptimize[] = ((bookingsRaw as any[]) || [])
    .filter((b) => !usedBookingIds.has(b.id))
    .map((b) => ({
      id: b.id,
      customer_name: `${b.customer_first_name || ""} ${b.customer_last_name || ""}`.trim(),
      customer_address: b.customer_address || "",
      customer_zip: extractZip(b.customer_address),
      product_name: b.product_name || "",
      event_date: b.event_date,
      start_time: b.start_time,
      end_time: b.end_time,
    }));

  // Active drivers + their schedule profiles
  const { data: driverRoles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "driver")
    .eq("is_active", true);
  const driverUserIds = ((driverRoles as any[]) || []).map((r) => r.user_id);

  const drivers: DriverForOptimize[] = [];
  if (driverUserIds.length > 0) {
    // Lookup auth users to get email + name
    const driverAuth = await Promise.all(
      driverUserIds.map((id) => supabase.auth.admin.getUserById(id)),
    );
    const profiles = await supabase
      .from("driver_schedule_profiles")
      .select("driver_email, skills, home_zip, weekly_max_hours, available_days, notes")
      .eq("tenant_id", tenantId);
    const profileByEmail = new Map<string, any>(
      (((profiles as any).data as any[]) || []).map((p) => [
        (p.driver_email || "").toLowerCase(),
        p,
      ]),
    );

    // Hours already scheduled this ISO week — pull dispatch_routes for the
    // week, count stops per driver, multiply by a rough avg of 1h per stop.
    // We just want a soft ceiling; the LLM can use it as guidance.
    const weekStart = isoWeekMonday(routeDate);
    const weekEnd = addDays(weekStart, 6);
    const { data: weekRoutes } = await supabase
      .from("dispatch_routes")
      .select("driver_name, id, dispatch_stops(id)")
      .eq("tenant_id", tenantId)
      .gte("route_date", weekStart)
      .lte("route_date", weekEnd);
    const hoursByDriver = new Map<string, number>();
    for (const r of ((weekRoutes as any[]) || [])) {
      const stops = (r.dispatch_stops as any[]) || [];
      const hours = stops.length * 1; // rough 1hr/stop
      const key = (r.driver_name || "").trim().toLowerCase();
      if (!key) continue;
      hoursByDriver.set(key, (hoursByDriver.get(key) || 0) + hours);
    }

    for (const r of driverAuth) {
      const u = r.data?.user;
      if (!u?.email) continue;
      const email = u.email.toLowerCase();
      const profile = profileByEmail.get(email);
      const meta = (u.user_metadata as { first_name?: string; last_name?: string }) || {};
      const fullName =
        [meta.first_name, meta.last_name].filter(Boolean).join(" ") || u.email;
      drivers.push({
        email,
        full_name: fullName,
        skills: profile?.skills || [],
        home_zip: profile?.home_zip || null,
        weekly_max_hours: profile?.weekly_max_hours ?? 40,
        available_days: profile?.available_days || [],
        hours_scheduled_this_week: hoursByDriver.get(fullName.toLowerCase()) || 0,
        notes: profile?.notes || null,
      });
    }
  }

  // Vehicles + trailers
  const { data: vehiclesRaw } = await supabase
    .from("vehicles")
    .select("id, name, vehicle_type")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  const vehicles: VehicleForOptimize[] = ((vehiclesRaw as any[]) || []).map((v) => ({
    id: v.id,
    name: v.name || "",
    type: v.vehicle_type || "truck",
    trailer_compatible: ["truck", "pickup", "suv"].includes(
      (v.vehicle_type || "").toLowerCase(),
    ),
  }));

  const { data: trailersRaw } = await supabase
    .from("trailers")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  const trailers: TrailerForOptimize[] = ((trailersRaw as any[]) || []).map((t) => ({
    id: t.id,
    name: t.name || "",
  }));

  return { bookings, drivers, vehicles, trailers };
}

/** Build the LLM prompt + call OpenAI with structured-JSON response.
 *  Returns null when OPENAI_API_KEY is unset or the call fails — caller
 *  shows a friendly error in the UI. */
export async function proposeRoutePlan(args: {
  tenantId: string;
  routeDate: string;
}): Promise<OptimizationResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const { bookings, drivers, vehicles, trailers } = await gatherOptimizationInputs(
    args.tenantId,
    args.routeDate,
  );

  if (bookings.length === 0) {
    return {
      routes: [],
      unassigned_booking_ids: [],
      warnings: ["No unassigned bookings on this date."],
      model_used: MODEL,
      generated_at: new Date().toISOString(),
    };
  }

  const dayOfWeek = new Date(args.routeDate + "T12:00:00Z").getUTCDay();
  const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayOfWeek];

  const systemPrompt = `You are a dispatch planner for a party rental business. Your job: assign each booking to a driver + vehicle, and order the stops within each route to minimize driving while respecting constraints.

Output STRICT JSON ONLY — no prose, no markdown fences.

Schema:
{
  "routes": [
    {
      "driver_email": "<email of the chosen driver>",
      "vehicle_id": "<uuid of the chosen vehicle or null if no suitable one>",
      "trailer_id": "<uuid of trailer if needed for this product, or null>",
      "stops": [
        { "booking_id": "<uuid>", "stop_order": 1 },
        { "booking_id": "<uuid>", "stop_order": 2 }
      ],
      "reasoning": "<1-2 sentences: why these stops, why this driver, why this ordering>"
    }
  ],
  "unassigned_booking_ids": ["<uuids of bookings you couldn't fit>"],
  "warnings": ["<any soft-constraint violations the operator should know>"]
}

CONSTRAINTS (hard):
- Each booking must appear at most once across all routes.
- Each driver appears in at most one route (a driver does one route per day).
- Each vehicle appears in at most one route.
- stop_order starts at 1, increments by 1, no gaps.
- If a driver's available_days is non-empty and does NOT include ${dayOfWeek} (${dayName}), don't use that driver.

CONSTRAINTS (soft — list violations in warnings):
- Skills match product. "slide" or "XL" products favor drivers with "large_slides" skill. "concession" products favor drivers with "concession" skill.
- Geographic clustering: stops in the same route should be near each other (similar ZIP code prefix). A driver with a home_zip closer to the cluster is preferred.
- Don't blow past weekly_max_hours — each route ~= stops × 1.5 hours. If a driver is already at 35 hours and a 5-stop route would push them to 42.5, mention in warnings.
- Time windows: if a booking has start_time, that's when the customer expects setup. Order stops earlier in the day for earlier event start_times.

Be pragmatic. Prefer fewer routes with more stops over many routes with 1 stop each — driver time is more expensive than gas. But cap stops/route at 6 unless event timings overlap.`;

  const payload = {
    route_date: args.routeDate,
    day_of_week: dayName,
    bookings,
    drivers,
    vehicles,
    trailers,
  };

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Plan routes for ${args.routeDate}. Inputs:\n${JSON.stringify(payload, null, 2)}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI ${res.status}: ${body.slice(0, 200)}`);
    }
    const data: any = await res.json();
    const content: string = data.choices?.[0]?.message?.content || "";
    if (!content) return null;
    const parsed = JSON.parse(content);

    // Fill in driver_name from email so the UI doesn't have to re-lookup.
    const driverByEmail = new Map(drivers.map((d) => [d.email, d.full_name]));
    const routes: ProposedRoute[] = ((parsed.routes as any[]) || []).map((r) => ({
      driver_email: r.driver_email,
      driver_name: driverByEmail.get(r.driver_email) || r.driver_email,
      vehicle_id: r.vehicle_id || null,
      trailer_id: r.trailer_id || null,
      stops: ((r.stops as any[]) || []).map((s) => ({
        booking_id: s.booking_id,
        stop_order: s.stop_order,
      })),
      reasoning: r.reasoning || "",
    }));

    return {
      routes,
      unassigned_booking_ids: (parsed.unassigned_booking_ids as string[]) || [],
      warnings: (parsed.warnings as string[]) || [],
      model_used: MODEL,
      generated_at: new Date().toISOString(),
    };
  } catch (e) {
    console.error("[optimize] LLM call failed:", e);
    return null;
  }
}

// ─── helpers ─────────────────────────────────────────────────────────

function extractZip(address: string | null): string | null {
  if (!address) return null;
  const m = address.match(/\b(\d{5})(-\d{4})?\b/);
  return m ? m[1] : null;
}

function isoWeekMonday(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
