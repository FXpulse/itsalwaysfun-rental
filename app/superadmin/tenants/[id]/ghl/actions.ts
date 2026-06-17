"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireSuperadmin(): Promise<{ email: string | null }> {
  const user = (await createClient().auth.getUser()).data.user;
  if (!user) throw new Error("unauthorized");
  const admin = createAdminClient({ unscoped: true });
  const { data } = await admin
    .from("user_roles")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .eq("is_superadmin", true)
    .maybeSingle();
  if (!data) throw new Error("not_superadmin");
  return { email: user.email ?? null };
}

const InputSchema = z.object({
  tenantId: z.string().uuid(),
  ghl_location_id: z.string().trim().max(100).nullable(),
  ghl_booking_webhook_url: z.string().trim().max(500).url().nullable().or(z.literal("")),
  ghl_abandoned_cart_webhook_url: z.string().trim().max(500).url().nullable().or(z.literal("")),
  ghl_referral_webhook_url: z.string().trim().max(500).url().nullable().or(z.literal("")),
  ghl_quote_webhook_url: z.string().trim().max(500).url().nullable().or(z.literal("")),
});

/** Save per-tenant GHL sub-account config. Empty string → stored as null. */
export async function saveTenantGhlConfig(input: z.infer<typeof InputSchema>) {
  await requireSuperadmin();
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }
  const { tenantId, ...rest } = parsed.data;

  // Normalize empty strings to null so the DB never stores ""
  const normalized = Object.fromEntries(
    Object.entries(rest).map(([k, v]) => [k, v && v.trim() ? v.trim() : null]),
  );

  const admin = createAdminClient({ unscoped: true });
  const { error } = await admin
    .from("tenants")
    .update(normalized)
    .eq("id", tenantId);
  if (error) return { error: error.message };

  revalidatePath(`/superadmin/tenants/${tenantId}`);
  revalidatePath(`/superadmin/tenants/${tenantId}/ghl`);
  return { ok: true };
}
