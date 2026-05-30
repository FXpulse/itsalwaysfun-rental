// POST /api/superadmin/email/[threadId]/suggest-reply
// Generates an AI draft reply for an email thread.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export async function POST(_req: NextRequest, { params }: { params: { threadId: string } }) {
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
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  // Load thread + messages
  const { data: thread } = await supabase
    .from("email_threads").select("*").eq("id", params.threadId).maybeSingle();
  if (!thread) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: messages } = await supabase
    .from("email_messages")
    .select("direction, from_address, to_addresses, body_text, body_html, sent_at, received_at")
    .eq("thread_id", params.threadId)
    .order("received_at", { ascending: true, nullsFirst: true });

  const msgs = (messages as any[]) || [];
  if (msgs.length === 0) return NextResponse.json({ error: "no_messages" }, { status: 400 });

  // Strip HTML tags for context
  function strip(html: string): string {
    return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  }

  const lastIncoming = [...msgs].reverse().find((m) => m.direction === "incoming");
  if (!lastIncoming) return NextResponse.json({ error: "no_incoming_to_reply_to" }, { status: 400 });

  const conversationContext = msgs.slice(-5).map((m) => {
    const body = m.body_text || strip(m.body_html || "");
    return `${m.direction === "incoming" ? "THEM" : "US"} (${m.from_address}): ${body.slice(0, 800)}`;
  }).join("\n\n");

  // Load some recent KB snippets for context
  const { data: kbArticles } = await supabase
    .from("kb_articles")
    .select("title, slug, body_md")
    .eq("is_published", true)
    .limit(20);
  const kbContext = ((kbArticles as any[]) || [])
    .map((a) => `${a.title} (${a.slug}): ${a.body_md.slice(0, 200)}`)
    .join("\n");

  const systemPrompt = `You're drafting an email reply on behalf of Ludmila, the founder/operator of RentalFlow (multi-tenant rental SaaS, $99/mo flat). She runs the company solo and uses AI to handle inbox volume.

Style guide:
- Warm but concise. 2-4 short paragraphs max.
- Match the sender's language (Spanish or English).
- Sign off with "Ludmila" or "— Ludmila" — no "Best regards" formality.
- If the question maps to a KB article, naturally reference it like "we have a guide at /admin/help that covers this".
- NEVER make commitments on Ludmila's behalf about future features, refunds, or specific calls. Phrase those as "let me check on this and get back to you" if needed.
- If you don't have enough info, ask one specific clarifying question.

KNOWLEDGE BASE (use only what's relevant):
${kbContext.slice(0, 4000)}

CONVERSATION SO FAR:
${conversationContext}

Output ONLY the reply body — no subject line, no headers, no quoting the previous message. Plain text with line breaks.`;

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Draft the reply now." },
        ],
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: "openai_error", detail: txt.slice(0, 300) }, { status: 502 });
    }
    const data: any = await res.json();
    const draft = data.choices?.[0]?.message?.content || "";
    return NextResponse.json({ draft, generated_at: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ error: "internal", detail: e?.message }, { status: 500 });
  }
}
