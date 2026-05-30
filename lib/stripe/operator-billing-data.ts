// Cross-tenant Stripe data for /superadmin/billing.
// Iterates active customers and aggregates invoices + payment health.

import { getStripe } from "./server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface OperatorInvoice {
  id: string;
  tenant_id: string;
  tenant_business_name: string;
  customer_email: string | null;
  amount_paid_cents: number;
  amount_due_cents: number;
  status: string;
  created_at: string;
  hosted_url: string | null;
  pdf_url: string | null;
}

export interface FailedPayment {
  tenant_id: string;
  tenant_business_name: string;
  customer_email: string | null;
  amount_cents: number;
  failure_message: string | null;
  attempted_at: string;
  invoice_id: string | null;
}

export interface OperatorBillingData {
  mrr_total_cents: number;
  mrr_by_plan: Record<string, { count: number; revenue_cents: number }>;
  recent_invoices: OperatorInvoice[];
  failed_payments: FailedPayment[];
  totals: {
    paid_this_month_cents: number;
    paid_ytd_cents: number;
    failed_this_month: number;
  };
}

export async function fetchOperatorBilling(): Promise<OperatorBillingData> {
  const supabase = createAdminClient({ unscoped: true });
  const stripe = getStripe();

  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, business_name, stripe_customer_id, stripe_subscription_id, plan, subscription_status, owner_email")
    .not("stripe_customer_id", "is", null);

  const tenantList = (tenants as any[]) || [];
  const customerToTenant: Record<string, { id: string; business_name: string; plan: string; email: string | null }> = {};
  for (const t of tenantList) {
    customerToTenant[t.stripe_customer_id] = {
      id: t.id,
      business_name: t.business_name || "(unnamed)",
      plan: t.plan || "starter",
      email: t.owner_email,
    };
  }

  // MRR by plan from Supabase (cheap)
  let mrr_total_cents = 0;
  const mrr_by_plan: Record<string, { count: number; revenue_cents: number }> = {};
  for (const t of tenantList) {
    if (t.subscription_status !== "active") continue;
    const planKey = t.plan || "starter";
    if (!mrr_by_plan[planKey]) mrr_by_plan[planKey] = { count: 0, revenue_cents: 0 };
    mrr_by_plan[planKey]!.count++;
    // Flat $99/mo monthly equivalent. Annual would be in current_period_end >100d but we keep simple.
    mrr_by_plan[planKey]!.revenue_cents += 9900;
    mrr_total_cents += 9900;
  }

  // Recent invoices (last 25 across all tenants)
  let recent_invoices: OperatorInvoice[] = [];
  let failed_payments: FailedPayment[] = [];
  let paid_this_month_cents = 0;
  let paid_ytd_cents = 0;
  let failed_this_month = 0;

  try {
    const invoiceList = await stripe.invoices.list({ limit: 25, status: "paid" });
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const yearStart = new Date(monthStart.getFullYear(), 0, 1);

    recent_invoices = invoiceList.data
      .map((inv) => {
        const cust = typeof inv.customer === "string" ? inv.customer : (inv.customer as any)?.id;
        const tenant = customerToTenant[cust];
        if (!tenant) return null;
        return {
          id: inv.id,
          tenant_id: tenant.id,
          tenant_business_name: tenant.business_name,
          customer_email: tenant.email,
          amount_paid_cents: inv.amount_paid || 0,
          amount_due_cents: inv.amount_due || 0,
          status: inv.status || "open",
          created_at: new Date((inv.created || 0) * 1000).toISOString(),
          hosted_url: inv.hosted_invoice_url || null,
          pdf_url: inv.invoice_pdf || null,
        } as OperatorInvoice;
      })
      .filter((x): x is OperatorInvoice => x !== null);

    for (const inv of recent_invoices) {
      const created = new Date(inv.created_at);
      if (created >= monthStart) paid_this_month_cents += inv.amount_paid_cents;
      if (created >= yearStart) paid_ytd_cents += inv.amount_paid_cents;
    }

    // Failed payments (open + uncollectible)
    const failed = await stripe.invoices.list({ limit: 20, status: "uncollectible" });
    const open = await stripe.invoices.list({ limit: 20, status: "open" });
    const allFailed = [...failed.data, ...open.data];
    failed_payments = allFailed
      .filter((inv) => (inv.attempt_count || 0) > 0)
      .map((inv) => {
        const cust = typeof inv.customer === "string" ? inv.customer : (inv.customer as any)?.id;
        const tenant = customerToTenant[cust];
        if (!tenant) return null;
        return {
          tenant_id: tenant.id,
          tenant_business_name: tenant.business_name,
          customer_email: tenant.email,
          amount_cents: inv.amount_due || 0,
          failure_message: (inv as any).last_finalization_error?.message || null,
          attempted_at: new Date((inv.created || 0) * 1000).toISOString(),
          invoice_id: inv.id,
        } as FailedPayment;
      })
      .filter((x): x is FailedPayment => x !== null);
    failed_this_month = failed_payments.filter((f) => new Date(f.attempted_at) >= monthStart).length;
  } catch {
    // Stripe call failed — return what we have
  }

  return {
    mrr_total_cents,
    mrr_by_plan,
    recent_invoices,
    failed_payments,
    totals: { paid_this_month_cents, paid_ytd_cents, failed_this_month },
  };
}
