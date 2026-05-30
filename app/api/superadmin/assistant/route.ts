// AI Operator Assistant endpoint.
// Takes a free-form question + recent history, injects platform context,
// returns a streaming-friendly text response.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAssistantContext } from "@/lib/superadmin/assistant-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

export async function POST(req: NextRequest) {
  try {
    // Auth gate — superadmin only
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
      return NextResponse.json({
        answer: "AI assistant is not configured. Set OPENAI_API_KEY in env to enable.",
      });
    }

    const body = await req.json().catch(() => ({}));
    const question: string = (body.question || "").toString().slice(0, 2000);
    const history: Array<{ role: "user" | "assistant"; content: string }> =
      Array.isArray(body.history) ? body.history.slice(-6) : [];
    if (!question) {
      return NextResponse.json({ error: "missing_question" }, { status: 400 });
    }

    const ctx = await fetchAssistantContext();
    const mrr = (ctx.mrr_cents / 100).toLocaleString();

    const systemPrompt = `You are the AI Operator Assistant for RentalFlow, a multi-tenant SaaS run by a single founder (Ludmila). Your job is to answer her questions about the platform using ONLY the live data below. Be concise (2-4 sentences). Use markdown sparingly. When she asks for action items, surface the most-impactful 1-3.

LIVE PLATFORM SNAPSHOT (as of now):
- Tenants: ${ctx.tenants.total} total · ${ctx.tenants.active} active · ${ctx.tenants.trialing} trialing · ${ctx.tenants.past_due} past_due · ${ctx.tenants.canceled} canceled · ${ctx.tenants.suspended} suspended
- MRR: $${mrr}/mo
- Recent signups (last 5): ${ctx.recent_signups.map((s) => `${s.business_name} (${s.status || "no sub"}, ${s.created_at.slice(0, 10)})`).join("; ") || "none"}
- Open support tickets (top 10): ${ctx.open_tickets.map((t) => `[${t.priority || "?"}] ${t.subject}`).join("; ") || "none"}
- Past-due tenants: ${ctx.past_due_tenants.map((t) => `${t.business_name} (${t.days_past_due}d)`).join("; ") || "none"}
- Errors 24h: ${ctx.recent_errors_24h}

Rules:
- If a question is outside this data (e.g. "what's the weather"), say you only know platform state.
- If a question requires data you don't have above, say "I'd need to pull that from <table/system> — want me to run that query?" and offer the link.
- Use exact numbers from above. NEVER invent.
- Speak directly to Ludmila in casual English/Spanish (match her language).`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history,
      { role: "user" as const, content: question },
    ];

    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, temperature: 0.3, messages }),
    });
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: "openai_error", detail: txt.slice(0, 500) }, { status: 502 });
    }
    const data: any = await res.json();
    const answer = data.choices?.[0]?.message?.content || "(no response)";
    return NextResponse.json({ answer });
  } catch (e: any) {
    return NextResponse.json({ error: "internal", detail: e?.message }, { status: 500 });
  }
}
