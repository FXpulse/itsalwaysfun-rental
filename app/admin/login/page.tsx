// Login page — server component that resolves the current tenant's
// business name then renders the client form. So tenants logging into
// their own subdomain see THEIR brand, not "It's Always Fun".

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant/server";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const tenantId = getCurrentTenantId();
  const supabase = createAdminClient({ unscoped: true });
  const { data } = await supabase
    .from("tenants")
    .select("business_name")
    .eq("id", tenantId)
    .maybeSingle();
  const businessName = data?.business_name || "Rental management";

  return <LoginForm businessName={businessName} />;
}
