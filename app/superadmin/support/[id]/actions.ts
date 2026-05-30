"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSuperadminUser } from "@/lib/auth/superadmin";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";

async function requireAuth() {
  const user = await getSuperadminUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function sendReply(
  ticketId: string,
  body: string,
  markResolved: boolean,
) {
  const user = await requireAuth();
  const supabase = createAdminClient({ unscoped: true });

  const { data: ticket } = await supabase
    .from("support_tickets").select("*").eq("id", ticketId).single();
  if (!ticket) return { error: "ticket_not_found" };

  // Insert reply
  await supabase.from("support_ticket_replies").insert({
    ticket_id: ticketId,
    author_email: user.email,
    author_kind: "operator",
    body,
    is_internal: false,
  });

  // Update ticket
  const updates: any = {
    updated_at: new Date().toISOString(),
  };
  if (markResolved) {
    updates.status = "resolved";
    updates.resolved_at = new Date().toISOString();
    updates.resolved_by_email = user.email;
  } else if (ticket.status === "open") {
    updates.status = "in_progress";
  }
  await supabase.from("support_tickets").update(updates).eq("id", ticketId);

  // Bump KB article counter if the AI suggestion was the reply
  if (ticket.ai_suggested_article_id && markResolved && body === ticket.ai_suggested_response) {
    try {
      const { data: art } = await supabase
        .from("kb_articles")
        .select("ai_resolved_count")
        .eq("id", ticket.ai_suggested_article_id)
        .single();
      if (art) {
        await supabase
          .from("kb_articles")
          .update({ ai_resolved_count: (art.ai_resolved_count || 0) + 1 })
          .eq("id", ticket.ai_suggested_article_id);
      }
    } catch {
      // non-fatal
    }
  }

  // Email the tenant (best-effort)
  if (ticket.tenant_owner_email && isEmailConfigured()) {
    try {
      await sendEmail({
        to: ticket.tenant_owner_email,
        subject: `Re: ${ticket.subject}`,
        html: `<p>${body.replace(/\n/g, "<br>")}</p><hr><p style="color:#888;font-size:12px">RentalFlow support · ticket #${ticketId.slice(0, 8)}</p>`,
        text: body,
      });
    } catch (e) {
      Sentry.captureException(e, { tags: { stage: "ticket_reply_email" } });
    }
  }

  revalidatePath(`/superadmin/support/${ticketId}`);
  revalidatePath("/superadmin/support");
  return { success: true };
}

export async function setStatus(ticketId: string, status: string) {
  await requireAuth();
  const valid = ["open", "in_progress", "waiting_on_tenant", "resolved", "closed"];
  if (!valid.includes(status)) return { error: "invalid_status" };
  const supabase = createAdminClient({ unscoped: true });
  const updates: any = { status, updated_at: new Date().toISOString() };
  if (status === "resolved" || status === "closed") {
    updates.resolved_at = new Date().toISOString();
  }
  await supabase.from("support_tickets").update(updates).eq("id", ticketId);
  revalidatePath(`/superadmin/support/${ticketId}`);
  revalidatePath("/superadmin/support");
  return { success: true };
}
