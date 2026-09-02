"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant/server";
import { BlockDateInputSchema } from "@/lib/validation";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function blockDate(input: {
  product_id: string;
  blocked_date: string;
  reason?: string | null;
}) {
  const user = await requireAdmin();
  const parsed = BlockDateInputSchema.safeParse({
    product_id: input.product_id,
    blocked_date: input.blocked_date,
    reason: input.reason || null,
  });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    return { error: "Tenant context missing" };
  }

  const supabase = createAdminClient();
  // Verify the product belongs to the caller's tenant before blocking.
  // The blocked_dates table now requires tenant_id (NOT NULL) — supplying
  // it from the caller's tenant context also prevents an admin on one
  // tenant from blocking dates on a foreign tenant's product.
  const { data: prod } = await supabase
    .from("products")
    .select("id")
    .eq("id", parsed.data.product_id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!prod) {
    return { error: "Product not found" };
  }

  const { error } = await supabase.from("blocked_dates").insert({
    tenant_id: tenantId,
    product_id: parsed.data.product_id,
    blocked_date: parsed.data.blocked_date,
    reason: parsed.data.reason,
    created_by: user.email,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "This date is already blocked for this product." };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/availability");
  return { success: true };
}

export async function unblockDate(blockId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("blocked_dates").delete().eq("id", blockId);
  if (error) return { error: error.message };
  revalidatePath("/admin/availability");
  return { success: true };
}

// ─── Bulk block a date range across all (active) products ───────────
// Motivación: bloquear a mano X productos × N días por vacaciones o
// temporada baja es inviable (20 × 9 = 180 clicks). Este server action
// resuelve el rango completo en una sola llamada.
//
// Comportamiento:
//   - Duplicados (una fecha ya bloqueada para ese producto) se saltean
//     silenciosamente vía pre-fetch + filtro.
//   - Bookings existentes en esas fechas NO son afectados — el calendario
//     los sigue mostrando como purple. El block y el booking coexisten
//     en la DB; la UI da prioridad al booking cuando renderea.
//   - Rango cap 90 días para prevenir sustos por typo.
export async function bulkBlockDateRange(input: {
  start_date: string;
  end_date: string;
  reason?: string | null;
  include_inactive?: boolean;
}) {
  const user = await requireAdmin();

  const start = new Date(input.start_date + "T00:00:00");
  const end = new Date(input.end_date + "T00:00:00");
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { error: "Invalid date" };
  }
  if (start > end) {
    return { error: "Start date must be on or before end date" };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (start < today) {
    return { error: "Start date cannot be in the past" };
  }
  const days = Math.round((end.getTime() - start.getTime()) / 86400_000) + 1;
  if (days > 90) {
    return { error: "Range too large — max 90 days" };
  }

  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    return { error: "Tenant context missing" };
  }
  const supabase = createAdminClient();

  let productsQ = supabase
    .from("products")
    .select("id, name, is_active");
  if (!input.include_inactive) {
    productsQ = productsQ.eq("is_active", true);
  }
  const { data: products } = await productsQ;
  if (!products || products.length === 0) {
    return { error: "No products to block" };
  }

  // Build every (product × day) row we want.
  const startISO = start.toISOString().split("T")[0];
  const endISO = end.toISOString().split("T")[0];
  const rows: Array<{
    tenant_id: string;
    product_id: string;
    blocked_date: string;
    reason: string | null;
    created_by: string | undefined;
  }> = [];
  for (const p of products as Array<{ id: string }>) {
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + i * 86400_000);
      rows.push({
        tenant_id: tenantId,
        product_id: p.id,
        blocked_date: d.toISOString().split("T")[0],
        reason: input.reason?.trim() || null,
        created_by: user.email,
      });
    }
  }

  // Skip rows that already exist in the range — the UNIQUE constraint
  // is (product_id, blocked_date), so pre-filtering avoids a partial
  // failure that would leave the operation half-applied.
  const { data: existing } = await supabase
    .from("blocked_dates")
    .select("product_id, blocked_date")
    .gte("blocked_date", startISO)
    .lte("blocked_date", endISO);
  const existingKey = new Set(
    (existing || []).map(
      (e: any) => `${e.product_id}|${e.blocked_date}`,
    ),
  );

  const toInsert = rows.filter(
    (r) => !existingKey.has(`${r.product_id}|${r.blocked_date}`),
  );
  const skipped = rows.length - toInsert.length;

  if (toInsert.length === 0) {
    revalidatePath("/admin/availability");
    return {
      success: true,
      blocked_count: 0,
      skipped_count: skipped,
      products_count: products.length,
      days_count: days,
    };
  }

  const { error } = await supabase.from("blocked_dates").insert(toInsert);
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/availability");
  return {
    success: true,
    blocked_count: toInsert.length,
    skipped_count: skipped,
    products_count: products.length,
    days_count: days,
  };
}
