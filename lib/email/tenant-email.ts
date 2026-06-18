// Tenant-aware email envelope (from + reply-to) for the multi-tenant SaaS.
//
// POLICY (2026-06-17): every tenant must have their own custom_domain.
// No more Mode 2 fallback to `noreply@email.getrentalflow.com`. If a
// tenant hasn't configured a custom_domain, `getTenantEmailConfig()`
// returns null and the caller MUST skip the send.
//
// Why: independent DKIM/SPF per tenant = cleaner deliverability, no
// shared reputation domain, no routing-via-which-Resend-account bug.
// Every tenant's `From:` matches a domain in the tenant Resend account
// they (or Ludmila) verified.
//
// Setup per tenant:
//   1. Tenant configures custom_domain in /admin/site → DNS at the
//      tenant's registrar pointing at Vercel for serving the site.
//   2. Operator (Ludmila) adds that domain to the TENANT Resend account
//      → copy 3 DNS records (SPF + DKIM + DMARC) → tenant adds them at
//      their DNS provider → Resend verifies.
//   3. Once verified, customer emails from that tenant send From:
//      `Tenant Brand <bookings@<custom_domain>>` and land in inbox.
//
// IAF Cloudflare Worker reply route (bookings@itsalwaysfun.net) stays
// as a tenant-specific Reply-To. Other tenants get Reply-To at
// `bookings@<custom_domain>` (their responsibility to receive mail there)
// OR fall back to `tenant.notification_email` if set.

import { createAdminClient } from "@/lib/supabase/admin";

export interface TenantEmailConfig {
  /** Full From header — display name + address: `"Brand" <a@d>`. */
  from: string;
  /** Reply-To address — where customer replies actually land. */
  replyTo: string;
}

const DEFAULT_TENANT_ID = "11111111-1111-1111-1111-111111111111";

function sanitizeDisplayName(name: string): string {
  return name.replace(/["<>]/g, "").trim() || "RentalFlow";
}

/** Pull tenant email config. Returns null when the tenant has no custom
 *  domain configured — caller must skip the send and surface a warning
 *  (admin should configure their domain before sending customer emails). */
export async function getTenantEmailConfig(
  tenantId: string | null = null,
): Promise<TenantEmailConfig | null> {
  const supabase = createAdminClient({ unscoped: true });
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, slug, business_name, custom_domain, owner_email, notification_email")
    .eq("id", tenantId || DEFAULT_TENANT_ID)
    .maybeSingle();

  if (!tenant) return null;
  return buildTenantEmailConfig(tenant as TenantRowForEmail);
}

interface TenantRowForEmail {
  id?: string;
  business_name?: string | null;
  custom_domain?: string | null;
  owner_email?: string | null;
  notification_email?: string | null;
}

/** Synchronous helper for callers that already have the tenant row.
 *  Returns null if the row is missing `custom_domain`. */
export function buildTenantEmailConfig(tenant: {
  id?: string;
  business_name?: string | null;
  custom_domain?: string | null;
  owner_email?: string | null;
  notification_email?: string | null;
}): TenantEmailConfig | null {
  if (!tenant.custom_domain) return null;

  const brand = sanitizeDisplayName(tenant.business_name || "RentalFlow");

  // IAF special case: bookings@itsalwaysfun.net is the Cloudflare Worker
  // route that drops messages into /admin/inbox. Other tenants don't have
  // a Worker — fall back to bookings@<custom_domain> if the tenant manages
  // their own inbox, otherwise to notification_email / owner_email.
  const replyTo =
    tenant.id === DEFAULT_TENANT_ID
      ? `bookings@itsalwaysfun.net`
      : tenant.notification_email ||
        tenant.owner_email ||
        `bookings@${tenant.custom_domain}`;

  return {
    from: `${brand} <bookings@${tenant.custom_domain}>`,
    replyTo,
  };
}

/** Where admin alerts (contact form notifications, low-stock alerts, etc.)
 *  should land for a given tenant. Falls back to the operator default if no
 *  tenant config available. Use for any tenant → admin notification path.
 *  This is unrelated to customer-facing sending — does NOT require a
 *  custom_domain. */
export async function getTenantAdminEmail(tenantId: string | null): Promise<string> {
  const fallback =
    process.env.ADMIN_ALERT_EMAIL || "info@getrentalflow.com";
  if (!tenantId) return fallback;
  const supabase = createAdminClient({ unscoped: true });
  const { data: t } = await supabase
    .from("tenants")
    .select("notification_email, owner_email")
    .eq("id", tenantId)
    .maybeSingle();
  const row = t as
    | { notification_email: string | null; owner_email: string | null }
    | null;
  return row?.notification_email || row?.owner_email || fallback;
}
