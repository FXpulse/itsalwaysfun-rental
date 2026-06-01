// GET /api/cron/low-stock-alert
// Runs daily — finds inventory_items where (quantity_owned - quantity_in_use)
// dropped to or below low_stock_threshold, and emails the admin a digest.
//
// "Smart" re-alert logic: only emails about an item if it's gone BACK above
// the threshold since the last alert. Avoids spam when stock stays low for
// days while you wait for a shipment.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = headers().get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return await Sentry.withMonitor(
    "low-stock-alert",
    async () => {
      if (!isEmailConfigured()) {
        return NextResponse.json({ ok: true, skipped: "email not configured" });
      }

  const supabase = createAdminClient({ unscoped: true });

  // All active items with a threshold set
  const { data: items, error } = await supabase
    .from("inventory_items")
    .select(
      "id, name, category, quantity_owned, quantity_in_use, low_stock_threshold, low_stock_alerted_at, location",
    )
    .eq("is_active", true)
    .gt("low_stock_threshold", 0);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const lowStockNow: any[] = [];
  const recovered: string[] = [];
  for (const it of (items as any[]) || []) {
    const available = (it.quantity_owned || 0) - (it.quantity_in_use || 0);
    const isBelow = available <= it.low_stock_threshold;
    const wasAlerted = !!it.low_stock_alerted_at;

    if (isBelow && !wasAlerted) {
      // Newly below threshold — alert
      lowStockNow.push({ ...it, available });
    } else if (!isBelow && wasAlerted) {
      // Recovered above threshold — clear the flag so it can re-alert next dip
      recovered.push(it.id);
    }
    // else: stays below + already alerted (skip), or stays above + not alerted (skip)
  }

  // Clear the alerted flag on recovered items
  if (recovered.length > 0) {
    await supabase
      .from("inventory_items")
      .update({ low_stock_alerted_at: null })
      .in("id", recovered);
  }

  if (lowStockNow.length === 0) {
    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      checked: items?.length || 0,
      newly_low: 0,
      recovered: recovered.length,
    });
  }

  // Resolve recipient
  const { data: settingRow } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "low_stock_alert_email")
    .maybeSingle();
  const recipient =
    (settingRow?.value as string)?.trim() ||
    process.env.ADMIN_ALERT_EMAIL ||
    "info@getrentalflow.com";       // operator default — IAF tenant can override via site_settings.low_stock_alert_email

  // Group by category for readability
  const byCategory = new Map<string, any[]>();
  for (const it of lowStockNow) {
    if (!byCategory.has(it.category)) byCategory.set(it.category, []);
    byCategory.get(it.category)!.push(it);
  }

  const sections: string[] = [];
  for (const [cat, list] of byCategory.entries()) {
    const rows = list
      .map((it) => {
        const loc = it.location ? ` <span style="color:#94a3b8;">· ${it.location}</span>` : "";
        return `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">
            <strong>${escapeHtml(it.name)}</strong>${loc}
          </td>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace;">
            <span style="color:#dc2626;font-weight:bold;">${it.available}</span>
            <span style="color:#94a3b8;"> / ${it.quantity_owned}</span>
          </td>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace;color:#64748b;">
            ≤ ${it.low_stock_threshold}
          </td>
        </tr>`;
      })
      .join("");
    sections.push(`
      <h3 style="margin:16px 0 8px;color:#0f172a;text-transform:uppercase;font-size:11px;letter-spacing:0.05em;">
        ${escapeHtml(cat)}
      </h3>
      <table style="border-collapse:collapse;width:100%;font-size:13px;border:1px solid #e2e8f0;border-radius:4px;">
        <thead>
          <tr style="background:#f8fafc;color:#64748b;font-size:11px;text-transform:uppercase;">
            <th style="padding:8px 10px;text-align:left;">Item</th>
            <th style="padding:8px 10px;text-align:right;">Available / Owned</th>
            <th style="padding:8px 10px;text-align:right;">Threshold</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`);
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://itsalwaysfun-rental.vercel.app";
  const itemCount = lowStockNow.length;

  const res = await sendEmail({
    to: recipient,
    subject: `⚠ Low stock alert — ${itemCount} item${itemCount === 1 ? "" : "s"} need restocking`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:640px;color:#0f172a;">
<p>The following inventory items dropped to or below their low-stock threshold:</p>
${sections.join("")}
<p style="margin-top:20px;text-align:center;">
  <a href="${baseUrl}/admin/inventory"
     style="background:#1a1a6e;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;font-size:13px;">
     Open inventory →
  </a>
</p>
<p style="color:#94a3b8;font-size:11px;margin-top:24px;">
  You'll only get this alert once per item per low-stock event. Once an item
  is restocked above the threshold and dips below again, the alert resets.
  To change the recipient: <code>/admin/site</code> → site settings →
  <code>low_stock_alert_email</code>.
</p>
</div>`,
    text:
      `Low stock alert (${itemCount} items):\n\n` +
      lowStockNow
        .map(
          (it) =>
            `- ${it.name} (${it.category}): ${it.available}/${it.quantity_owned} available, threshold ${it.low_stock_threshold}`,
        )
        .join("\n") +
      `\n\nOpen: ${baseUrl}/admin/inventory`,
    tags: [{ name: "type", value: "low_stock_alert" }],
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 500 });
  }

  // Mark these items as alerted
  await supabase
    .from("inventory_items")
    .update({ low_stock_alerted_at: new Date().toISOString() })
    .in(
      "id",
      lowStockNow.map((it) => it.id),
    );

  return NextResponse.json({
    ok: true,
        ranAt: new Date().toISOString(),
        checked: items?.length || 0,
        newly_low: lowStockNow.length,
        recovered: recovered.length,
        recipient,
      });
    },
    {
      schedule: { type: "crontab", value: "0 13 * * *" },
      checkinMargin: 5,
      maxRuntime: 5,
      timezone: "UTC",
    },
  );
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
