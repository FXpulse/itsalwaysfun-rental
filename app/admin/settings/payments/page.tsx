import { redirect } from "next/navigation";
import { CreditCard } from "lucide-react";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant/db";
import { getConnectStatus } from "@/lib/stripe/connect";
import { StripeConnectPanel } from "./StripeConnectPanel";

export const dynamic = "force-dynamic";

export default async function PaymentsSettingsPage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/dashboard");

  const tenantId = getCurrentTenantId();
  const supabase = createAdminClient({ unscoped: true });

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, slug, business_name, stripe_account_id, stripe_account_status")
    .eq("id", tenantId)
    .single();

  const status = await getConnectStatus(tenant?.stripe_account_id || null);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1 flex items-center gap-2">
        <CreditCard className="h-6 w-6" /> Payments
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Connect your Stripe account so customer payments flow directly to your
        bank. RentalFlow charges a monthly subscription, not per-transaction
        fees — 100% of each booking goes to you.
      </p>

      <StripeConnectPanel
        tenant={{
          id: tenant?.id || tenantId,
          business_name: tenant?.business_name || "Your business",
          stripe_account_id: tenant?.stripe_account_id || null,
        }}
        status={status}
      />

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded p-4 text-sm">
        <h3 className="font-bold text-blue-900 mb-2">How it works</h3>
        <ol className="list-decimal pl-5 space-y-1 text-xs text-blue-900">
          <li>Click <strong>Connect Stripe</strong> → redirects to Stripe Express onboarding</li>
          <li>Stripe asks for your business + bank details (~5 min)</li>
          <li>Returns here with status "Active"</li>
          <li>All bookings now charge customers' cards → money lands in your Stripe → auto-payout to your bank (2-day rolling)</li>
          <li>Use <strong>Open Stripe Dashboard</strong> any time to manage payouts, refunds, tax forms, etc.</li>
        </ol>
      </div>
    </div>
  );
}
