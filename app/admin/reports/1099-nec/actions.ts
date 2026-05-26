"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";

const EmailRule = z.string().email().max(200);

const TaxProfileInput = z.object({
  full_name: z.string().max(200).optional().nullable(),
  business_name: z.string().max(200).optional().nullable(),
  tin_last4: z.string().regex(/^\d{4}$/).optional().nullable(),
  address_line1: z.string().max(200).optional().nullable(),
  address_line2: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(2).optional().nullable(),
  zip: z.string().max(10).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

function parseProfileForm(formData: FormData) {
  const s = (k: string) => {
    const v = String(formData.get(k) || "").trim();
    return v || null;
  };
  return {
    full_name: s("full_name"),
    business_name: s("business_name"),
    tin_last4: s("tin_last4"),
    address_line1: s("address_line1"),
    address_line2: s("address_line2"),
    city: s("city"),
    state: s("state")?.toUpperCase() || null,
    zip: s("zip"),
    notes: s("notes"),
  };
}

export async function upsertDriverTaxProfile(driverEmail: string, formData: FormData) {
  const me = await requireAdmin();
  const emailParse = EmailRule.safeParse(driverEmail.toLowerCase().trim());
  if (!emailParse.success) return { error: "Invalid driver email" };
  const data = parseProfileForm(formData);
  const parsed = TaxProfileInput.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("driver_tax_profiles")
    .upsert({ driver_email: emailParse.data, ...parsed.data });
  if (error) return { error: error.message };
  await logAuditEvent({
    userEmail: me.email || "unknown",
    action: "driver_tax_profile.upserted",
    entityType: "driver_tax_profile",
    entityId: emailParse.data,
    details: { fields: Object.keys(parsed.data) },
  });
  revalidatePath("/admin/reports/1099-nec");
  return { success: true };
}

export async function markW9Received(driverEmail: string, storagePath: string | null) {
  const me = await requireAdmin();
  const emailParse = EmailRule.safeParse(driverEmail.toLowerCase().trim());
  if (!emailParse.success) return { error: "Invalid driver email" };
  const supabase = createAdminClient();
  // Ensure row exists (upsert empty if needed)
  const { error: upErr } = await supabase
    .from("driver_tax_profiles")
    .upsert({ driver_email: emailParse.data }, { onConflict: "driver_email" });
  if (upErr) return { error: upErr.message };
  const { error } = await supabase
    .from("driver_tax_profiles")
    .update({
      w9_received_at: new Date().toISOString(),
      w9_storage_path: storagePath,
      w9_tax_year: new Date().getFullYear(),
    })
    .eq("driver_email", emailParse.data);
  if (error) return { error: error.message };
  await logAuditEvent({
    userEmail: me.email || "unknown",
    action: "driver_w9.received",
    entityType: "driver_tax_profile",
    entityId: emailParse.data,
    details: { storage_path: storagePath },
  });
  revalidatePath("/admin/reports/1099-nec");
  return { success: true };
}

export async function markYearFiled(driverEmail: string, year: number) {
  const me = await requireAdmin();
  const emailParse = EmailRule.safeParse(driverEmail.toLowerCase().trim());
  if (!emailParse.success) return { error: "Invalid driver email" };
  const supabase = createAdminClient();

  // Fetch current filed_history, merge in new year
  const { data: row } = await supabase
    .from("driver_tax_profiles")
    .select("filed_history")
    .eq("driver_email", emailParse.data)
    .maybeSingle();

  const history = (row?.filed_history as Record<string, string>) || {};
  history[String(year)] = new Date().toISOString();

  const { error } = await supabase
    .from("driver_tax_profiles")
    .upsert({
      driver_email: emailParse.data,
      filed_history: history,
    });
  if (error) return { error: error.message };
  await logAuditEvent({
    userEmail: me.email || "unknown",
    action: "driver_1099.filed",
    entityType: "driver_tax_profile",
    entityId: emailParse.data,
    details: { year },
  });
  revalidatePath("/admin/reports/1099-nec");
  return { success: true };
}

export async function unmarkYearFiled(driverEmail: string, year: number) {
  const me = await requireAdmin();
  const emailParse = EmailRule.safeParse(driverEmail.toLowerCase().trim());
  if (!emailParse.success) return { error: "Invalid driver email" };
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("driver_tax_profiles")
    .select("filed_history")
    .eq("driver_email", emailParse.data)
    .maybeSingle();
  if (!row) return { success: true };
  const history = (row.filed_history as Record<string, string>) || {};
  delete history[String(year)];
  const { error } = await supabase
    .from("driver_tax_profiles")
    .update({ filed_history: history })
    .eq("driver_email", emailParse.data);
  if (error) return { error: error.message };
  await logAuditEvent({
    userEmail: me.email || "unknown",
    action: "driver_1099.unfiled",
    entityType: "driver_tax_profile",
    entityId: emailParse.data,
    details: { year },
  });
  revalidatePath("/admin/reports/1099-nec");
  return { success: true };
}
