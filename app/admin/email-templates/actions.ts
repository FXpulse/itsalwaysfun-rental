"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { renderTemplate, renderTemplateSms, substitute, wrapInBaseLayout } from "@/lib/email/render-template";
import { getTenantInfo, tenantToEmailBrand } from "@/lib/tenant/business";
import { sendSms, isSmsConfigured } from "@/lib/sms/send";
import { z } from "zod";

const UpdateSchema = z.object({
  subject: z.string().min(1).max(300),
  email_title: z.string().min(1).max(200),
  body_html: z.string().min(1).max(50000),
  body_text: z.string().min(1).max(50000),
  sms_body: z.string().max(1600).nullable(),
  is_active: z.boolean(),
});

export async function updateEmailTemplate(key: string, formData: FormData) {
  await requireAdmin();
  const smsRaw = formData.get("sms_body");
  const smsString = smsRaw == null ? "" : String(smsRaw);
  const parsed = UpdateSchema.safeParse({
    subject: String(formData.get("subject") || ""),
    email_title: String(formData.get("email_title") || ""),
    body_html: String(formData.get("body_html") || ""),
    body_text: String(formData.get("body_text") || ""),
    sms_body: smsString.trim() === "" ? null : smsString,
    is_active: formData.get("is_active") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("email_templates")
    .update(parsed.data)
    .eq("key", key);
  if (error) return { error: error.message };
  revalidatePath("/admin/email-templates");
  revalidatePath(`/admin/email-templates/${key}`);
  return { success: true };
}

/** Render the template with sample data + return preview HTML for iframe. */
export async function previewEmailTemplate(
  key: string,
  vars: Record<string, string>,
): Promise<{ subject: string; html: string; text: string } | { error: string }> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: tmpl } = await supabase
    .from("email_templates")
    .select("*")
    .eq("key", key)
    .single();
  if (!tmpl) return { error: "Template not found" };

  const tenant = await getTenantInfo();
  const brand = tenantToEmailBrand(tenant);
  const enriched = {
    businessName: brand.name,
    businessPhone: brand.phone || "",
    businessEmail: brand.email || "",
    ...vars,
  };
  const subject = substitute(tmpl.subject, enriched);
  const innerHtml = substitute(tmpl.body_html, enriched);
  const title = substitute(tmpl.email_title, enriched);
  const text = substitute(tmpl.body_text, enriched);
  const html = wrapInBaseLayout(
    title,
    innerHtml,
    {
      name: brand.name,
      phone: brand.phone,
      email: brand.email,
      primaryColor: brand.primaryColor || "#1a1a6e",
      accentColor: brand.accentColor || "#FFD700",
    },
    subject,
  );

  return { subject, html, text };
}

/** Send a test version to a chosen recipient. */
export async function sendTestEmail(
  key: string,
  toEmail: string,
  vars: Record<string, string>,
) {
  await requireAdmin();
  if (!isEmailConfigured()) {
    return { error: "Email delivery is not enabled for your account — contact RentalFlow support." };
  }
  if (!toEmail || !toEmail.includes("@")) {
    return { error: "Invalid recipient email" };
  }

  const rendered = await renderTemplate(key, vars);
  if (!rendered) return { error: "Template not found" };

  const r = await sendEmail({
    to: toEmail,
    subject: `[TEST] ${rendered.subject}`,
    html: rendered.html,
    text: rendered.text,
    tags: [
      { name: "type", value: "test" },
      { name: "template", value: key },
    ],
  });
  return r.ok ? { success: true, id: r.id } : { error: r.error || "Send failed" };
}

/** Send the rendered SMS body to a chosen phone for testing. */
export async function sendTestSms(
  key: string,
  toPhone: string,
  vars: Record<string, string>,
) {
  await requireAdmin();
  if (!isSmsConfigured()) {
    return { error: "SMS delivery is not enabled for your account — contact RentalFlow support." };
  }
  const rendered = await renderTemplateSms(key, vars);
  if (!rendered) return { error: "This template has no SMS body to send. Add one and save first." };

  const r = await sendSms({ to: toPhone, body: `[TEST] ${rendered}` });
  return r.ok ? { success: true, sid: r.sid } : { error: r.error || "Send failed" };
}

/** Render the SMS body with vars for preview in the editor. Does NOT send. */
export async function previewSmsTemplate(
  key: string,
  vars: Record<string, string>,
): Promise<{ body: string } | { error: string }> {
  await requireAdmin();
  const rendered = await renderTemplateSms(key, vars);
  if (rendered === null) return { error: "This template has no SMS body. Add one and save first." };
  return { body: rendered };
}
