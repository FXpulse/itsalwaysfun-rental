// Weekly operator report — runs Mondays 12:00 UTC (8 AM ET).
// AI-generated narrative summary + sent to OPERATOR_REPORT_EMAIL via Resend.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAssistantContext } from "@/lib/superadmin/assistant-context";
import { fetchRevenueData } from "@/lib/superadmin/revenue-data";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export async function GET(req: NextRequest) {
  // Auth gate — Vercel cron passes a bearer token in header, or env CRON_SECRET
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const supabase = createAdminClient({ unscoped: true });
    const ctx = await fetchAssistantContext();
    const rev = await fetchRevenueData();

    // Compare this week vs last week
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { count: ticketsThisWeek } = await supabase
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekAgo);
    const { count: signupsThisWeek } = await supabase
      .from("tenants")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekAgo);

    const apiKey = process.env.OPENAI_API_KEY;
    let narrative = "";
    if (apiKey) {
      const systemPrompt = `You are an analyst writing the weekly operator brief for RentalFlow (multi-tenant SaaS, $99/mo flat). Output a markdown narrative — 4 short sections:

1. **Headline** — single sentence framing the week
2. **The numbers** — bullet list of key metrics with deltas
3. **Wins** — 1-2 positive developments
4. **Watch list** — 1-3 things needing attention next week, each with a specific /superadmin link

Use markdown headers (##), bullets, and bold. Keep total length under 400 words. Casual professional tone. Reference exact numbers — never invent.

LIVE STATE:
- Tenants: ${ctx.tenants.total} total · ${ctx.tenants.active} active · ${ctx.tenants.trialing} trialing · ${ctx.tenants.past_due} past_due · ${ctx.tenants.canceled} canceled
- MRR: $${(ctx.mrr_cents / 100).toLocaleString()}/mo · 30d growth: ${rev.mrr_growth_pct}%
- Signups this week: ${signupsThisWeek ?? 0}
- Tickets opened this week: ${ticketsThisWeek ?? 0}
- Open tickets right now: ${ctx.open_tickets.length} (${ctx.open_tickets.filter((t) => t.priority === "urgent").length} urgent)
- Past-due tenants: ${ctx.past_due_tenants.length}
- Recent errors (24h): ${ctx.recent_errors_24h}
- 30d churn: ${rev.churn_waterfall.churned} tenants
- Best cohort retention: ${rev.cohort_table.length > 0 ? Math.max(...rev.cohort_table.map((c) => c.retention_pct)) : 0}%`;

      const res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.4,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "Write this week's brief." }],
        }),
      });
      if (res.ok) {
        const data: any = await res.json();
        narrative = data.choices?.[0]?.message?.content || "";
      }
    }

    if (!narrative) {
      // Fallback if OpenAI unavailable — straight-up stats
      narrative = `## This week at a glance

- **MRR:** $${(ctx.mrr_cents / 100).toLocaleString()}/mo (${rev.mrr_growth_pct >= 0 ? "+" : ""}${rev.mrr_growth_pct}% 30d)
- **New signups:** ${signupsThisWeek ?? 0}
- **Open tickets:** ${ctx.open_tickets.length}
- **Past-due:** ${ctx.past_due_tenants.length}
- **Errors:** ${ctx.recent_errors_24h}`;
    }

    // Render markdown to simple HTML (keep dependency-free)
    const html = renderEmailHtml(narrative);
    const recipientRaw = process.env.OPERATOR_REPORT_EMAIL ||
                         process.env.ADMIN_ALERT_EMAIL ||
                         "ludmilayhenry@gmail.com";
    const recipient = recipientRaw.split(",").map((s) => s.trim()).filter(Boolean);
    const week = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });

    if (!isEmailConfigured()) {
      return NextResponse.json({
        ok: false,
        error: "email_not_configured",
        narrative,
      });
    }

    const sendResult = await sendEmail({
      to: recipient,
      subject: `📊 RentalFlow weekly brief — ${week}`,
      html,
      text: narrative,
      tags: [{ name: "type", value: "weekly_report" }],
    });

    return NextResponse.json({
      ok: sendResult.ok,
      recipient,
      send_id: sendResult.id,
      error: sendResult.error,
      narrative_length: narrative.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: "internal", detail: e?.message }, { status: 500 });
  }
}

function renderEmailHtml(md: string): string {
  // Lightweight markdown → HTML (headers, bold, bullets, paragraphs, links)
  let html = md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^## (.+)$/gm, "<h2 style='color:#1e1b4b;margin:18px 0 8px;font-size:18px'>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3 style='color:#312e81;margin:14px 0 6px;font-size:15px'>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(.+?)\]\((.+?)\)/g, "<a href='$2' style='color:#6d28d9;text-decoration:underline'>$1</a>")
    .replace(/^- (.+)$/gm, "<li style='margin:4px 0'>$1</li>");
  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li[\s\S]+?(?=<\/li>)<\/li>(?:\s*<li[\s\S]+?<\/li>)*)/g, "<ul style='padding-left:20px;margin:6px 0'>$1</ul>");
  // Paragraphs (consecutive non-tag lines)
  html = html.split(/\n\n+/).map((block) => {
    if (/^<(h2|h3|ul|li)/.test(block.trim())) return block;
    return `<p style='margin:8px 0;line-height:1.55'>${block.replace(/\n/g, "<br>")}</p>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#0f172a;max-width:600px;margin:0 auto;padding:24px">
  <div style="background:linear-gradient(135deg,#6d28d9,#db2777);padding:18px;border-radius:14px;margin-bottom:18px">
    <div style="color:#fce7f3;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700">RentalFlow · Weekly Brief</div>
    <div style="color:white;font-size:22px;font-weight:700;margin-top:4px">Hola Ludmila ☀️</div>
  </div>
  ${html}
  <div style="margin-top:24px;padding-top:18px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b">
    Generated by AI from live platform state.<br>
    <a href="https://getrentalflow.com/superadmin/dashboard" style="color:#6d28d9">Open dashboard →</a>
  </div>
</body></html>`;
}
