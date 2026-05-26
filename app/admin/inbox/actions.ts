"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireStaffOrAdmin } from "@/lib/auth/roles";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Reply to a contact message via Resend.
 *  Sends from EMAIL_FROM, to the customer, reply_to set to the admin
 *  (so if the customer replies, it goes to the admin's inbox, not Resend). */
export async function replyToMessage(
  messageId: string,
  body: string,
  alsoMarkResolved: boolean,
) {
  const me = await requireStaffOrAdmin();
  const trimmed = body.trim();
  if (!trimmed) return { error: "Reply can't be empty" };
  if (trimmed.length > 10000) return { error: "Reply too long (max 10000 chars)" };
  if (!isEmailConfigured()) {
    return { error: "Email is not configured — can't send (set RESEND_API_KEY + EMAIL_FROM in Vercel)" };
  }

  const adminEmail = me.email || process.env.ADMIN_ALERT_EMAIL || "admin@itsalwaysfun.com";

  const supabase = createAdminClient();
  const { data: msg } = await supabase
    .from("contact_messages")
    .select("first_name, last_name, email, message")
    .eq("id", messageId)
    .single();
  if (!msg) return { error: "Message not found" };

  const subject = `Re: your message to It's Always Fun`;
  const quotedOriginal = msg.message
    .split("\n")
    .map((l: string) => `> ${l}`)
    .join("\n");

  const htmlBody = trimmed
    .split("\n\n")
    .map((para) => `<p style="margin:0 0 12px;">${escapeHtml(para).replace(/\n/g, "<br/>")}</p>`)
    .join("");

  const res = await sendEmail({
    to: msg.email,
    replyTo: adminEmail,   // future replies from customer come to admin, not Resend
    subject,
    html: `<div style="font-family:system-ui,sans-serif;max-width:600px;color:#0f172a;">
<p style="margin:0 0 16px;">Hi ${escapeHtml(msg.first_name)},</p>
${htmlBody}
<p style="margin:24px 0 8px;color:#64748b;font-size:13px;">— ${escapeHtml(adminEmail)}<br/>It's Always Fun, LLC</p>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 12px;"/>
<details style="color:#94a3b8;font-size:12px;">
  <summary style="cursor:pointer;">Your original message</summary>
  <pre style="white-space:pre-wrap;background:#f8fafc;padding:8px 12px;border-radius:4px;margin-top:8px;font-family:inherit;">${escapeHtml(msg.message)}</pre>
</details>
</div>`,
    text: `Hi ${msg.first_name},\n\n${trimmed}\n\n— ${adminEmail}\nIt's Always Fun, LLC\n\n---\nYour original message:\n${quotedOriginal}`,
    tags: [{ name: "type", value: "contact_reply" }],
  });

  // Log the reply attempt regardless of success
  const { error: logErr } = await supabase.from("contact_message_replies").insert({
    message_id: messageId,
    body: trimmed,
    sent_by: adminEmail,
    resend_email_id: res.ok ? res.id || null : null,
    send_error: res.ok ? null : res.error || "Unknown error",
  });
  if (logErr) {
    console.error("[Reply log insert failed]", logErr);
  }

  if (!res.ok) {
    return { error: `Send failed: ${res.error}` };
  }

  // Optionally mark the message resolved in the same action
  if (alsoMarkResolved) {
    await supabase
      .from("contact_messages")
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: adminEmail,
      })
      .eq("id", messageId);
  }

  revalidatePath("/admin/inbox");
  return { success: true };
}

export async function markResolved(messageId: string, note: string) {
  const me = await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("contact_messages")
    .update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: me.email,
      admin_notes: note || null,
    })
    .eq("id", messageId);
  if (error) return { error: error.message };
  revalidatePath("/admin/inbox");
  return { success: true };
}

export async function reopenMessage(messageId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("contact_messages")
    .update({
      is_resolved: false,
      resolved_at: null,
      resolved_by: null,
    })
    .eq("id", messageId);
  if (error) return { error: error.message };
  revalidatePath("/admin/inbox");
  return { success: true };
}

export async function deleteMessage(messageId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("contact_messages").delete().eq("id", messageId);
  if (error) return { error: error.message };
  revalidatePath("/admin/inbox");
  return { success: true };
}
