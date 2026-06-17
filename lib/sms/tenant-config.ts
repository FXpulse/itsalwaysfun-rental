// Per-tenant Twilio config — shared-account model.
//
// Platform owns one Twilio account (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN
// in env). Each tenant has their own phone number under that account.
//
// Without twilio_from_number set, customer-facing SMS for that tenant is
// skipped — Sentry logs a breadcrumb, the email side still goes out.

import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms, isSmsConfigured } from "@/lib/sms/send";

export interface TenantSmsConfig {
  fromNumber: string;
  messagingServiceSid: string | null;
}

/** Returns per-tenant Twilio from-number. Null when not configured. */
export async function getTenantSmsConfig(
  tenantId: string | null,
): Promise<TenantSmsConfig | null> {
  if (!tenantId || tenantId === "__marketing__") return null;
  const supabase = createAdminClient({ unscoped: true });
  const { data: tenant } = await supabase
    .from("tenants")
    .select("twilio_from_number, twilio_messaging_service_sid")
    .eq("id", tenantId)
    .maybeSingle();

  const t = tenant as any;
  if (!t?.twilio_from_number) return null;

  return {
    fromNumber: t.twilio_from_number,
    messagingServiceSid: t.twilio_messaging_service_sid || null,
  };
}

/** Send an SMS on behalf of a tenant. Resolves the tenant's from-number,
 *  skips silently (with Sentry breadcrumb + warning) when not configured.
 *  Use this for any customer-facing SMS — not for platform→operator SMS. */
export async function sendTenantSms(params: {
  tenantId: string | null;
  to: string;
  body: string;
}): Promise<{ ok: boolean; sid?: string; error?: string; skipped?: string }> {
  if (!isSmsConfigured()) {
    return { ok: false, skipped: "twilio_not_configured" };
  }
  const cfg = await getTenantSmsConfig(params.tenantId);
  if (!cfg) {
    Sentry.addBreadcrumb({
      category: "sms",
      message: "Tenant SMS skipped — no twilio_from_number configured",
      level: "info",
      data: { tenant_id: params.tenantId, reason: "no_from_number" },
    });
    Sentry.captureMessage("Tenant SMS skipped — no twilio_from_number", {
      level: "warning",
      tags: { tenant_id: params.tenantId || "", area: "tenant-sms" },
    });
    return { ok: false, skipped: "no_tenant_from_number" };
  }
  return sendSms({
    to: params.to,
    body: params.body,
    from: cfg.fromNumber,
    messagingServiceSid: cfg.messagingServiceSid || undefined,
  });
}
