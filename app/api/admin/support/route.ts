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
  await supabase.from("support_tickets").update({
    ai_category: result.category,
    ai_priority: result.priority,
    ai_suggested_article_id: result.suggested_article_id,
    ai_suggested_response: result.suggested_response,
    ai_confidence: result.confidence,
    ai_processed_at: new Date().toISOString(),
    // Adopt AI's category/priority as our defaults if operator hasn't overridden
    category: result.category,
    priority: result.priority as any,
  }).eq("id", ticketId);
}
