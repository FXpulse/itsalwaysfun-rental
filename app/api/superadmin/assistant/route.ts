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
const MAX_TOOL_ROUNDS = 6;

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
    const pathname: string = (body.pathname || "").toString();
    if (!question) return NextResponse.json({ error: "missing_question" }, { status: 400 });

    // Extract tenant_id from pathname if on a tenant detail page
    let pageContext = "";
    const tenantMatch = pathname.match(/\/superadmin\/tenants\/([0-9a-f-]{36})/);
    if (tenantMatch) {
      const { data: t } = await supabase
        .from("tenants")
        .select("business_name, slug, plan, subscription_status, owner_email")
        .eq("id", tenantMatch[1]).maybeSingle();
      if (t) pageContext = `\n\nUSER IS CURRENTLY VIEWING tenant: ${t.business_name} (slug: ${t.slug}, plan: ${t.plan}, status: ${t.subscription_status}, owner: ${t.owner_email}). When she asks "this tenant" or makes generic queries, default to this one.`;
    } else if (pathname) {
      pageContext = `\n\nUSER IS CURRENTLY ON: ${pathname}. Frame answers in the context of that page when helpful.`;
    }

    const ctx = await fetchAssistantContext();
    const mrr = (ctx.mrr_cents / 100).toLocaleString();

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const todayHuman = today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const systemPrompt = `You are the AI Operator Assistant for RentalFlow, a multi-tenant SaaS run by a single founder (Ludmila). Help her stay on top of platform state. Be concise (2-4 sentences unless she asks for detail). Use markdown sparingly.

CURRENT DATE: ${todayHuman} (${todayStr}). Use this for "today", "this month", "this week" queries. NEVER assume the date is anything else.

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
- For action requests (suspend, refund, send email), say "I can't take that action yet — try <link>" and link the appropriate /superadmin page.
- BE EFFICIENT with tool calls. Prefer ONE broad query over many narrow ones (e.g. fetch the past_due list once, then summarize — don't call get_tenant for each one).
- You have a budget of ${MAX_TOOL_ROUNDS} tool calls. If you need more, instead give a partial answer with what you have.${pageContext}`;

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

    // Hit MAX_TOOL_ROUNDS without a final answer — force the model to wrap
    // up. tool_choice: "none" is the strict signal that tools are forbidden,
    // so the model MUST produce a text answer with what it already has.
    const finalRes = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        tool_choice: "none",
        messages: [
          ...messages,
          {
            role: "user",
            content: "Based on the data you already pulled, give your best answer now. No more lookups.",
          },
        ],
      }),
    });
    if (finalRes.ok) {
      const finalData: any = await finalRes.json();
      const finalAnswer = finalData.choices?.[0]?.message?.content;
      if (finalAnswer) {
        return NextResponse.json({ answer: finalAnswer, tools_called: toolsCalled });
      }
    }
    return NextResponse.json({
      answer: "I gathered some info but couldn't finalize an answer. Try rephrasing more specifically.",
      tools_called: toolsCalled,
    });
  } catch (e: any) {
    return NextResponse.json({ error: "internal", detail: e?.message }, { status: 500 });
  }
}
