// Tenant-side AI assistant. Same pattern as superadmin assistant but
// scoped to the calling tenant's data only.

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { getCurrentTenantId } from "@/lib/tenant/server";
import { TENANT_TOOL_DEFINITIONS, executeTenantTool } from "@/lib/admin/assistant-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const MAX_TOOL_ROUNDS = 6;

export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentUserRole();
    if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = getCurrentTenantId();
    if (!tenantId || tenantId === "__marketing__") {
      return NextResponse.json({ error: "no_tenant" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ answer: "AI assistant is not configured.", tools_called: [] });
    }

    const body = await req.json().catch(() => ({}));
    const question: string = (body.question || "").toString().slice(0, 2000);
    const history: Array<{ role: "user" | "assistant"; content: string }> =
      Array.isArray(body.history) ? body.history.slice(-6) : [];
    if (!question) return NextResponse.json({ error: "missing_question" }, { status: 400 });

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const todayHuman = today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const weekStart = (() => {
      const d = new Date(today);
      const day = d.getDay();
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));   // Monday
      return d.toISOString().slice(0, 10);
    })();

    const systemPrompt = `You are a business operations assistant inside RentalFlow — a rental business management SaaS. The user is a business owner managing their rental company through the /admin panel. Help them understand their business state using the tools below.

CURRENT DATE: ${todayHuman} (${todayStr}). Use this for date ranges. NEVER assume the date is anything else.
- "this month" → ${monthStart} to ${todayStr}
- "this week" → ${weekStart} to ${todayStr}
- "today" → ${todayStr}
- "last 30 days" → 30 days before ${todayStr}

Be concise (2-4 sentences). Use markdown sparingly.

LANGUAGE:
- DEFAULT to English. The vast majority of RentalFlow tenants are US-based.
- ONLY switch to Spanish if the user writes to you in Spanish — then respond in Spanish.

RULES:
- You can ONLY see this tenant's data. Don't reference other businesses.
- Call tools to get exact numbers — NEVER invent.
- For "how do I X?" questions, search the knowledge base first.
- For action requests (book, cancel, refund), say "you can do that from <link>" and link the right /admin page.
- Keep answers business-focused (revenue, bookings, customers, products, operations).
- BE EFFICIENT: prefer ONE broad query (e.g. get_bookings_for_date_range covering a whole week) over many narrow ones (don't loop through each day).
- You have a budget of ${MAX_TOOL_ROUNDS} tool calls. If you need more, give a partial answer instead.`;

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
          tools: TENANT_TOOL_DEFINITIONS,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        return NextResponse.json({ error: "openai_error", detail: txt.slice(0, 500) }, { status: 502 });
      }
      const data: any = await res.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) return NextResponse.json({ error: "no_message" }, { status: 502 });
      messages.push(msg);

      const toolCalls = msg.tool_calls || [];
      if (toolCalls.length === 0) {
        return NextResponse.json({
          answer: msg.content || "(no response)",
          tools_called: toolsCalled,
        });
      }
      for (const tc of toolCalls) {
        const name = tc.function?.name;
        let parsedArgs: any = {};
        try { parsedArgs = JSON.parse(tc.function?.arguments || "{}"); } catch {}
        toolsCalled.push({ name, args: parsedArgs });
        const result = await executeTenantTool(name, parsedArgs, tenantId);
        messages.push({ role: "tool", tool_call_id: tc.id, content: result });
      }
    }

    // Force a final answer after MAX_TOOL_ROUNDS. tool_choice: "none" forbids
    // further tools so the model MUST return text.
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
      answer: "I tried looking this up but kept needing more queries. Try a more specific question.",
      tools_called: toolsCalled,
    });
  } catch (e: any) {
    return NextResponse.json({ error: "internal", detail: e?.message }, { status: 500 });
  }
}
