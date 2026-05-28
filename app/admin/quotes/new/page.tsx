import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { getSiteSettings } from "@/lib/site-settings";
import { getTenantInfo, getTenantPublicUrl } from "@/lib/tenant/business";
import { buildDefaultQuoteMessage } from "../message-template";
import { QuoteEditor } from "../QuoteEditor";

export const dynamic = "force-dynamic";

export default async function NewQuotePage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/dashboard");

  const supabase = createAdminClient();

  const [productsResult, customersResult, settings, tenant, protectionAndWaiverRows] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, slug, price_per_day")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("customers")
      .select("id, first_name, last_name, email, phone, address")
      .order("last_name", { ascending: true })
      .limit(2000),
    getSiteSettings(),
    getTenantInfo(),
    supabase
      .from("site_settings")
      .select("key, value")
      .in("key", [
        "damage_protection_enabled",
        "damage_protection_price_cents",
        "damage_protection_coverage_cents",
        "waiver_enabled",
        "waiver_title",
      ]),
  ]);

  const defaultMessage = buildDefaultQuoteMessage(settings, getTenantPublicUrl(tenant));

  const settingsMap = new Map<string, string>(
    ((protectionAndWaiverRows.data as any[]) || []).map((r) => [r.key, r.value]),
  );
  const editorSettings = {
    damage_protection_enabled: settingsMap.get("damage_protection_enabled") === "true",
    damage_protection_price_cents: parseInt(
      settingsMap.get("damage_protection_price_cents") || "2500",
      10,
    ),
    damage_protection_coverage_cents: parseInt(
      settingsMap.get("damage_protection_coverage_cents") || "50000",
      10,
    ),
    waiver_enabled: (settingsMap.get("waiver_enabled") || "true").toLowerCase() !== "false",
    waiver_title: settingsMap.get("waiver_title") || "Liability Waiver",
  };

  return (
    <QuoteEditor
      products={productsResult.data || []}
      customers={customersResult.data || []}
      defaultMessage={defaultMessage}
      settings={editorSettings}
    />
  );
}
