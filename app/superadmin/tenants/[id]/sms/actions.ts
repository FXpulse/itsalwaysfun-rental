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

const E164 = /^\+[1-9]\d{9,14}$/;
const MSG_SVC = /^MG[0-9a-fA-F]{32}$/;

const InputSchema = z.object({
  tenantId: z.string().uuid(),
  twilio_from_number: z
    .string()
    .trim()
    .regex(E164, "Must be E.164 (e.g. +19045551234)")
    .nullable()
    .or(z.literal("")),
  twilio_messaging_service_sid: z
    .string()
    .trim()
    .regex(MSG_SVC, "Messaging Service SID must be MG + 32 hex chars")
    .nullable()
    .or(z.literal("")),
});

export async function saveTenantSmsConfig(input: z.infer<typeof InputSchema>) {
  await requireSuperadmin();
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }
  const { tenantId, ...rest } = parsed.data;

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
  revalidatePath(`/superadmin/tenants/${tenantId}/sms`);
  return { ok: true };
}
