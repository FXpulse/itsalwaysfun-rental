// AI triage for support tickets.
//
// Given a new ticket, asks OpenAI to:
//   1. Categorize (billing / how-to / bug / cancel / other)
//   2. Set priority (low / normal / high / urgent)
//   3. Find the best matching KB article (by title + content)
//   4. Draft a suggested response that pulls from the article
//   5. Estimate confidence 0-1
//
// Result is stored on the ticket row. Operator reviews the suggestion
// and either sends it (1-click) or escalates manually.

import { createAdminClient } from "@/lib/supabase/admin";

interface KBArticle {
  id: string;
  slug: string;
  title: string;
  body_md: string;
  category: string | null;
}

export interface TriageResult {
  category: string;
  priority: "low" | "normal" | "high" | "urgent";
  suggested_article_id: string | null;
  suggested_article_slug: string | null;
  suggested_response: string;
  confidence: number;
}

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini"; // cheap + fast

export async function triageTicket(input: {
  subject: string;
  body: string;
  tenant_business_name: string | null;
}): Promise<TriageResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  // Load published KB articles to give the model context
  const supabase = createAdminClient({ unscoped: true });
  const { data: articles } = await supabase
    .from("kb_articles")
    .select("id, slug, title, body_md, category")
    .eq("is_published", true);

  const kbContext = ((articles as KBArticle[]) || [])
    .map((a) => `### ${a.title} (slug: ${a.slug})\n${a.body_md.slice(0, 400)}\n`)
    .join("\n");

  const systemPrompt = `You are a support triage agent for RentalFlow, a SaaS for rental businesses. You receive a support ticket from a tenant (a business owner using RentalFlow). You must respond with a JSON object only — no prose, no markdown fences, no explanations outside JSON.

Schema:
{
  "category": "billing" | "how-to" | "bug" | "cancel" | "other",
  "priority": "low" | "normal" | "high" | "urgent",
  "suggested_article_slug": "<slug-from-kb-or-null>",
  "suggested_response": "<2-4 sentence reply that addresses the ticket; if a KB article matches, reference it; be warm but concise>",
  "confidence": <0.0-1.0 — how confident you are the suggestion will resolve the ticket>
}

Available knowledge base articles:

${kbContext || "(no articles yet)"}

Rules:
- "urgent" priority only for production outages, payment failures, or anyone mentioning losing money.
- "high" for blocking issues during a live event.
- "bug" only for clearly broken behavior (something doesn't work as documented).
- "billing" for anything about plan/payments/Stripe/subscription/cancel.
- "how-to" for "how do I…" questions.
- "cancel" overrides others if they're trying to leave.
- Suggested response should NOT promise specific actions on behalf of the operator. Use phrases like "you can follow the steps at…" not "I will…".
- If you can't find a matching KB article, set suggested_article_slug to null and write a brief warm response asking for clarifying info.`;

  const userPrompt = `Subject: ${input.subject}
From: ${input.tenant_business_name || "(unknown tenant)"}

Body:
${input.body}`;

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);

    // Resolve slug to article ID
    let suggested_article_id: string | null = null;
    if (parsed.suggested_article_slug && articles) {
      const match = (articles as KBArticle[]).find((a) => a.slug === parsed.suggested_article_slug);
      if (match) suggested_article_id = match.id;
    }

    return {
      category: parsed.category || "other",
      priority: parsed.priority || "normal",
      suggested_article_id,
      suggested_article_slug: parsed.suggested_article_slug || null,
      suggested_response: parsed.suggested_response || "",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    };
  } catch {
    return null;
  }
}
