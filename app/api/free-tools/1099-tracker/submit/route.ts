// POST /api/free-tools/1099-tracker/submit
//
// Body shape (validated below):
// {
//   email: string,
//   summary: { tax_year, driver_count, drivers_over_threshold, total_paid_cents },
//   marketing_opt_in: boolean,
//   source?: "free_tools/1099-tracker",
//   ref?: "email6"        // signal that the lead came from outbound Email 6
// }

import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { saveLeadMagnetSignup } from "@/lib/marketing/lead-magnet";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

const BodySchema = z.object({
  email: z.string().max(254).refine((v) => EMAIL_RE.test(v), "invalid_email"),
  summary: z.object({
    tax_year: z.number().int().min(2000).max(2100),
    driver_count: z.number().int().min(0),
    drivers_over_threshold: z.number().int().min(0),
    total_paid_cents: z.number().int().min(0),
  }),
  marketing_opt_in: z.boolean().default(false),
  source: z.string().max(120).optional(),
  ref: z.string().max(60).optional(),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.errors[0].message },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const ip = clientIp(req);
  const limit = await rateLimit(`lead_magnet:1099:ip:${ip}`, {
    max: 3,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429 },
    );
  }

  const extraTags: string[] = [];
  if (body.ref === "email6") extraTags.push("email6-engaged");

  const summaryRow = `<tr><td>Drivers tracked</td><td><strong>${body.summary.driver_count}</strong></td></tr>` +
    `<tr><td>Over $600 threshold</td><td><strong>${body.summary.drivers_over_threshold}</strong></td></tr>` +
    `<tr><td>Total paid (${body.summary.tax_year})</td><td><strong>$${(body.summary.total_paid_cents / 100).toFixed(2)}</strong></td></tr>`;

  const html = `
    <p>Thanks for using the free 1099-NEC tracker. Here's a snapshot of what you've entered so far:</p>
    <table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif">
      ${summaryRow}
    </table>
    <p>Reminder: the IRS requires a 1099-NEC for any independent contractor you paid <strong>$600+</strong> in a calendar year. The deadline is <strong>January 31</strong>.</p>
    <p>Your tracker stays in your browser — open <a href="https://getrentalflow.com/free-tools/1099-tracker">getrentalflow.com/free-tools/1099-tracker</a> any time and your data will be there.</p>
    <p>— Ludmila<br>It's Always Fun, LLC · Jacksonville, FL</p>
  `;

  const result = await saveLeadMagnetSignup({
    email: body.email,
    toolName: "1099-tracker",
    source: body.source || "free_tools/1099-tracker",
    payload: {
      tax_year: body.summary.tax_year,
      driver_count: body.summary.driver_count,
      drivers_over_threshold: body.summary.drivers_over_threshold,
      total_paid_cents: body.summary.total_paid_cents,
      ref: body.ref || null,
    },
    marketingOptIn: body.marketing_opt_in,
    email_subject: "Your 1099-NEC tracker snapshot + tax-season tips",
    email_html: html,
    extra_tags: extraTags,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
