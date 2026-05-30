// POST /api/admin/support — tenant-side ticket submission.
// Triggers AI triage in the background (fire-and-forget). The operator sees
// the ticket immediately, AI suggestion arrives within a few seconds.

import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenant } from "@/lib/tenant/server";
import { triageTicket } from "@/lib/support/ai-triage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  subject: z.string().min(3).max(200),
  body: z.string().min(10).max(20_000),
});

export async function POST(req: Request) {
  const authClient = createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.errors[0].message },
      { status: 400 },
    );
  }

  const tenant = getCurrentTenant();
  const supabase = createAdminClient({ unscoped: true });

  // Pull tenant snapshot
  const { data: tenantRow } = await supabase
    .from("tenants").select("business_name, owner_email")
    .eq("id", tenant.id).maybeSingle();

  // Insert ticket
  const { data: created, error } = await supabase
    .from("support_tickets")
    .insert({
      tenant_id: tenant.id === "__marketing__" ? null : tenant.id,
      tenant_business_name: tenantRow?.business_name || null,
      tenant_owner_email: tenantRow?.owner_email || user.email || null,
      subject: parsed.data.subject,
      body: parsed.data.body,
      status: "open",
      priority: "normal",
    })
    .select("id")
    .single();

  if (error || !created) {
    return NextResponse.json({ error: error?.message || "create_failed" }, { status: 500 });
  }

  // Fire-and-forget AI triage. Operator sees ticket immediately; AI fills in
  // category + suggestion within a few seconds.
  triageAndPatch(created.id, parsed.data, tenantRow?.business_name || null).catch((e) => {
    Sentry.captureException(e, { tags: { stage: "ai_triage" } });
  });

  return NextResponse.json({ success: true, ticket_id: created.id });
}

const AUTO_RESOLVE_THRESHOLD = parseFloat(process.env.AI_AUTO_RESOLVE_THRESHOLD || "0.85");
const AUTO_RESOLVE_ENABLED = process.env.AI_AUTO_RESOLVE_ENABLED !== "false";

async function triageAndPatch(
  ticketId: string,
  input: { subject: string; body: string },
  business_name: string | null,
) {
  const result = await triageTicket({
    subject: input.subject,
    body: input.body,
    tenant_business_name: business_name,
  });
  if (!result) return;
  const supabase = createAdminClient({ unscoped: true });

  // Determine if we should auto-resolve this ticket. Conditions:
  // - Auto-resolve feature flag on (default ON)
  // - AI confidence >= threshold (default 0.85)
  // - Category is one the AI can handle solo (skip "cancel" — needs human)
  // - Response is non-empty
  const canAutoResolve =
    AUTO_RESOLVE_ENABLED &&
    result.confidence >= AUTO_RESOLVE_THRESHOLD &&
    result.category !== "cancel" &&
    result.priority !== "urgent" &&
    result.suggested_response.trim().length > 20;

  const updates: Record<string, any> = {
    ai_category: result.category,
    ai_priority: result.priority,
    ai_suggested_article_id: result.suggested_article_id,
    ai_suggested_response: result.suggested_response,
    ai_confidence: result.confidence,
    ai_processed_at: new Date().toISOString(),
    category: result.category,
    priority: result.priority as any,
  };

  if (canAutoResolve) {
    updates.status = "resolved";
    updates.resolved_at = new Date().toISOString();
    updates.resolved_by_email = "ai-auto-resolve@rentalflow.internal";
    updates.resolution_note = `Auto-resolved by AI (confidence ${result.confidence.toFixed(2)})`;
  }

  await supabase.from("support_tickets").update(updates).eq("id", ticketId);

  // Post the AI response as a reply visible to the tenant when auto-resolving.
  if (canAutoResolve) {
    await supabase.from("support_ticket_replies").insert({
      ticket_id: ticketId,
      author_email: "ai-auto-resolve@rentalflow.internal",
      author_kind: "ai",
      body: result.suggested_response,
      is_internal: false,
    });
    // Increment KB analytics if we cited an article
    if (result.suggested_article_id) {
      // RPC-less increment: read-modify-write is racy but OK for analytics
      const { data: kb } = await supabase
        .from("kb_articles")
        .select("ai_resolved_count")
        .eq("id", result.suggested_article_id)
        .maybeSingle();
      if (kb) {
        await supabase
          .from("kb_articles")
          .update({ ai_resolved_count: (kb.ai_resolved_count || 0) + 1 })
          .eq("id", result.suggested_article_id);
      }
    }
  }
}
