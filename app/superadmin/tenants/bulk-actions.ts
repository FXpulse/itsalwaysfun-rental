"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";

async function requireSuperadmin() {
  const authClient = createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return null;
  const supabase = createAdminClient({ unscoped: true });
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .eq("is_superadmin", true)
    .maybeSingle();
  return roleRow ? user : null;
}

export async function bulkSendEmail(
  tenantIds: string[],
  subject: string,
  body: string,
): Promise<{ ok: true; sent: number; failed: number } | { error: string }> {
  const user = await requireSuperadmin();
  if (!user) return { error: "unauthorized" };
  if (!subject.trim() || !body.trim()) return { error: "subject_and_body_required" };
  if (tenantIds.length === 0) return { error: "no_tenants_selected" };
  if (!isEmailConfigured()) return { error: "email_not_configured" };

  const supabase = createAdminClient({ unscoped: true });
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, business_name, owner_email")
    .in("id", tenantIds);

  let sent = 0;
  let failed = 0;
  for (const t of (tenants as any[]) || []) {
    if (!t.owner_email) { failed++; continue; }
    const personalized = body
      .replace(/\{business_name\}/g, t.business_name || "")
      .replace(/\{first_name\}/g, t.business_name?.split(" ")[0] || "there");
    const r = await sendEmail({
      to: t.owner_email,
      subject,
      html: `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#0f172a;line-height:1.6">${personalized.replace(/\n/g, "<br>")}</div>`,
      text: personalized,
      tags: [{ name: "type", value: "operator_bulk" }],
    });
    if (r.ok) sent++; else failed++;
  }

  return { ok: true, sent, failed };
}

export async function bulkPause(
  tenantIds: string[],
  reason: string = "operator_bulk_pause",
): Promise<{ ok: true; count: number } | { error: string }> {
  const user = await requireSuperadmin();
  if (!user) return { error: "unauthorized" };
  if (tenantIds.length === 0) return { error: "no_tenants_selected" };

  const supabase = createAdminClient({ unscoped: true });
  const { error } = await supabase
    .from("tenants")
    .update({
      suspended_at: new Date().toISOString(),
      suspended_reason: reason,
    })
    .in("id", tenantIds);
  if (error) return { error: error.message };

  revalidatePath("/superadmin/tenants");
  return { ok: true, count: tenantIds.length };
}

export async function bulkUnpause(
  tenantIds: string[],
): Promise<{ ok: true; count: number } | { error: string }> {
  const user = await requireSuperadmin();
  if (!user) return { error: "unauthorized" };
  if (tenantIds.length === 0) return { error: "no_tenants_selected" };

  const supabase = createAdminClient({ unscoped: true });
  const { error } = await supabase
    .from("tenants")
    .update({ suspended_at: null, suspended_reason: null })
    .in("id", tenantIds);
  if (error) return { error: error.message };

  revalidatePath("/superadmin/tenants");
  return { ok: true, count: tenantIds.length };
}

export async function bulkExportCsv(tenantIds: string[]): Promise<string | { error: string }> {
  const user = await requireSuperadmin();
  if (!user) return { error: "unauthorized" };
  if (tenantIds.length === 0) return { error: "no_tenants_selected" };

  const supabase = createAdminClient({ unscoped: true });
  const { data } = await supabase
    .from("tenants")
    .select("id, slug, business_name, owner_email, plan, subscription_status, custom_domain, suspended_at, created_at, current_period_end")
    .in("id", tenantIds)
    .order("created_at", { ascending: false });

  const header = "id,slug,business_name,owner_email,plan,subscription_status,custom_domain,suspended_at,created_at,current_period_end\n";
  const rows = ((data as any[]) || []).map((t) =>
    [
      t.id, t.slug, csvEscape(t.business_name || ""), csvEscape(t.owner_email || ""),
      t.plan || "", t.subscription_status || "", t.custom_domain || "",
      t.suspended_at || "", t.created_at || "", t.current_period_end || "",
    ].join(",")
  ).join("\n");

  return header + rows + "\n";
}

function csvEscape(v: string): string {
  if (/[,"\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
