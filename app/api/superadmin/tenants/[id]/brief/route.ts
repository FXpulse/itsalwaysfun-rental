// On-demand AI summary of a single tenant.
// POST /api/superadmin/tenants/[id]/brief

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // Auth
  const authClient = createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = createAdminClient({ unscoped: true });
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .eq("is_superadmin", true)
    .maybeSingle();
  if (!roleRow) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured (set OPENAI_API_KEY)" }, { status: 503 });
  }

  // Load tenant + signals
  const { data: tenant } = await supabase
    .from("tenants").select("*").eq("id", params.id).maybeSingle();
  if (!tenant) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ count: bookings30d }, { count: bookingsTotal }, { count: openTickets }, { data: lastBooking }] = await Promise.all([
    supabase.from("bookings").select("*", { count: "exact", head: true })
      .eq("tenant_id", params.id).gte("created_at", monthAgo),
    supabase.from("bookings").select("*", { count: "exact", head: true })
      .eq("tenant_id", params.id),
    supabase.from("support_tickets").select("*", { count: "exact", head: true })
      .eq("tenant_id", params.id).neq("status", "resolved"),
    supabase.from("bookings").select("event_date, customer_first_name, total_amount")
      .eq("tenant_id", params.id).order("event_date", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const accountAgeDays = Math.floor((Date.now() - new Date(tenant.created_at).getTime()) / 86_400_000);

  const systemPrompt = `You're writing a 3-paragraph operator brief on a single RentalFlow tenant. The operator wants to decide: should I reach out, leave alone, or save them? Output markdown — 3 short paragraphs, each prefixed with a bold tag.

Format:
**Snapshot:** <2 sentence summary of where they are right now>
**Trajectory:** <1-2 sentences on trend — getting healthier or churning?>
**Recommended action:** <one specific action with a timeframe — "email this week", "leave alone", "call within 24h", etc.>

Tone: casual, direct, like writing to a peer. Use numbers from the data.

TENANT DATA:
- Business: ${tenant.business_name} (${tenant.slug})
- Plan: ${tenant.plan} · Status: ${tenant.subscription_status || "(no sub)"}${tenant.suspended_at ? " · SUSPENDED" : ""}${tenant.cancel_at_period_end ? " · CANCELLING AT PERIOD END" : ""}
- Account age: ${accountAgeDays} days
- Total bookings: ${bookingsTotal ?? 0}
- Bookings last 30d: ${bookings30d ?? 0}
- Open tickets: ${openTickets ?? 0}
- Last booking: ${lastBooking ? `${lastBooking.event_date} for ${lastBooking.customer_first_name} ($${(lastBooking.total_amount || 0) / 100})` : "none"}
- Custom domain: ${tenant.custom_domain || "none (using subdomain)"}
- Owner email: ${tenant.owner_email}`;

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `Generate brief for ${tenant.business_name}.` }],
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: "openai_error", detail: txt.slice(0, 300) }, { status: 502 });
    }
    const data: any = await res.json();
    const brief = data.choices?.[0]?.message?.content || "";
    return NextResponse.json({ brief, generated_at: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ error: "internal", detail: e?.message }, { status: 500 });
  }
}
