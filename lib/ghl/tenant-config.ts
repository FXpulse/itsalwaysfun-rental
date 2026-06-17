// Per-tenant GoHighLevel config — agency model.
//
// Master agency PIT stays platform-side in GHL_API_KEY env.
// Each tenant has their own sub-account (Location) under that agency.
// Location ID + workflow webhook URLs are stored on the tenants row.
//
// Without a per-tenant location_id, GHL pushes are skipped for that
// tenant — Sentry logs a warning, primary operation succeeds (booking
// is still created, contact form still saves, etc.). This is the same
// pattern as the per-tenant email custom_domain enforcement.

import { createAdminClient } from "@/lib/supabase/admin";

export interface TenantGhlConfig {
  location_id: string;
  booking_webhook_url: string | null;
  abandoned_cart_webhook_url: string | null;
  referral_webhook_url: string | null;
  quote_webhook_url: string | null;
}

/** Returns the per-tenant GHL config. Returns null when the tenant has
 *  no ghl_location_id set — caller must skip the GHL push and surface
 *  a warning. */
export async function getTenantGhlConfig(
  tenantId: string | null,
): Promise<TenantGhlConfig | null> {
  if (!tenantId || tenantId === "__marketing__") return null;
  const supabase = createAdminClient({ unscoped: true });
  const { data: tenant } = await supabase
    .from("tenants")
    .select(
      "ghl_location_id, ghl_booking_webhook_url, ghl_abandoned_cart_webhook_url, ghl_referral_webhook_url, ghl_quote_webhook_url",
    )
    .eq("id", tenantId)
    .maybeSingle();

  const t = tenant as any;
  if (!t?.ghl_location_id) return null;

  return {
    location_id: t.ghl_location_id,
    booking_webhook_url: t.ghl_booking_webhook_url || null,
    abandoned_cart_webhook_url: t.ghl_abandoned_cart_webhook_url || null,
    referral_webhook_url: t.ghl_referral_webhook_url || null,
    quote_webhook_url: t.ghl_quote_webhook_url || null,
  };
}
