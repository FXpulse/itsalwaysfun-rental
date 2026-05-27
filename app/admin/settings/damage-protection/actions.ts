"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { logAuditEvent } from "@/lib/audit";

const Input = z.object({
  enabled: z.enum(["true", "false"]),
  // Allow dollars input from the form (e.g. "25" → 2500 cents)
  price_dollars: z.coerce.number().min(0).max(1000),
  coverage_dollars: z.coerce.number().min(0).max(100000),
});

const KEYS = {
  enabled: "damage_protection_enabled",
  price: "damage_protection_price_cents",
  coverage: "damage_protection_coverage_cents",
} as const;

export async function saveDamageProtection(formData: FormData) {
  const me = await requireAdmin();

  const parsed = Input.safeParse({
    enabled: String(formData.get("enabled") || "false"),
    price_dollars: formData.get("price_dollars"),
    coverage_dollars: formData.get("coverage_dollars"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.errors.map((e) => `${e.path}: ${e.message}`).join("; "),
    };
  }

  const supabase = createAdminClient();
  const rows = [
    { key: KEYS.enabled, value: parsed.data.enabled },
    { key: KEYS.price, value: String(Math.round(parsed.data.price_dollars * 100)) },
    { key: KEYS.coverage, value: String(Math.round(parsed.data.coverage_dollars * 100)) },
  ];

  for (const r of rows) {
    // Update first; if no row exists yet, insert. We don't use upsert with
    // onConflict because the proxy wrap doesn't translate it correctly.
    const { data: existing } = await supabase
      .from("site_settings")
      .select("key")
      .eq("key", r.key)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("site_settings")
        .update({ value: r.value })
        .eq("key", r.key);
      if (error) return { error: `${r.key}: ${error.message}` };
    } else {
      const { error } = await supabase
        .from("site_settings")
        .insert({ key: r.key, value: r.value, category: "general" });
      if (error) return { error: `${r.key}: ${error.message}` };
    }
  }

  await logAuditEvent({
    userEmail: me.email || "unknown",
    action: "settings.damage_protection_updated",
    entityType: "site_settings",
    entityId: KEYS.enabled,
    details: {
      enabled: parsed.data.enabled,
      price_cents: Math.round(parsed.data.price_dollars * 100),
      coverage_cents: Math.round(parsed.data.coverage_dollars * 100),
    },
  });

  revalidatePath("/admin/settings/damage-protection");
  revalidatePath("/admin/diagnostics");
  revalidatePath("/order-by-date");
  return { success: true };
}
