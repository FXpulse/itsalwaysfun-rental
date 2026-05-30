// Daily AI-generated insight for the operator dashboard.
// Idempotent per day — generates once on the first dashboard load of the day
// and caches the row in public.daily_insights.

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAssistantContext } from "./assistant-context";

export interface DailyInsight {
  insight_date: string;
  whats_working: string;
  needs_attention: string;
  today_focus: string;
  generated_at: string;
}

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

export async function getOrGenerateTodayInsight(): Promise<DailyInsight | null> {
  const supabase = createAdminClient({ unscoped: true });
  const today = new Date().toISOString().slice(0, 10);

  // Already generated for today?
  const { data: existing } = await supabase
    .from("daily_insights")
    .select("*")
    .eq("insight_date", today)
    .maybeSingle();
  if (existing) return existing as DailyInsight;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const ctx = await fetchAssistantContext();
  const mrr = (ctx.mrr_cents / 100).toLocaleString();

  const systemPrompt = `You are an analyst for RentalFlow, a multi-tenant rental SaaS. Generate ONE daily digest based on the live platform state. Output strict JSON only — no prose, no fences. Schema:

{
  "whats_working": "<1-2 sentences highlighting positive metrics from today's snapshot. Reference specific numbers.>",
  "needs_attention": "<1-2 sentences identifying the top risk or issue. Reference specific numbers. If everything is healthy, say so.>",
  "today_focus": "<1 specific action recommendation for today. Concrete, actionable, leverages an existing /superadmin page.>"
}

Use casual professional English. NEVER invent numbers — pull only from the snapshot.

LIVE SNAPSHOT:
- Tenants: ${ctx.tenants.total} total · ${ctx.tenants.active} active · ${ctx.tenants.trialing} trialing · ${ctx.tenants.past_due} past_due · ${ctx.tenants.canceled} canceled · ${ctx.tenants.suspended} suspended
- MRR: $${mrr}/mo
- Open tickets: ${ctx.open_tickets.length} (${ctx.open_tickets.filter((t) => t.priority === "urgent").length} urgent, ${ctx.open_tickets.filter((t) => t.priority === "high").length} high)
- Recent signups (5d): ${ctx.recent_signups.length}
- Past-due count: ${ctx.past_due_tenants.length}
- Errors 24h: ${ctx.recent_errors_24h}`;

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "Generate today's digest." }],
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);

    const row = {
      insight_date: today,
      whats_working: parsed.whats_working || "",
      needs_attention: parsed.needs_attention || "",
      today_focus: parsed.today_focus || "",
      raw_content: content,
    };
    const { data: inserted } = await supabase
      .from("daily_insights")
      .upsert(row, { onConflict: "insight_date" })
      .select()
      .single();
    return (inserted as DailyInsight) || null;
  } catch {
    return null;
  }
}
