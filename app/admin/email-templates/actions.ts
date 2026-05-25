"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { renderTemplate, substitute, wrapInBaseLayout } from "@/lib/email/render-template";
import { z } from "zod";

const UpdateSchema = z.object({
  subject: z.string().min(1).max(300),
  email_title: z.string().min(1).max(200),
  body_html: z.string().min(1).max(50000),
  body_text: z.string().min(1).max(50000),
  is_active: z.boolean(),
});

export async function updateEmailTemplate(key: string, formData: FormData) {
  await requireAdmin();
  const parsed = UpdateSchema.safeParse({
    subject: String(formData.get("subject") || ""),
    email_title: String(formData.get("email_title") || ""),
    body_html: String(formData.get("body_html") || ""),
    body_text: String(formData.get("body_text") || ""),
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

  const subject = substitute(tmpl.subject, vars);
  const innerHtml = substitute(tmpl.body_html, vars);
  const title = substitute(tmpl.email_title, vars);
  const text = substitute(tmpl.body_text, vars);
  const html = wrapInBaseLayout(title, innerHtml, subject);

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
    return { error: "Resend not configured — set RESEND_API_KEY + EMAIL_FROM in Vercel env" };
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
