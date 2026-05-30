// AI Operator Assistant endpoint.
//
// Takes a free-form question + recent history, injects platform context,
// and loops through OpenAI function calling until the model produces a
// final natural-language answer. Tools defined in lib/superadmin/assistant-tools.ts
// are READ-ONLY for now.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAssistantContext } from "@/lib/superadmin/assistant-context";
import { TOOL_DEFINITIONS, executeTool } from "@/lib/superadmin/assistant-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const MAX_TOOL_ROUNDS = 4;

export async function POST(req: NextRequest) {
  try {
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
        answer: "AI assistant is not configured. Set OPENAI_API_KEY to enable.",
        tools_called: [],
      });
    }

    const body = await req.json().catch(() => ({}));
    const question: string = (body.question || "").toString().slice(0, 2000);
    const history: Array<{ role: "user" | "assistant"; content: string }> =
      Array.isArray(body.history) ? body.history.slice(-6) : [];
    if (!question) return NextResponse.json({ error: "missing_question" }, { status: 400 });

    const ctx = await fetchAssistantContext();
    const mrr = (ctx.mrr_cents / 100).toLocaleString();

    const systemPrompt = `You are the AI Operator Assistant for RentalFlow, a multi-tenant SaaS run by a single founder (Ludmila). Help her stay on top of platform state. Be concise (2-4 sentences unless she asks for detail). Use markdown sparingly.

LIVE SNAPSHOT (high-level):
- Tenants: ${ctx.tenants.total} total · ${ctx.tenants.active} active · ${ctx.tenants.trialing} trialing · ${ctx.tenants.past_due} past_due · ${ctx.tenants.canceled} canceled · ${ctx.tenants.suspended} suspended
- MRR: $${mrr}/mo
- Open tickets: ${ctx.open_tickets.length}
- Errors 24h: ${ctx.recent_errors_24h}

You have TOOLS available to look up specific data (past_due list, tenant details, ticket list, recent signups, KB search, revenue summary). USE THEM whenever the question needs more than the snapshot. Don't ask for confirmation before calling a read-only tool — just call it.

Rules:
- Speak directly to Ludmila in her language (English or Spanish — match what she uses).
- Never invent numbers. If you don't know, call a tool.
- If a tool returns 0 results, say so clearly.
- For action requests (suspend, refund, send email), say "I can't take that action yet — try <link>" and link the appropriate /superadmin page.`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: question },
    ];

    const toolsCalled: Array<{ name: string; args: any }> = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.3,
          messages,
          tools: TOOL_DEFINITIONS,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        return NextResponse.json({ error: "openai_error", detail: txt.slice(0, 500) }, { status: 502 });
      }
      const data: any = await res.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) {
        return NextResponse.json({ error: "no_message" }, { status: 502 });
      }
      messages.push(msg);

      const toolCalls = msg.tool_calls || [];
      if (toolCalls.length === 0) {
        return NextResponse.json({
          answer: msg.content || "(no response)",
          tools_called: toolsCalled,
        });
      }

      // Execute each tool and append result message
      for (const tc of toolCalls) {
        const name = tc.function?.name;
        let parsedArgs: any = {};
        try { parsedArgs = JSON.parse(tc.function?.arguments || "{}"); } catch {}
        toolsCalled.push({ name, args: parsedArgs });
        const result = await executeTool(name, parsedArgs);
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        });
      }
    }

    return NextResponse.json({
      answer: "(stopped after max tool rounds — your question may need to be broken into smaller pieces)",
      tools_called: toolsCalled,
    });
  } catch (e: any) {
    return NextResponse.json({ error: "internal", detail: e?.message }, { status: 500 });
  }
}
