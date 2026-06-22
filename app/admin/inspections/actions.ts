"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant/server";
import { requireStaffOrAdmin, requireDriverOrAbove } from "@/lib/auth/roles";

// ─── Templates ──────────────────────────────────────────────────────

const ItemSchema = z.object({
  key: z.string().min(1).max(40).regex(/^[a-z0-9_]+$/),
  label: z.string().min(1).max(200),
});

const TemplateInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  product_id: z.string().uuid().optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  items: z.array(ItemSchema).min(1).max(30),
  is_active: z.boolean().optional().default(true),
});

export async function createTemplate(input: z.infer<typeof TemplateInputSchema>) {
  await requireStaffOrAdmin();
  const parsed = TemplateInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input" };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("inspection_templates")
    .insert({
      name: parsed.data.name,
      product_id: parsed.data.product_id ?? null,
      category_id: parsed.data.category_id ?? null,
      items: parsed.data.items,
      is_active: parsed.data.is_active ?? true,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message || "Insert failed" };

  revalidatePath("/admin/inspections");
  return { id: data.id };
}

export async function updateTemplate(id: string, input: z.infer<typeof TemplateInputSchema>) {
  await requireStaffOrAdmin();
  const parsed = TemplateInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input" };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("inspection_templates")
    .update({
      name: parsed.data.name,
      product_id: parsed.data.product_id ?? null,
      category_id: parsed.data.category_id ?? null,
      items: parsed.data.items,
      is_active: parsed.data.is_active ?? true,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/inspections");
  revalidatePath(`/admin/inspections/${id}`);
  return { success: true };
}

export async function deleteTemplate(id: string) {
  await requireStaffOrAdmin();
  const supabase = createAdminClient();
  // Soft-delete preferido: just mark inactive — preserva historical snapshots
  // en booking_inspections via template_snapshot. Si querés hard-delete (cascada
  // por la FK on delete set null), abrir un PR distinto.
  const { error } = await supabase
    .from("inspection_templates")
    .update({ is_active: false })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/inspections");
  return { success: true };
}

// ─── Booking inspections (instances) ─────────────────────────────────

const ItemResultSchema = z.object({
  key: z.string().min(1).max(40),
  label: z.string().min(1).max(200),
  status: z.enum(["pass", "fail", "skip"]),
  notes: z.string().max(500).optional().nullable(),
  photo_urls: z.array(z.string().url()).max(8).optional().default([]),
});

const InspectionInputSchema = z.object({
  booking_id: z.string().uuid(),
  template_id: z.string().uuid().optional().nullable(),
  type: z.enum(["delivery", "pickup", "spot_check"]),
  inspector_name: z.string().trim().max(120).optional().nullable(),
  items_result: z.array(ItemResultSchema).min(1).max(30),
  notes: z.string().max(2000).optional().nullable(),
});

export async function createInspection(input: z.infer<typeof InspectionInputSchema>) {
  // Drivers do inspections in the field — they need write access.
  // Templates are still admin-only (createTemplate above).
  await requireDriverOrAbove();
  const parsed = InspectionInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input" };

  const supabase = createAdminClient();

  // Snapshot del template (si lo hay) — el editor del template lo pueda
  // cambiar después y nuestro record histórico mantiene el contexto.
  let snapshot: any[] = parsed.data.items_result.map(({ key, label }) => ({ key, label }));
  if (parsed.data.template_id) {
    const { data: tpl } = await supabase
      .from("inspection_templates")
      .select("items")
      .eq("id", parsed.data.template_id)
      .maybeSingle();
    if (tpl?.items) snapshot = tpl.items;
  }

  const failed = parsed.data.items_result.some((r) => r.status === "fail");
  const passedWithIssues = !failed && parsed.data.items_result.some((r) => r.notes || (r.photo_urls?.length ?? 0) > 0);
  const overall = failed
    ? "failed"
    : passedWithIssues
      ? "passed_with_issues"
      : "passed";

  const { data, error } = await supabase
    .from("booking_inspections")
    .insert({
      booking_id: parsed.data.booking_id,
      template_id: parsed.data.template_id ?? null,
      type: parsed.data.type,
      template_snapshot: snapshot,
      items_result: parsed.data.items_result,
      inspector_name: parsed.data.inspector_name ?? null,
      overall_status: overall,
      notes: parsed.data.notes ?? null,
    })
    .select("id, overall_status")
    .single();
  if (error || !data) return { error: error?.message || "Insert failed" };

  revalidatePath(`/admin/bookings/${parsed.data.booking_id}`);
  return { id: data.id, overall_status: data.overall_status };
}

/** Used by the booking detail page to suggest the right template based on the
 *  booking's primary product. Returns the active template most specifically
 *  scoped (product > category > tenant-global). */
export async function suggestTemplateForBooking(bookingId: string) {
  // NOTE: deliberately do NOT call requireDriverOrAbove() — this is a
  // read-only suggestion helper, and the booking-detail page that calls
  // it is already auth-gated by the admin layout. requireDriverOrAbove
  // itself relies on the scoped admin proxy for user_roles, which was
  // the culprit in the original failure mode.
  const tenantId = getCurrentTenantId();
  const supabase = createAdminClient({ unscoped: true });

  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .select("product_id, tenant_id, product:products(category_id)")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingErr) {
    console.error("[suggestTemplate] booking error", { bookingId, tenantId, err: bookingErr.message });
    Sentry.captureMessage("suggestTemplate: booking lookup failed", {
      level: "warning",
      tags: { booking_id: bookingId, tenant_id: tenantId },
      extra: { error: bookingErr.message },
    });
  }

  // tenant_id falls back to the booking row itself if the header context
  // is unreliable (server-action / Promise.all edge case).
  const resolvedTenantId =
    (booking as any)?.tenant_id || tenantId || null;
  const productId = (booking as any)?.product_id ?? null;
  const categoryId = (booking as any)?.product?.category_id ?? null;

  if (!resolvedTenantId) {
    console.error("[suggestTemplate] no tenant_id resolvable", { bookingId });
    return { template: null };
  }

  const { data: templates, error: tplErr } = await supabase
    .from("inspection_templates")
    .select("id, name, items, product_id, category_id")
    .eq("tenant_id", resolvedTenantId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (tplErr) {
    console.error("[suggestTemplate] templates error", { resolvedTenantId, err: tplErr.message });
    Sentry.captureMessage("suggestTemplate: templates lookup failed", {
      level: "warning",
      tags: { tenant_id: resolvedTenantId },
      extra: { error: tplErr.message },
    });
    return { template: null };
  }

  const all = (templates as any[]) || [];
  console.log("[suggestTemplate] resolved", {
    bookingId,
    resolvedTenantId,
    productId,
    categoryId,
    template_count: all.length,
    template_names: all.map((t) => t.name),
  });

  if (all.length === 0) return { template: null };

  // Priority: product-specific > category-specific > tenant-global > ANY active
  // (the last fallback is intentional — if the operator has set up at least
  // one active template, surfacing it is better than refusing the inspection).
  const productMatch = all.find((t) => t.product_id && t.product_id === productId);
  if (productMatch) return { template: productMatch };
  const categoryMatch = all.find((t) => t.category_id && t.category_id === categoryId);
  if (categoryMatch) return { template: categoryMatch };
  const globalMatch = all.find((t) => !t.product_id && !t.category_id);
  if (globalMatch) return { template: globalMatch };
  return { template: all[0] };
}
