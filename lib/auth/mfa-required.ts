// Tenant MFA enforcement helpers.
//
// site_settings.key = 'require_admin_mfa' (text 'true' | 'false', default 'false')
// controls whether admin-role users in this tenant must enroll TOTP before
// they can reach any /admin page (except /admin/settings/security + /admin/logout).
//
// Read from the admin layout (server component) — NOT middleware, since
// middleware shouldn't take an extra DB round trip per /admin/* request.

import { createAdminClient } from "@/lib/supabase/admin";

const REQUIRE_ADMIN_MFA_KEY = "require_admin_mfa";

/** Returns true if this tenant requires admin users to have 2FA enrolled. */
export async function isAdminMfaRequired(tenantId: string): Promise<boolean> {
  if (!tenantId) return false;
  const supabase = createAdminClient({ unscoped: true });
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("key", REQUIRE_ADMIN_MFA_KEY)
    .maybeSingle();
  // Missing row = not required. The default is OFF for existing tenants;
  // new tenants get a 'false' row from the migration above + seed function.
  return (data as any)?.value === "true";
}

/** Verified TOTP factor lookup. Returns true if the user has at least one
 *  TOTP factor in `verified` status. Unverified (just-enrolled-but-not-
 *  confirmed) factors don't count. */
export async function userHasVerifiedTotpFactor(
  userId: string,
): Promise<boolean> {
  const supabase = createAdminClient({ unscoped: true });
  // auth.mfa.listFactors() reads the current session's factors; we can't
  // use it from server context without session. Query the underlying
  // auth.mfa_factors table via service-role.
  const { data } = await supabase.schema("auth").from("mfa_factors").select(
    "id, status, factor_type",
  ).eq("user_id", userId).eq("factor_type", "totp").eq("status", "verified");
  return (data?.length ?? 0) > 0;
}
