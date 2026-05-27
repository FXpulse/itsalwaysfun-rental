"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { getCurrentTenantId } from "@/lib/tenant/db";
import {
  ensureCustomer,
  createSubscriptionCheckout,
  createBillingPortal,
  TIERS,
  type Tier,
} from "@/lib/stripe/billing";
import { logAuditEvent } from "@/lib/audit";

/** Kicks off subscription checkout for the given tier. Returns the
 *  Stripe-hosted checkout URL — caller redirects the user there. */
export async function startSubscriptionCheckout(tier: Tier): Promise<{
  url?: string;
  error?: string;
}> {
  const me = await requireAdmin();
  if (!TIERS[tier]) return { error: "Invalid tier" };
  const tenantId = getCurrentTenantId();
  const supabase = createAdminClient({ unscoped: true });

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, business_name, owner_email, stripe_customer_id, plan")
    .eq("id", tenantId)
    .single();
  if (!tenant) return { error: "Tenant not found" };
  if (tenant.plan === "founder") {
    return { error: "Founder plan — no billing needed" };
  }

  try {
    const customerId = await ensureCustomer({
      tenantId,
      ownerEmail: tenant.owner_email || me.email || "owner@example.com",
      businessName: tenant.business_name,
      existingCustomerId: tenant.stripe_customer_id,
    });

    if (customerId !== tenant.stripe_customer_id) {
      await supabase
        .from("tenants")
        .update({ stripe_customer_id: customerId })
        .eq("id", tenantId);
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://getrentalflow.com";
    const url = await createSubscriptionCheckout({
      customerId,
      tier,
      successUrl: `${baseUrl}/admin/settings/billing?success=1`,
      cancelUrl: `${baseUrl}/admin/settings/billing?canceled=1`,
      trialDays: 30,
    });

    await logAuditEvent({
      userEmail: me.email || "unknown",
      action: "billing.checkout_started",
      entityType: "tenant",
      entityId: tenantId,
      details: { tier, customer_id: customerId },
    });

    return { url };
  } catch (e: any) {
    return { error: e.message || "Checkout failed" };
  }
}

/** Open the Stripe Billing Portal where the tenant manages their card,
 *  views invoices, cancels, upgrades, etc. */
export async function openBillingPortal(): Promise<{
  url?: string;
  error?: string;
}> {
  await requireAdmin();
  const tenantId = getCurrentTenantId();
  const supabase = createAdminClient({ unscoped: true });

  const { data: tenant } = await supabase
    .from("tenants")
    .select("stripe_customer_id")
    .eq("id", tenantId)
    .single();
  if (!tenant?.stripe_customer_id) {
    return { error: "No active subscription yet — start a plan first" };
  }

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://getrentalflow.com";
    const url = await createBillingPortal({
      customerId: tenant.stripe_customer_id,
      returnUrl: `${baseUrl}/admin/settings/billing`,
    });
    return { url };
  } catch (e: any) {
    return { error: e.message || "Portal failed" };
  }
}
