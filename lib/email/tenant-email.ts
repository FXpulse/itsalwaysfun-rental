// Tenant-aware email envelope (from + reply-to) for the multi-tenant SaaS.
//
// Two modes:
//
// 1. `inbox_enabled=true` (IAF and any premium tenant with their own
//    inbound mail infrastructure):
//      From:     "Tenant Brand" <bookings@<custom_domain>>
//      Reply-To: bookings@<custom_domain>.net (Cloudflare Worker)
//    Customer replies land in /admin/inbox.
//
// 2. `inbox_enabled=false` (default for new tenants):
//      From:     "Tenant Brand" <noreply@email.getrentalflow.com>
//      Reply-To: <tenant.notification_email> (tenant's own Gmail/Outlook)
//    Customer replies go directly to the tenant's existing personal email.
//    Zero DNS work, zero Resend onboarding, zero /admin/inbox UI.
//
// All sendEmail callers should use getTenantEmailConfig() instead of
// reading process.env.EMAIL_FROM / EMAIL_REPLY_TO directly.

import { createAdminClient } from "@/lib/supabase/admin";

export interface TenantEmailConfig {
  /** Full From header — display name + address: `"Brand" <a@d>`. */
  from: string;
  /** Reply-To address — where customer replies actually land. */
  replyTo: string;
}

const DEFAULT_TENANT_ID = "11111111-1111-1111-1111-111111111111";

/** Strip characters that would break the From header's display-name segment. */
function sanitizeDisplayName(name: string): string {
  return name.replace(/["<>]/g, "").trim() || "RentalFlow";
}

/** Operator-owned sender domain. New tenants use a subdomain of this; IAF
 *  overrides via custom_domain. Verified in Resend (DKIM + SPF). */
const OPERATOR_SENDER_DOMAIN = "email.getrentalflow.com";

/** Pull tenant email config from the DB. Pass a tenantId when sending
 *  cross-tenant (e.g. inbound webhook needs to know which tenant the
 *  reply belongs to). Defaults to IAF when omitted — preserves existing
 *  behavior for any caller that hasn't been refactored yet. */
export async function getTenantEmailConfig(
  tenantId: string | null = null,
): Promise<TenantEmailConfig> {
  const supabase = createAdminClient({ unscoped: true });
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, slug, business_name, custom_domain, owner_email, notification_email, inbox_enabled")
    .eq("id", tenantId || DEFAULT_TENANT_ID)
    .maybeSingle();

  // Tenant missing → fall back to operator branding so the send still goes
  // through (better than throwing). Useful for cron jobs that run before
  // tenant data is loaded.
  if (!tenant) {
    return {
      from: `RentalFlow <noreply@${OPERATOR_SENDER_DOMAIN}>`,
      replyTo: `support@getrentalflow.com`,
    };
  }

  const t = tenant as any;
  const brand = sanitizeDisplayName(t.business_name || "RentalFlow");

  // Mode 1: tenant manages their own inbox + sender domain (IAF)
  if (t.inbox_enabled && t.custom_domain) {
    // IAF specifically: keep .net for Reply-To (Cloudflare Worker route).
    // For other inbox_enabled tenants, fall back to bookings@custom_domain.
    const replyTo =
      t.id === DEFAULT_TENANT_ID
        ? `bookings@itsalwaysfun.net`
        : `bookings@${t.custom_domain}`;
    return {
      from: `${brand} <bookings@${t.custom_domain}>`,
      replyTo,
    };
  }

  // Mode 2 (default): operator-owned sender + tenant's personal reply address
  const replyEmail = t.notification_email || t.owner_email || `support@getrentalflow.com`;
  return {
    from: `${brand} <noreply@${OPERATOR_SENDER_DOMAIN}>`,
    replyTo: replyEmail,
  };
}

/** Helper for callers that already have the tenant row in hand (skip the DB
 *  round trip). Pass the minimum tenant fields you have; missing fields
 *  fall back to operator defaults. */
/** Where admin alerts (contact form notifications, low-stock alerts, etc.)
 *  should land for a given tenant. Falls back to the operator default if no
 *  tenant config available. Use for any tenant → admin notification path. */
export async function getTenantAdminEmail(tenantId: string | null): Promise<string> {
  if (!tenantId) return process.env.ADMIN_ALERT_EMAIL || "admin@itsalwaysfun.com";
  const supabase = createAdminClient({ unscoped: true });
  const { data: t } = await supabase
    .from("tenants")
    .select("notification_email, owner_email")
    .eq("id", tenantId)
    .maybeSingle();
  return (
    (t as any)?.notification_email ||
    (t as any)?.owner_email ||
    process.env.ADMIN_ALERT_EMAIL ||
    "admin@itsalwaysfun.com"
  );
}

export function buildTenantEmailConfig(tenant: {
  id?: string;
  business_name?: string | null;
  custom_domain?: string | null;
  owner_email?: string | null;
  notification_email?: string | null;
  inbox_enabled?: boolean | null;
}): TenantEmailConfig {
  const brand = sanitizeDisplayName(tenant.business_name || "RentalFlow");

  if (tenant.inbox_enabled && tenant.custom_domain) {
    const replyTo =
      tenant.id === DEFAULT_TENANT_ID
        ? `bookings@itsalwaysfun.net`
        : `bookings@${tenant.custom_domain}`;
    return {
      from: `${brand} <bookings@${tenant.custom_domain}>`,
      replyTo,
    };
  }

  const replyEmail =
    tenant.notification_email || tenant.owner_email || `support@getrentalflow.com`;
  return {
    from: `${brand} <noreply@${OPERATOR_SENDER_DOMAIN}>`,
    replyTo: replyEmail,
  };
}
