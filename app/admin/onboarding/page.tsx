import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { getCurrentTenantId } from "@/lib/tenant/server";
import { OnboardingWizard } from "./OnboardingWizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  // Admin only — staff don't run setup wizards
  const me = await getCurrentUserRole();
  if (!me) redirect("/admin/login");
  if (me.role !== "admin") redirect("/admin/dashboard");

  const tenantId = getCurrentTenantId();
  const unscoped = createAdminClient({ unscoped: true });

  const { data: tenant } = await unscoped
    .from("tenants")
    .select("business_name, owner_email, owner_phone, branding, stripe_account_id, onboarding_completed_at")
    .eq("id", tenantId)
    .maybeSingle();

  // Already completed → straight to dashboard
  if (tenant?.onboarding_completed_at) {
    redirect("/admin/dashboard");
  }

  // Fetch site_settings overlay (address, etc.) — scoped client is fine here
  const scoped = createAdminClient();
  const { data: settingsRows } = await scoped
    .from("site_settings")
    .select("key, value")
    .in("key", ["business_address", "business_email", "business_phone", "logo_url"]);
  const settingsMap = new Map<string, string>(
    (settingsRows || []).map((r: any) => [r.key as string, r.value as string]),
  );

  const branding = (tenant?.branding as Record<string, any>) || {};
  const hasLogo = !!branding.logo_url || !!(settingsMap.get("logo_url") || "").trim();
  const hasStripeConnect = !!(tenant as any)?.stripe_account_id;

  const { count: productCount } = await scoped
    .from("products")
    .select("id", { count: "exact", head: true });

  return (
    <OnboardingWizard
      initialBusinessName={tenant?.business_name || ""}
      initialPhone={(tenant as any)?.owner_phone || settingsMap.get("business_phone") || ""}
      initialEmail={settingsMap.get("business_email") || tenant?.owner_email || ""}
      initialAddress={settingsMap.get("business_address") || ""}
      hasLogo={hasLogo}
      hasStripeConnect={hasStripeConnect}
      productCount={productCount || 0}
    />
  );
}
