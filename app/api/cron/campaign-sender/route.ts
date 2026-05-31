// Campaign sender cron — runs every 5 minutes. Picks up scheduled campaigns
// whose scheduled_at has passed, resolves audience at SEND TIME (not snapshot),
// and sends each.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { getTenantBusinessName } from "@/lib/tenant/business";
import { resolveAudience, type CampaignFilter } from "@/app/admin/campaigns/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  if (!isEmailConfigured()) {
    return NextResponse.json({ ok: false, error: "email_not_configured" });
  }

  const supabase = createAdminClient({ unscoped: true });
  const now = new Date().toISOString();
  const { data: due } = await supabase
    .from("campaigns")
    .select("id, tenant_id, name, subject, body, filter_json")
    .eq("status", "scheduled")
    .lte("scheduled_at", now)
    .limit(20);

  const list = (due as any[]) || [];
  const results: any[] = [];

  for (const c of list) {
    try {
      // Mark as sending atomically
      const { data: claimed } = await supabase
        .from("campaigns")
        .update({ status: "sending" })
        .eq("id", c.id)
        .eq("status", "scheduled")
        .select("id")
        .single();
      if (!claimed) {
        // Someone else picked it up
        continue;
      }

      // Re-evaluate audience at send time. Note: resolveAudience uses
      // createAdminClient() which auto-scopes by header — but we're in a cron
      // with no tenant context. So we manually inject tenant_id by setting a
      // pseudo-header via process state... or simpler: fetch + filter ourselves.
      const audience = await resolveAudienceForTenant(supabase, c.tenant_id, c.filter_json as CampaignFilter);
      if (audience.length === 0) {
        await supabase.from("campaigns").update({
          status: "sent",
          sent_count: 0,
          failed_count: 0,
          sent_at: new Date().toISOString(),
        }).eq("id", c.id);
        results.push({ id: c.id, sent: 0, failed: 0, skipped: "no_recipients" });
        continue;
      }

      let businessName = "us";
      {
        const { data: tRow } = await supabase
          .from("tenants").select("business_name").eq("id", c.tenant_id).maybeSingle();
        if (tRow?.business_name) businessName = tRow.business_name;
      }

      let sent = 0;
      let failed = 0;
      for (const r of audience) {
        const firstName = r.first_name || r.email.split("@")[0];
        const personalizedBody = c.body
          .replace(/\{firstName\}/g, firstName)
          .replace(/\{first_name\}/g, firstName)
          .replace(/\{lastName\}/g, r.last_name || "")
          .replace(/\{businessName\}/g, businessName);

        const html = `<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#0f172a;line-height:1.6">
${personalizedBody.split(/\n\n+/).map((p: string) => `<p style="margin:14px 0">${p.replace(/\n/g, "<br>")}</p>`).join("\n")}
<div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:24px;font-size:12px;color:#64748b">— ${businessName}</div>
</body></html>`;

        const result = await sendEmail({
          to: r.email,
          subject: c.subject,
          html,
          text: personalizedBody,
          tags: [
            { name: "type", value: "campaign_scheduled" },
            { name: "campaign_id", value: c.id },
          ],
        });

        await supabase.from("campaign_recipients").insert({
          campaign_id: c.id,
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
          status: failed === audience.length ? "failed" : "sent",
          sent_count: sent,
          failed_count: failed,
          recipient_count: audience.length,
          sent_at: new Date().toISOString(),
        })
        .eq("id", c.id);

      results.push({ id: c.id, sent, failed });
    } catch (e: any) {
      console.error("[campaign-sender]", c.id, e?.message);
      results.push({ id: c.id, error: e?.message });
    }
  }

  return NextResponse.json({ ok: true, processed: list.length, results });
}

/**
 * Tenant-scoped audience resolver for cron use (no request context to derive
 * tenant_id, so we pass it in explicitly).
 */
async function resolveAudienceForTenant(
  supabase: any,
  tenantId: string,
  filter: CampaignFilter,
): Promise<Array<{ email: string; first_name: string; last_name: string }>> {
  const baseEmails = new Map<string, { email: string; first_name: string; last_name: string }>();

  let bookingsQuery = supabase
    .from("bookings")
    .select("customer_email, customer_first_name, customer_last_name, event_date, stripe_payment_status, total_amount")
    .eq("tenant_id", tenantId)
    .not("customer_email", "is", null);

  if (filter.booked_within_days && filter.booked_within_days > 0) {
    const since = new Date(Date.now() - filter.booked_within_days * 86_400_000)
      .toISOString().slice(0, 10);
    bookingsQuery = bookingsQuery.gte("event_date", since).eq("stripe_payment_status", "paid");
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

  if (filter.tags && filter.tags.length > 0) {
    const { data: tagged } = await supabase
      .from("customer_tags")
      .select("customer_email")
      .eq("tenant_id", tenantId)
      .in("tag_name", filter.tags);
    const taggedEmails = new Set<string>(((tagged as any[]) || []).map((t) => t.customer_email));
    const result = Array.from(taggedEmails).map((email) =>
      baseEmails.get(email) || { email, first_name: "", last_name: "" },
    );
    if (filter.min_total_spent_cents) {
      return result.filter((r) => (spendByEmail.get(r.email) || 0) >= filter.min_total_spent_cents!);
    }
    return result;
  }

  const list = Array.from(baseEmails.values());
  if (filter.min_total_spent_cents) {
    return list.filter((r) => (spendByEmail.get(r.email) || 0) >= filter.min_total_spent_cents!);
  }
  if (!filter.all_customers && !filter.booked_within_days && !filter.tags?.length && !filter.min_total_spent_cents) {
    return [];
  }
  return list;
}
