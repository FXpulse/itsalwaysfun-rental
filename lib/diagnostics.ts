// System health checks — runs a battery of verifications and returns a list
// of CheckResults to render on /admin/diagnostics. Each check is independent
// and safe to fail (returns a "fail" status, doesn't throw).

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant/server";

export type CheckStatus = "ok" | "warn" | "fail" | "info";

export interface CheckResult {
  group: string;
  name: string;
  status: CheckStatus;
  message: string;
  hint?: string;
}

function ok(group: string, name: string, message: string): CheckResult {
  return { group, name, status: "ok", message };
}
function warn(group: string, name: string, message: string, hint?: string): CheckResult {
  return { group, name, status: "warn", message, hint };
}
function fail(group: string, name: string, message: string, hint?: string): CheckResult {
  return { group, name, status: "fail", message, hint };
}
function info(group: string, name: string, message: string): CheckResult {
  return { group, name, status: "info", message };
}

export async function runAllChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const supabase = createAdminClient({ unscoped: true });

  // ─── ENVIRONMENT VARIABLES ───────────────────────────────────────────
  const envG = "Environment";

  // Stripe
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    results.push(fail(envG, "Stripe secret key", "STRIPE_SECRET_KEY not set", "Add it in Vercel → Settings → Env Vars → Production. Redeploy."));
  } else if (stripeSecret.startsWith("sk_live_")) {
    results.push(ok(envG, "Stripe mode", "LIVE — real charges enabled"));
  } else if (stripeSecret.startsWith("sk_test_")) {
    results.push(warn(envG, "Stripe mode", "TEST mode (no real charges)", "Swap STRIPE_SECRET_KEY + NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to live values when ready to go live."));
  } else {
    results.push(fail(envG, "Stripe secret key", "Unexpected format (doesn't start with sk_live_ or sk_test_)"));
  }

  const stripePub = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!stripePub) {
    results.push(fail(envG, "Stripe publishable key", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY not set"));
  } else {
    const sMode = stripeSecret?.startsWith("sk_live_") ? "live" : "test";
    const pMode = stripePub.startsWith("pk_live_") ? "live" : stripePub.startsWith("pk_test_") ? "test" : "?";
    if (sMode === pMode) {
      results.push(ok(envG, "Stripe key parity", `Secret + publishable both ${sMode}`));
    } else {
      results.push(fail(envG, "Stripe key parity", `MISMATCH: secret=${sMode}, publishable=${pMode}`, "Customer charges will fail. Both keys must be the same mode."));
    }
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    results.push(fail(envG, "Stripe webhook secret", "STRIPE_WEBHOOK_SECRET not set", "Webhook fulfillment (booking marked paid, gift cards issued, extension applied) won't work. Get this from Stripe Dashboard → Developers → Webhooks → Signing secret."));
  } else {
    results.push(ok(envG, "Stripe webhook secret", "Set"));
  }

  // RentalFlow subscription Price ID (Pro plan, $99/mo) — required for
  // tenants to be able to start their paid subscription from /admin/settings/billing
  // after the 30-day trial. Without this, the checkout button errors out.
  if (!process.env.STRIPE_PRICE_PRO) {
    results.push(fail(envG, "RentalFlow Pro Price ID", "STRIPE_PRICE_PRO not set", "Tenants will hit an error when trying to subscribe after their trial. Set this in Vercel env vars (see /superadmin/setup for instructions)."));
  } else {
    const id = process.env.STRIPE_PRICE_PRO;
    results.push(ok(envG, "RentalFlow Pro Price ID", id.length > 30 ? id.slice(0, 30) + "..." : id));
  }

  // Email delivery (provided by RentalFlow — managed for you)
  if (!process.env.RESEND_API_KEY) {
    results.push(fail(envG, "Email delivery", "Not configured", "Transactional emails (booking confirmation, quote follow-up, low-stock alerts) won't send. Contact RentalFlow support."));
  } else {
    results.push(ok(envG, "Email delivery", "Active"));
  }

  // Admin alert email
  if (!process.env.ADMIN_ALERT_EMAIL) {
    results.push(warn(envG, "Admin alert email", "ADMIN_ALERT_EMAIL not set", "Falls back to info@getrentalflow.com. Set this so contact form / low-stock alerts go to YOUR business inbox, not the platform's."));
  } else {
    results.push(ok(envG, "Admin alert email", process.env.ADMIN_ALERT_EMAIL));
  }

  // App URL
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    results.push(warn(envG, "Public app URL", "NEXT_PUBLIC_APP_URL not set", "Email links + webhook callbacks may fall back to a stale URL. Set this to your real domain (e.g. https://yourbusiness.com)."));
  } else {
    results.push(ok(envG, "Public app URL", process.env.NEXT_PUBLIC_APP_URL));
  }

  // Cron secret
  if (!process.env.CRON_SECRET) {
    results.push(fail(envG, "Cron secret", "CRON_SECRET not set", "All cron endpoints (booking emails, quote follow-up, low-stock) will reject Vercel's calls with 401."));
  } else {
    results.push(ok(envG, "Cron secret", "Set"));
  }

  // GHL — primary integration is the API (GHL_API_KEY); webhook URLs are
  // optional per-workflow. As long as API key or any webhook is set, it's OK.
  const ghlAnySet =
    !!process.env.GHL_API_KEY ||
    !!process.env.GHL_WEBHOOK_URL ||
    !!process.env.GHL_BOOKING_WEBHOOK_URL ||
    !!process.env.GHL_QUOTE_WEBHOOK_URL ||
    !!process.env.GHL_REFERRAL_WEBHOOK_URL;
  if (!ghlAnySet) {
    results.push(warn(envG, "GHL integration", "No GHL_API_KEY or webhook URLs set", "Contact form submissions + booking events won't reach GoHighLevel."));
  } else if (process.env.GHL_API_KEY) {
    results.push(ok(envG, "GHL integration", "API key set"));
  } else {
    results.push(ok(envG, "GHL integration", "Webhook URLs set (no API key)"));
  }

  // SMS delivery (provided by RentalFlow — managed for you)
  const twilioFrom = process.env.TWILIO_FROM || process.env.TWILIO_FROM_NUMBER;
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !twilioFrom) {
    results.push(warn(envG, "SMS delivery", "Not configured", "SMS notifications (booking confirmation, driver dispatch) won't send. App still works — emails go out as usual. Contact RentalFlow support to enable."));
  } else {
    results.push(ok(envG, "SMS delivery", "Active"));
  }

  // Error monitoring (provided by RentalFlow — managed for you)
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    results.push(warn(envG, "Error monitoring", "Not configured", "Crashes won't be auto-reported to RentalFlow. App still works. Contact support if you want this enabled."));
  } else {
    results.push(ok(envG, "Error monitoring", "Active"));
  }

  // Inbound email
  if (!process.env.INBOUND_EMAIL_SECRET) {
    results.push(warn(envG, "Inbound email secret", "INBOUND_EMAIL_SECRET not set", "Cloudflare email worker can't post to /api/email/inbound — emails to bookings@ won't appear in the inbox."));
  } else {
    results.push(ok(envG, "Inbound email secret", "Set"));
  }

  // ─── DATABASE TABLES (existence + row counts) ───────────────────────
  const dbG = "Database tables";
  const tablesToCheck = [
    { table: "bookings", critical: true },
    { table: "products", critical: true },
    { table: "inventory_items", critical: true },
    { table: "app_users", critical: true },
    { table: "site_settings", critical: true },
    { table: "admin_audit_log", critical: false },
    { table: "contact_messages", critical: false },
    { table: "quotes", critical: false },
    { table: "booking_expenses", critical: false },
    { table: "overhead_costs", critical: false },
    { table: "overhead_categories", critical: false },
    { table: "booking_expense_categories", critical: false },
    { table: "driver_tax_profiles", critical: false },
    { table: "payout_requests", critical: false },
    { table: "coi_requests", critical: false },
    { table: "gift_cards", critical: false },
  ];
  for (const t of tablesToCheck) {
    const { count, error } = await supabase
      .from(t.table)
      .select("*", { count: "exact", head: true });
    if (error) {
      results.push(
        t.critical
          ? fail(dbG, t.table, error.message, "Run the appropriate supabase/*.sql migration.")
          : warn(dbG, t.table, "Missing or RLS denies access", `Run supabase/${t.table.replace(/_/g, t.table.includes("_") ? "_" : "")}.sql`),
      );
    } else {
      const rows = count || 0;
      results.push(info(dbG, t.table, `${rows.toLocaleString()} row${rows === 1 ? "" : "s"}`));
    }
  }

  // Inventory low_stock_threshold column check
  const { error: lowStockErr } = await supabase
    .from("inventory_items")
    .select("low_stock_threshold")
    .limit(1);
  if (lowStockErr && lowStockErr.message.includes("low_stock_threshold")) {
    results.push(fail(dbG, "inventory_items.low_stock_threshold", "Column missing", "Run supabase/inventory_low_stock.sql"));
  } else if (!lowStockErr) {
    results.push(ok(dbG, "inventory_items.low_stock_threshold", "Column present"));
  }

  // ─── SITE SETTINGS ───────────────────────────────────────────────────
  const settingsG = "Site settings";

  // Resolve the active tenant explicitly so we never depend on whether the
  // proxy wrap fires (it can silently no-op outside request context, and
  // then site_settings rows from OTHER tenants leak into the .maybeSingle()
  // call as "multiple rows" which collapses to null → false "not found").
  const tenantId = getCurrentTenantId();
  results.push(info(settingsG, "active tenant_id", tenantId));

  // ─── TENANT SENDING DOMAIN ───────────────────────────────────────────
  // Policy 2026-06-17: every tenant must have a custom_domain to send
  // customer-facing emails (booking confirmation, reminders, etc.).
  // No domain = those emails skip with a Sentry warning.
  const tenantG = "Tenant";
  if (tenantId && tenantId !== "__marketing__") {
    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("custom_domain, business_name")
      .eq("id", tenantId)
      .maybeSingle();
    const customDomain = (tenantRow as any)?.custom_domain;
    if (!customDomain) {
      results.push(
        fail(
          tenantG,
          "Custom sending domain",
          "No custom_domain configured for this tenant",
          "Customer emails (booking confirmation, reminders, gift card, login OTP) WILL NOT send until you configure a custom domain. Go to /admin/site to set it, then ask Ludmila to verify it in the tenant Resend account.",
        ),
      );
    } else {
      results.push(
        ok(tenantG, "Custom sending domain", customDomain + " — verify it's added to the tenant Resend account"),
      );
    }
  }

  const requiredSettings = [
    { key: "stripe_publishable_key", critical: false },
    { key: "default_driver_hourly_rate_cents", critical: false },
    { key: "1099_nec_threshold_cents", critical: false },
    { key: "low_stock_alert_email", critical: false },
    { key: "damage_protection_enabled", critical: false },
    { key: "min_booking_lead_hours", critical: false },
  ];

  // Fetch all settings for THIS tenant in one go, then build a map. Avoids
  // a per-key roundtrip and removes any ambiguity about which tenant we're
  // scoped to (explicit tenant_id filter instead of relying on the wrap).
  const { data: tenantSettings } = await supabase
    .from("site_settings")
    .select("key, value")
    .eq("tenant_id", tenantId)
    .in(
      "key",
      requiredSettings.map((s) => s.key),
    );

  const settingsMap = new Map<string, string>(
    (tenantSettings || []).map((r: any) => [r.key as string, r.value as string]),
  );

  for (const s of requiredSettings) {
    const v = settingsMap.get(s.key);
    if (v === undefined) {
      results.push(warn(settingsG, s.key, "Setting not found", "Will use code default if not set."));
    } else {
      const displayValue = v.length > 60 ? v.substring(0, 60) + "..." : v;
      results.push(info(settingsG, s.key, displayValue || "(empty)"));
    }
  }

  // ─── DOMAIN DATA CHECKS ──────────────────────────────────────────────
  const dataG = "Data state";

  // Active products
  const { count: activeProducts } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("is_addon", false);
  if (!activeProducts || activeProducts === 0) {
    results.push(fail(dataG, "Active products", "0 active non-addon products", "Customers can't book anything. Activate at least one product."));
  } else {
    results.push(ok(dataG, "Active products", `${activeProducts}`));
  }

  // Active fleet — vehicles + trailers (the app uses two separate tables)
  const [{ count: vehicleCount }, { count: trailerCount }] = await Promise.all([
    supabase.from("vehicles").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("trailers").select("*", { count: "exact", head: true }).eq("is_active", true),
  ]);
  const totalFleet = (vehicleCount || 0) + (trailerCount || 0);
  if (vehicleCount === null && trailerCount === null) {
    results.push(warn(dataG, "Active fleet", "vehicles + trailers tables both missing or inaccessible"));
  } else if (totalFleet === 0) {
    results.push(warn(dataG, "Active fleet", "0 active vehicles/trailers", "Dispatch routes need a vehicle assignment."));
  } else {
    results.push(
      ok(dataG, "Active fleet", `${vehicleCount || 0} vehicle(s) + ${trailerCount || 0} trailer(s)`),
    );
  }

  // Drivers
  const { count: driverCount } = await supabase
    .from("app_users")
    .select("*", { count: "exact", head: true })
    .eq("role", "driver");
  results.push(info(dataG, "Driver accounts", `${driverCount || 0}`));

  // Admin users
  const { count: adminCount } = await supabase
    .from("app_users")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");
  if (!adminCount || adminCount === 0) {
    results.push(fail(dataG, "Admin users", "0 admin accounts", "You can't manage anything without an admin user."));
  } else {
    results.push(ok(dataG, "Admin users", `${adminCount}`));
  }

  // Inventory with thresholds (low-stock alerts will check these)
  const { count: itemsWithThreshold } = await supabase
    .from("inventory_items")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true)
    .gt("low_stock_threshold", 0);
  if (itemsWithThreshold === null) {
    // column missing — already reported above
  } else if (itemsWithThreshold === 0) {
    results.push(warn(dataG, "Low-stock thresholds set", "0 items have a threshold", "Set thresholds on critical items (blowers, sandbags, etc.) so the daily cron alerts you when stock dips."));
  } else {
    results.push(ok(dataG, "Low-stock thresholds set", `${itemsWithThreshold} items monitored`));
  }

  // Active overhead lines
  const { count: activeOverhead } = await supabase
    .from("overhead_costs")
    .select("*", { count: "exact", head: true })
    .is("effective_to", null);
  if (activeOverhead === null) {
    // table missing — already reported above
  } else if (activeOverhead === 0) {
    results.push(warn(dataG, "Active overhead lines", "0 active", "Without overhead recorded, the P&L card shows inflated net profit. Add rent / insurance / software in /admin/overhead."));
  } else {
    results.push(ok(dataG, "Active overhead lines", `${activeOverhead}`));
  }

  // ─── RECENT CRON ACTIVITY ────────────────────────────────────────────
  const cronG = "Cron health";
  const { data: recentAudit } = await supabase
    .from("admin_audit_log")
    .select("action, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const recentActions = (recentAudit as any[]) || [];

  // Last booking-emails run (proxy: any audit_log entry with action LIKE 'cron.%')
  // Since we don't audit cron successes specifically, just report most recent activity.
  if (recentActions.length === 0) {
    // Empty audit log is normal on a fresh DB — gets populated when admin
    // does refunds, payouts, role changes, etc. Not a warning.
    results.push(info(cronG, "Audit log activity", "No entries yet (fills when you do refunds, payouts, etc.)"));
  } else {
    const last = recentActions[0];
    const hoursAgo = Math.round(
      (Date.now() - new Date(last.created_at).getTime()) / 3600000,
    );
    results.push(info(cronG, "Last audit entry", `${last.action} · ${hoursAgo}h ago`));
  }

  // Latest contact_messages — proxy for inbound email worker health
  const { data: lastInbound } = await supabase
    .from("contact_messages")
    .select("source, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastInbound) {
    const hoursAgo = Math.round(
      (Date.now() - new Date(lastInbound.created_at).getTime()) / 3600000,
    );
    results.push(
      info(cronG, "Last contact_message", `${lastInbound.source || "?"} · ${hoursAgo}h ago`),
    );
  } else {
    results.push(info(cronG, "Last contact_message", "no messages yet"));
  }

  // Recent email failures
  const { count: failedEmails } = await supabase
    .from("contact_messages")
    .select("*", { count: "exact", head: true })
    .not("email_send_error", "is", null);
  if (failedEmails && failedEmails > 0) {
    results.push(
      warn(cronG, "Email delivery failures", `${failedEmails} contact messages with email send errors`, "Open /admin/inbox to see the red error banners on each affected message."),
    );
  } else {
    results.push(ok(cronG, "Email delivery failures", "0"));
  }

  return results;
}
