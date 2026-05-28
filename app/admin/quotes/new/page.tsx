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

  const [productsResult, customersResult, settings, tenant] = await Promise.all([
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
  ]);

  const defaultMessage = buildDefaultQuoteMessage(settings, getTenantPublicUrl(tenant));

  return (
    <QuoteEditor
      products={productsResult.data || []}
      customers={customersResult.data || []}
      defaultMessage={defaultMessage}
    />
  );
}
