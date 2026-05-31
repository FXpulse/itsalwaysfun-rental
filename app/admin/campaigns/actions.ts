"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { getTenantBusinessName } from "@/lib/tenant/business";

async function requireAdmin() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") throw new Error("Unauthorized");
  return me;
}

export interface CampaignFilter {
  all_customers?: boolean;
  tags?: string[];                       // OR-match
  booked_within_days?: number;           // last paid booking within N days
  min_total_spent_cents?: number;
}

interface AudienceRow {
  email: string;
  first_name: string;
  last_name: string;
}

/**
 * Resolve the audience for a given filter. Returns unique customer rows
 * by email. Used by both the preview action and the send action.
 */
export async function resolveAudience(filter: CampaignFilter): Promise<AudienceRow[]> {
  await requireAdmin();
  const supabase = createAdminClient();

  // Start with every email we know about (from bookings)
  const baseEmails = new Map<string, AudienceRow>();

  // Pull bookings (filter: paid, within window if specified, has email)
  let bookingsQuery = supabase
    .from("bookings")
    .select("customer_email, customer_first_name, customer_last_name, event_date, stripe_payment_status, total_amount")
    .not("customer_email", "is", null);

  if (filter.booked_within_days && filter.booked_within_days > 0) {
    const since = new Date(Date.now() - filter.booked_within_days * 86_400_000)
      .toISOString().slice(0, 10);
    bookingsQuery = bookingsQuery
      .gte("event_date", since)
      .eq("stripe_payment_status", "paid");
  }

  const { data: bookings } = await bookingsQuery.limit(10_000);
  const spendByEmail = new Map<string, number>();

  for (const b of (bookings as any[]) || []) {
    const email = (b.customer_email || "").toLowerCase().trim();
    if (!email) continue;
    if (b.stripe_payment_status === "paid") {
      spendByEmail.set(email, (spendByEmail.get(email) || 0) + (b.total_amount || 0));
    }
    if (!baseEmails.has(email)) {
      baseEmails.set(email, {
        email,
        first_name: b.customer_first_name || "",
        last_name: b.customer_last_name || "",
      });
    }
  }

  // Also include customers with tags or portal accounts (they may not have bookings)
  if (filter.tags && filter.tags.length > 0) {
    const { data: tagged } = await supabase
      .from("customer_tags")
      .select("customer_email")
      .in("tag_name", filter.tags);
    const taggedEmails = new Set<string>(((tagged as any[]) || []).map((t) => t.customer_email));
    // Filter base to only include tagged emails AND add any tagged emails not yet present
    const result: AudienceRow[] = [];
    for (const email of taggedEmails) {
      if (baseEmails.has(email)) {
        result.push(baseEmails.get(email)!);
      } else {
        // No booking row — fetch name from auth.users if possible
        result.push({ email, first_name: "", last_name: "" });
      }
    }
    // Also apply spend filter
    if (filter.min_total_spent_cents) {
      return result.filter((r) => (spendByEmail.get(r.email) || 0) >= filter.min_total_spent_cents!);
    }
    return result;
  }

  // No tag filter — return the base list
  const list = Array.from(baseEmails.values());
  if (filter.min_total_spent_cents) {
    return list.filter((r) => (spendByEmail.get(r.email) || 0) >= filter.min_total_spent_cents!);
  }
  if (!filter.all_customers && !filter.booked_within_days && !filter.tags?.length && !filter.min_total_spent_cents) {
    // No filter at all — return empty so admin doesn't accidentally email everyone
    return [];
  }
  return list;
}

export async function previewCampaignAudience(filter: CampaignFilter): Promise<
  { ok: true; count: number; sample: AudienceRow[] } | { error: string }
> {
  try {
    const audience = await resolveAudience(filter);
    return { ok: true, count: audience.length, sample: audience.slice(0, 10) };
  } catch (e: any) {
    return { error: e?.message || "preview_failed" };
  }
}

export async function sendCampaign(input: {
  name: string;
  subject: string;
  body: string;
  filter: CampaignFilter;
  scheduled_at?: string;       // ISO timestamp — if in the future, queue instead of send
}): Promise<{ ok: true; campaign_id: string; sent: number; failed: number; scheduled?: boolean } | { error: string }> {
  const me = await requireAdmin();

  if (!input.name.trim()) return { error: "name_required" };
  if (!input.subject.trim()) return { error: "subject_required" };
  if (!input.body.trim()) return { error: "body_required" };
  if (!isEmailConfigured()) return { error: "email_not_configured" };

  // If scheduled in the future (with 60s grace), queue it instead of sending now
  const scheduledDate = input.scheduled_at ? new Date(input.scheduled_at) : null;
  const isScheduled = !!(scheduledDate && scheduledDate.getTime() > Date.now() + 60_000);

  // Validate audience size NOW even for scheduled campaigns (avoid surprises)
  const audience = await resolveAudience(input.filter);
  if (audience.length === 0) return { error: "no_recipients" };
  if (audience.length > 1000) return { error: "audience_too_large_split_into_batches" };

  let businessName = "us";
  try { businessName = await getTenantBusinessName(); } catch {}

  const supabase = createAdminClient();
  const { data: campaign, error: insertError } = await supabase
    .from("campaigns")
    .insert({
      name: input.name,
      subject: input.subject,
      body: input.body,
      filter_json: input.filter,
      status: isScheduled ? "scheduled" : "sending",
      scheduled_at: scheduledDate ? scheduledDate.toISOString() : null,
      recipient_count: audience.length,
      created_by_email: me.email,
    })
    .select("id")
    .single();
  if (insertError || !campaign) return { error: insertError?.message || "create_failed" };

  // If scheduled, return now — cron will pick it up at scheduled_at
  if (isScheduled) {
    revalidatePath("/admin/campaigns");
    return { ok: true, campaign_id: campaign.id, sent: 0, failed: 0, scheduled: true };
  }

  let sent = 0;
  let failed = 0;

  for (const r of audience) {
    const firstName = r.first_name || r.email.split("@")[0];
    const personalizedBody = input.body
      .replace(/\{firstName\}/g, firstName)
      .replace(/\{first_name\}/g, firstName)
      .replace(/\{lastName\}/g, r.last_name || "")
      .replace(/\{businessName\}/g, businessName);

    const html = `<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#0f172a;line-height:1.6">
${personalizedBody.split(/\n\n+/).map((p) => `<p style="margin:14px 0">${p.replace(/\n/g, "<br>")}</p>`).join("\n")}
<div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:24px;font-size:12px;color:#64748b">— ${businessName}</div>
</body></html>`;

    const result = await sendEmail({
      to: r.email,
      subject: input.subject,
      html,
      text: personalizedBody,
      tags: [
        { name: "type", value: "campaign" },
        { name: "campaign_id", value: campaign.id },
      ],
    });

    await supabase.from("campaign_recipients").insert({
      campaign_id: campaign.id,
      customer_email: r.email,
      first_name: r.first_name,
      succeeded: result.ok,
      resend_id: result.id || null,
      error_message: result.ok ? null : (result.error || null),
    });

    if (result.ok) sent++; else failed++;
  }

  await supabase
    .from("campaigns")
    .update({
      sent_count: sent,
      failed_count: failed,
      status: failed === audience.length ? "failed" : "sent",
      sent_at: new Date().toISOString(),
    })
    .eq("id", campaign.id);

  revalidatePath("/admin/campaigns");
  return { ok: true, campaign_id: campaign.id, sent, failed };
}
