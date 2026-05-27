// Look up the business_name + owner_email of a tenant. Used by email
// senders (booking confirmations, gift cards, COI, quote follow-ups, etc.)
// so each tenant's customer-facing emails use THEIR brand, not RentalFlow's
// or IAF's hardcoded strings.

import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_TENANT_ID } from "./resolve";
import { getCurrentTenantId } from "./server";

export interface TenantInfo {
  id: string;
  business_name: string;
  owner_email: string | null;
  owner_phone?: string | null;
  custom_domain: string | null;
  slug: string;
  branding?: Record<string, any> | null;
}

/** Convert TenantInfo to the EmailBrand shape used by lib/email/templates. */
export function tenantToEmailBrand(t: TenantInfo): {
  name: string;
  phone?: string;
  email?: string;
  primaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
} {
  const branding = (t.branding as Record<string, any>) || {};
  return {
    name: t.business_name,
    phone: t.owner_phone || undefined,
    email: t.owner_email || undefined,
    primaryColor: branding.primary_color,
    accentColor: branding.accent_color,
    logoUrl: branding.logo_url,
  };
}

/** Fetch a tenant's branding info. Used in email templates.
 *  Pass tenantId explicitly when called from a webhook or cron (no
 *  request context). Falls back to request context if omitted. */
export async function getTenantInfo(tenantId?: string): Promise<TenantInfo> {
  const id = tenantId || (() => {
    try {
      return getCurrentTenantId();
    } catch {
      return DEFAULT_TENANT_ID;
    }
  })();

  const supabase = createAdminClient({ unscoped: true });
  const { data } = await supabase
    .from("tenants")
    .select("id, business_name, owner_email, owner_phone, custom_domain, slug, branding")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    return {
      id,
      business_name: "Rental Management",
      owner_email: null,
      custom_domain: null,
      slug: "unknown",
    };
  }
  return data as TenantInfo;
}

/** Convenience: just the business_name. */
export async function getTenantBusinessName(tenantId?: string): Promise<string> {
  const info = await getTenantInfo(tenantId);
  return info.business_name;
}

/** Tenant's public URL (custom domain or subdomain). */
export function getTenantPublicUrl(tenant: TenantInfo): string {
  if (tenant.custom_domain) return `https://${tenant.custom_domain}`;
  return `https://${tenant.slug}.getrentalflow.com`;
}
