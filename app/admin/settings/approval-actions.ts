"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { getCurrentTenantId } from "@/lib/tenant/db";

const SaveSchema = z.object({
  thresholdCents: z.number().int().min(0).max(100_000_000).nullable(),
});

export async function saveApprovalThreshold(
  input: z.infer<typeof SaveSchema>,
): Promise<{ success: true } | { error: string }> {
  await requireAdmin();
  const parsed = SaveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input" };
  const tenantId = getCurrentTenantId();
  if (!tenantId) return { error: "No tenant context" };

  const supabase = createAdminClient({ unscoped: true });
  const { error } = await supabase
    .from("tenants")
    .update({ approval_threshold_cents: parsed.data.thresholdCents })
    .eq("id", tenantId);
  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  return { success: true };
}
