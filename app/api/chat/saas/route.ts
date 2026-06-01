// SaaS marketing chat — for visitors to getrentalflow.com.
// Different from /api/chat/public (tenant-side) — this one is for prospects
// considering RentalFlow as a product. Goal: convert visitor → signup.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

// Rate limit: 12 messages/IP/5min (slightly more generous than tenant chat
// since prospects need a bit more back-and-forth before signing up).
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 12;
const RATE_WINDOW_MS = 5 * 60_000;

const SYSTEM_PROMPT = `You are the booking assistant for RentalFlow — a SaaS platform for rental businesses (bouncy houses, party rentals, event rentals, equipment rentals). Visitors on getrentalflow.com are PROSPECTS considering RentalFlow as a tool for their own business.

YOUR GOAL: Help the prospect understand the product + convert them to a free trial signup at getrentalflow.com/signup.

TONE:
- Warm + casual, like Henry the founder talking to another rental owner
- Honest — never overclaim. If something doesn't exist yet, say so + point to the roadmap.
- Brief (2-4 sentences usually). The visitor is busy.

LANGUAGE:
- DEFAULT to English. The vast majority of prospects are US-based.
- Switch to Spanish ONLY if the visitor writes to you in Spanish.

==== WHAT YOU KNOW (cite this freely) ====

PRODUCT POSITIONING:
- RentalFlow is an all-in-one operating system for rental businesses.
- Built BY a rental business owner (Henry) FOR rental business owners.
- The founder runs "It's Always Fun, LLC" — a Jacksonville bouncy house company — entirely on RentalFlow. So this software is battle-tested on a real business every single day.
- Focus: events / parties / inflatables. Not the right fit for: heavy equipment B2B rental (think dumpsters, construction).

PRICING:
- $99/month flat. ALL features included.
- $990/year — saves 17% vs monthly.
- 14-day free trial — no credit card required.
- Pause subscription 1/3/6 months for off-season (Stripe auto-resumes).
- Cancel any time — data accessible for 90 days for export.
- NO per-user fees, NO per-booking fees, NO setup fees, NO transaction fees beyond Stripe's standard 2.9% + $0.30.

WHAT'S INCLUDED:
- Online booking with calendar-aware availability
- Stripe Connect payments (money goes direct to YOUR bank)
- Inventory + product catalog with bulk CSV upload
- Dispatch routes with mobile driver PWA
- Customer portal with Domino's-style booking timeline
- Quote system with approval flow + 24h payment hold
- 6 AI agents (see below)
- Email lifecycle (5 automated booking emails) + custom campaigns
- SMS via Twilio integration (confirmations + reminders)
- Loyalty points + referral commission tracking
- Coupons + gift cards (admin-issued and public-sale)
- API keys + webhooks (Zapier/Make ready)
- Calendar ICS feed for Google Calendar / Apple Calendar
- Reports: P&L, monthly trends, customer LTV, drivers, 1099-NEC
- White-label public site with your domain
- Custom domain at no extra cost

THE 6 AI AGENTS:
1. Public AI Chat Receptionist — answers customer questions on your public site 24/7
2. AI Email Reply Drafts — 1-click draft replies for inbox using your KB
3. AI Ticket Triage + Auto-Resolve — handles simple support automatically (confidence > 0.85)
4. AI Business Assistant — floating bubble in your /admin, ask questions about YOUR live data
5. AI Daily Brief — every morning on dashboard: what's working, what needs attention, today's focus
6. AI Per-Tenant Brief (operator side) — for the SaaS operator to diagnose tenant health

VS COMPETITORS (concise honest comparison):
- Goodshuffle Pro: $199+/mo, strong dispatch + crew features, no AI built-in, owner not running a rental business
- Booqable: $30+/mo (cheaper for very small), more inventory-focused, fewer rental-event features, no AI
- Inflatable Office: $99+/mo, specialized to inflatables, mature feature set, no AI built-in, less developer-friendly (no public API)
- RentalFlow advantage: AI baked in, flat pricing, founder runs IAF on it, modern API + webhooks

WHO IT'S FOR:
- Bouncy house / inflatable rental owners (1-50 units)
- Party rental companies (tables, chairs, tents)
- Event rental businesses scaling past Excel + Google Forms
- Owner-operators who want to keep being owners, not become admins

WHO IT'S NOT FOR:
- Heavy equipment B2B rental (construction, dumpsters)
- Multi-thousand-SKU rental warehouses
- Businesses that don't want any automation

HOW TO GET STARTED:
- Sign up: getrentalflow.com/signup (no credit card)
- Free tools (lead magnets): getrentalflow.com/free-tools (1099 tracker etc.)
- Talk to founder: getrentalflow.com/contact
- Trial: 14 days free, bulk CSV import, live in <1 hour

ROADMAP (mention if asked, don't overclaim):
- Multi-language (Spanish on tenant admin) — Q3
- PWA push notifications — Q3
- WhatsApp Business integration — Q3
- Voice AI for inbound calls (Vapi.ai) — Q4
- Drag-drop workflow builder UI — Q4

==== RULES ====

- ALWAYS link to relevant pages when helpful: /signup, /free-tools, /contact, /pricing, /demo
- After answering a question, nudge: "Want to try it free?" with /signup link.
- If asked something you don't know (e.g. "does it support X esoteric feature"), say "Honestly not sure if X is built — let me connect you with our team at /contact" or "Try it free at /signup — 14 days, no card, you'll see fast if it fits".
- NEVER make commitments about future features beyond what's stated in the roadmap above.
- NEVER overclaim. If a competitor has a feature we don't, be honest.
- For pricing discount requests: we don't discount. Annual saves 17%. That's the only "discount" we offer.
- For "can I get a demo": yes — /contact has a form to schedule a 15-min call with the founder.
- Be specific: cite features, numbers, page URLs.

START LIGHT on first response. Don't dump everything. Ask what they're trying to solve or what business they run.`;

export async function POST(req: NextRequest) {
  try {
    // Rate limit per IP
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
        answer: "Our chat is temporarily offline — please use the contact form at /contact and we'll get back to you fast.",
      });
    }

    const body = await req.json().catch(() => ({}));
    const question: string = (body.question || "").toString().slice(0, 1000);
    const history: Array<{ role: "user" | "assistant"; content: string }> =
      Array.isArray(body.history) ? body.history.slice(-8) : [];
    if (!question) return NextResponse.json({ error: "missing_question" }, { status: 400 });

    const today = new Date();
    const todayHuman = today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const fullSystemPrompt = `${SYSTEM_PROMPT}\n\nCURRENT DATE: ${todayHuman}.`;

    const messages = [
      { role: "system", content: fullSystemPrompt },
      ...history,
      { role: "user", content: question },
    ];

    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.5,
        messages,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json(
        { error: "openai_error", detail: txt.slice(0, 300) },
        { status: 502 },
      );
    }
    const data: any = await res.json();
    const answer = data.choices?.[0]?.message?.content || "Sorry, didn't catch that.";
    return NextResponse.json({ answer });
  } catch (e: any) {
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
