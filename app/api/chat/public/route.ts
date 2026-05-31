// Public AI chat endpoint. Anyone visiting a tenant's public site can chat.
// No auth required — but rate-limited per IP. Tools are READ-ONLY.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PUBLIC_TOOL_DEFINITIONS, executePublicTool } from "@/lib/chat/public-tools";
import { getTenantBusinessName } from "@/lib/tenant/business";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const MAX_TOOL_ROUNDS = 6;

// Simple in-memory rate limit (per Vercel instance — not bulletproof but
// deters casual abuse). 10 messages per IP per 5 minutes.
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 5 * 60_000;

export async function POST(req: NextRequest) {
  try {
    // Rate limit
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    const now = Date.now();
    const entry = rateMap.get(ip);
    if (entry && entry.resetAt > now) {
      if (entry.count >= RATE_LIMIT) {
        return NextResponse.json(
          { error: "rate_limited", retry_after_seconds: Math.ceil((entry.resetAt - now) / 1000) },
          { status: 429 },
        );
      }
      entry.count++;
    } else {
      rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        answer: "Our chat isn't set up yet — please use the contact form or call us.",
      });
    }

    const body = await req.json().catch(() => ({}));
    const question: string = (body.question || "").toString().slice(0, 1000);
    const history: Array<{ role: "user" | "assistant"; content: string }> =
      Array.isArray(body.history) ? body.history.slice(-6) : [];
    if (!question) return NextResponse.json({ error: "missing_question" }, { status: 400 });

    // Resolve business name (tenant scope is automatic via headers)
    let businessName = "us";
    try { businessName = await getTenantBusinessName(); } catch {}

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const todayHuman = today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const systemPrompt = `You are a friendly, helpful booking assistant for ${businessName}, a party rental business. Visitors on our website can chat with you to get answers about rentals, pricing, availability, and policies.

YOUR GOAL: Help the customer find what they want and guide them to book at /order-by-date.

CURRENT DATE: ${todayHuman} (${todayStr}). Use this for "this weekend", "tomorrow", "next month" queries.

LANGUAGE:
- DEFAULT to English (most customers are US-based).
- Switch to Spanish if the customer writes in Spanish.

TONE:
- Warm, casual, brief (1-3 sentences usually).
- Use the business name "${businessName}" — not generic "we" everywhere.
- Be honest if you don't know something — direct them to call or use the contact page.

RULES:
- ALWAYS use tools to get real data — pricing, availability, FAQ answers, business info.
- NEVER invent prices, dates, or policies. If you can't find it via tools, say so.
- ALWAYS link to relevant pages:
  - General catalog → /rentals
  - Specific product page → /items/<slug>
  - Booking flow → /order-by-date
  - Specific date booking → /order-by-date?date=YYYY-MM-DD
  - Contact form → /contact
  - FAQ page → /info/faqs
- After answering, add a gentle nudge: "Want to check availability?" or "Ready to reserve?" linking to /order-by-date.
- If asked for something we don't offer or you can't help with, politely point them to the contact form.

YOU CANNOT:
- Make bookings, take payments, cancel, refund, or modify anything. Make that clear if asked.
- Promise specific times/discounts beyond what you've verified via tools.
- Share personal data (other customers' info).

START LIGHT: keep first response brief. Don't dump 10 products — ask what they're looking for.`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: question },
    ];

    const toolsCalled: Array<{ name: string }> = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.4,
          messages,
          tools: PUBLIC_TOOL_DEFINITIONS,
        }),
      });
      if (!res.ok) {
        return NextResponse.json({ error: "openai_error" }, { status: 502 });
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
        toolsCalled.push({ name });
        const result = await executePublicTool(name, parsedArgs);
        messages.push({ role: "tool", tool_call_id: tc.id, content: result });
      }
    }

    // Force final answer if we hit the round budget
    const finalRes = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        tool_choice: "none",
        messages: [
          ...messages,
          { role: "user", content: "Based on the info you have, give your best answer now." },
        ],
      }),
    });
    if (finalRes.ok) {
      const finalData: any = await finalRes.json();
      const finalAnswer = finalData.choices?.[0]?.message?.content;
      if (finalAnswer) return NextResponse.json({ answer: finalAnswer, tools_called: toolsCalled });
    }
    return NextResponse.json({
      answer: "Hmm, I'm having trouble looking that up — please use /contact and we'll get back to you fast.",
      tools_called: toolsCalled,
    });
  } catch (e: any) {
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
