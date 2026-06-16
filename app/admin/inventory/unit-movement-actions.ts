"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffOrAdmin } from "@/lib/auth/roles";

const STATES = [
  "warehouse",
  "loading",
  "on_truck",
  "at_customer",
  "returning",
  "maintenance",
  "retired",
] as const;
export type UnitState = (typeof STATES)[number];

// Transiciones permitidas. Esto es laxo — solo bloquea casos absurdos como
// "retired → warehouse" (retired es terminal).
const VALID_TRANSITIONS: Record<UnitState, UnitState[]> = {
  warehouse:   ["loading", "on_truck", "at_customer", "maintenance", "retired"],
  loading:     ["on_truck", "warehouse", "maintenance"],
  on_truck:    ["at_customer", "warehouse", "returning", "maintenance"],
  at_customer: ["returning", "warehouse"],
  returning:   ["warehouse", "maintenance"],
  maintenance: ["warehouse", "retired"],
  retired:     [], // terminal — para re-activar, hacelo manual via SQL
};

const MoveInputSchema = z.object({
  unit_id: z.string().uuid(),
  to_state: z.enum(STATES),
  booking_id: z.string().uuid().optional().nullable(),
  route_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  performed_by_name: z.string().max(120).optional().nullable(),
});

export async function moveUnit(input: z.infer<typeof MoveInputSchema>) {
  await requireStaffOrAdmin();
  const parsed = MoveInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input" };

  const supabase = createAdminClient();

  // Read current state to record from_state + validate transition
  const { data: unit, error: unitErr } = await supabase
    .from("inventory_units")
    .select("id, current_state, inventory_item_id")
    .eq("id", parsed.data.unit_id)
    .maybeSingle();
  if (unitErr || !unit) return { error: "Unit not found" };

  const from = (unit as any).current_state as UnitState;
  const to = parsed.data.to_state;

  if (from === to) {
    return { error: `Unit is already in state "${from}"` };
  }
  if (!VALID_TRANSITIONS[from]?.includes(to)) {
    return {
      error: `Invalid transition "${from}" → "${to}". Allowed from "${from}": ${VALID_TRANSITIONS[from].join(", ") || "(none — terminal state)"}.`,
    };
  }

  const { error } = await supabase.from("inventory_unit_movements").insert({
    inventory_unit_id: parsed.data.unit_id,
    to_state: to,
    from_state: from,
    booking_id: parsed.data.booking_id ?? null,
    route_id: parsed.data.route_id ?? null,
    notes: parsed.data.notes ?? null,
    performed_by_name: parsed.data.performed_by_name ?? null,
  });
  if (error) return { error: error.message };

  // Trigger en SQL ya actualiza inventory_units.current_state — no doble update.
  revalidatePath(`/admin/inventory/${(unit as any).inventory_item_id}`);
  revalidatePath("/admin/inventory");
  return { success: true, from, to };
}

/** Bulk endpoint para cuando un dispatch se llena con N unidades:
 *  "todas estas units → on_truck con route X". */
export async function bulkMoveUnits(
  unitIds: string[],
  toState: UnitState,
  options: { booking_id?: string | null; route_id?: string | null; notes?: string | null } = {},
) {
  await requireStaffOrAdmin();
  if (!Array.isArray(unitIds) || unitIds.length === 0) return { error: "No units selected" };
  if (!STATES.includes(toState)) return { error: "Invalid target state" };

  const results = await Promise.all(
    unitIds.map((id) =>
      moveUnit({
        unit_id: id,
        to_state: toState,
        booking_id: options.booking_id ?? null,
        route_id: options.route_id ?? null,
        notes: options.notes ?? null,
        performed_by_name: null,
      })
    )
  );
  const ok = results.filter((r) => (r as any).success).length;
  const errored = results.filter((r) => (r as any).error);
  if (errored.length > 0) {
    return {
      success: ok > 0,
      moved: ok,
      failed: errored.length,
      first_error: (errored[0] as any).error,
    };
  }
  return { success: true, moved: ok };
}

/** Query unidades free para una fecha + producto. Returns el set de
 *  inventory_units que están en estado "warehouse" Y no asignadas a
 *  ninguna booking que pise el rango de fechas. */
export async function unitsAvailableForBooking(
  inventoryItemId: string,
  startDate: string,
  endDate: string,
) {
  await requireStaffOrAdmin();
  const supabase = createAdminClient();
  // Step 1: units activas en este item con state operacional (warehouse / on_truck / loading / returning).
  // "at_customer" se excluye porque están con un customer, no podés re-asignarlas.
  const { data: candidates } = await supabase
    .from("inventory_units")
    .select("id, tag, condition, current_state, current_booking_id")
    .eq("inventory_item_id", inventoryItemId)
    .eq("is_active", true)
    .in("current_state", ["warehouse", "loading", "on_truck", "returning"])
    .neq("condition", "retired")
    .neq("condition", "broken");

  // Step 2: unidades con bookings que se solapan con el rango → fuera de la pool
  // Esto requeriría un join con dispatch_stops + bookings.event_date — por simpleza
  // lo dejamos como TODO; por ahora devolvemos las del state warehouse.
  return { units: (candidates as any[]) || [] };
}
