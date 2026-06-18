"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffOrAdmin } from "@/lib/auth/roles";
import { getCurrentTenantId } from "@/lib/tenant/db";

const SaveSchema = z.object({
  driver_email: z.string().email(),
  skills: z.array(z.string().min(1).max(40)).max(20),
  home_zip: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, "ZIP must be 5 digits or ZIP+4")
    .nullable()
    .or(z.literal("")),
  weekly_max_hours: z.number().int().min(1).max(168),
  available_days: z.array(z.number().int().min(0).max(6)).max(7),
  notes: z.string().max(500).nullable().or(z.literal("")),
});

export async function saveDriverScheduleProfile(
  input: z.infer<typeof SaveSchema>,
): Promise<{ success: true } | { error: string }> {
  await requireStaffOrAdmin();
  const parsed = SaveSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }
  const tenantId = getCurrentTenantId();
  if (!tenantId) return { error: "No tenant context" };

  const email = parsed.data.driver_email.toLowerCase().trim();
  const supabase = createAdminClient({ unscoped: true });

  // Upsert by (tenant_id, driver_email) — the unique constraint we added in
  // the migration ensures one row per driver per tenant.
  const { error } = await supabase
    .from("driver_schedule_profiles")
    .upsert(
      {
        tenant_id: tenantId,
        driver_email: email,
        skills: parsed.data.skills,
        home_zip:
          typeof parsed.data.home_zip === "string" && parsed.data.home_zip.trim()
            ? parsed.data.home_zip.trim()
            : null,
        weekly_max_hours: parsed.data.weekly_max_hours,
        available_days: parsed.data.available_days,
        notes:
          typeof parsed.data.notes === "string" && parsed.data.notes.trim()
            ? parsed.data.notes.trim()
            : null,
      },
      { onConflict: "tenant_id,driver_email" },
    );

  if (error) return { error: error.message };

  revalidatePath("/admin/drivers/schedule");
  return { success: true };
}
