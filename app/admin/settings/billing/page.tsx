import { redirect } from "next/navigation";
import { Receipt } from "lucide-react";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant/db";
import { TIERS } from "@/lib/stripe/billing";
import { BillingPanel } from "./BillingPanel";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/dashboard");

  const tenantId = getCurrentTenantId();
  const supabase = createAdminClient({ unscoped: true });
  const { data: tenant } = await supabase
    .from("tenants")
    .select(
      "id, business_name, plan, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end, cancel_at_period_end, trial_ends_at",
    )
    .eq("id", tenantId)
    .single();

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1 flex items-center gap-2">
        <Receipt className="h-6 w-6" /> Billing
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Manage your RentalFlow subscription. Separate from your Stripe Connect
        (where your customer payments land).
      </p>

      <BillingPanel
        tenant={{
          plan: (tenant?.plan as any) || "starter",
          subscription_status: (tenant?.subscription_status as any) || null,
          current_period_end: tenant?.current_period_end || null,
          cancel_at_period_end: tenant?.cancel_at_period_end || false,
          trial_ends_at: tenant?.trial_ends_at || null,
          has_customer: !!tenant?.stripe_customer_id,
        }}
        tiers={Object.values(TIERS)}
      />
    </div>
  );
}
