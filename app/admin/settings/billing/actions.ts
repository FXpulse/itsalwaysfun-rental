"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { getCurrentTenantId } from "@/lib/tenant/db";
import {
  ensureCustomer,
  createSubscriptionCheckout,
  createBillingPortal,
  pauseSubscription,
  resumeSubscription,
  switchSubscriptionCadence,
  TIERS,
  type Tier,
  type Cadence,
} from "@/lib/stripe/billing";
import { logAuditEvent } from "@/lib/audit";

/** Kicks off subscription checkout for the given tier. Returns the
 *  Stripe-hosted checkout URL — caller redirects the user there. */
export async function startSubscriptionCheckout(
  tier: Tier,
  cadence: Cadence = "monthly",
): Promise<{
  url?: string;
  error?: string;
}> {
  const me = await requireAdmin();
  if (!TIERS[tier]) return { error: "Invalid tier" };
  if (cadence !== "monthly" && cadence !== "annual") {
    return { error: "Invalid cadence" };
  }
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
      cadence,
      successUrl: `${baseUrl}/admin/settings/billing?success=1`,
      cancelUrl: `${baseUrl}/admin/settings/billing?canceled=1`,
      trialDays: 30,
    });

    await logAuditEvent({
      userEmail: me.email || "unknown",
      action: "billing.checkout_started",
      entityType: "tenant",
      entityId: tenantId,
      details: { tier, cadence, customer_id: customerId },
    });

    return { url };
  } catch (e: any) {
    return { error: e.message || "Checkout failed" };
  }
}

/** Pause the tenant's subscription for N months (1, 3, or 6). Stripe stops
 *  billing until the resume date — useful for seasonal businesses. */
export async function pauseSubscriptionAction(
  months: 1 | 3 | 6,
): Promise<{ success?: true; paused_until?: string; error?: string }> {
  const me = await requireAdmin();
  if (![1, 3, 6].includes(months)) return { error: "Pause must be 1, 3, or 6 months" };
  const tenantId = getCurrentTenantId();
  const supabase = createAdminClient({ unscoped: true });

  const { data: tenant } = await supabase
    .from("tenants")
    .select("stripe_subscription_id")
    .eq("id", tenantId)
    .single();
  if (!tenant?.stripe_subscription_id) {
    return { error: "No active subscription to pause" };
  }

  try {
    const { paused_until } = await pauseSubscription({
      subscriptionId: tenant.stripe_subscription_id,
      months,
    });
    await logAuditEvent({
      userEmail: me.email || "unknown",
      action: "billing.subscription_paused",
      entityType: "tenant",
      entityId: tenantId,
      details: { months, paused_until },
    });
    return { success: true, paused_until };
  } catch (e: any) {
    return { error: e.message || "Pause failed" };
  }
}

/** Resume a paused subscription immediately. */
export async function resumeSubscriptionAction(): Promise<{
  success?: true;
  error?: string;
}> {
  const me = await requireAdmin();
  const tenantId = getCurrentTenantId();
  const supabase = createAdminClient({ unscoped: true });

  const { data: tenant } = await supabase
    .from("tenants")
    .select("stripe_subscription_id")
    .eq("id", tenantId)
    .single();
  if (!tenant?.stripe_subscription_id) {
    return { error: "No subscription to resume" };
  }

  try {
    await resumeSubscription({ subscriptionId: tenant.stripe_subscription_id });
    await logAuditEvent({
      userEmail: me.email || "unknown",
      action: "billing.subscription_resumed",
      entityType: "tenant",
      entityId: tenantId,
      details: {},
    });
    return { success: true };
  } catch (e: any) {
    return { error: e.message || "Resume failed" };
  }
}

/** Switch monthly ↔ annual on an active subscription. Stripe prorates the
 *  difference and adjusts the next invoice automatically. */
export async function switchCadenceAction(
  newCadence: Cadence,
): Promise<{ success?: true; error?: string }> {
  const me = await requireAdmin();
  if (newCadence !== "monthly" && newCadence !== "annual") {
    return { error: "Invalid cadence" };
  }
  const tenantId = getCurrentTenantId();
  const supabase = createAdminClient({ unscoped: true });

  const { data: tenant } = await supabase
    .from("tenants")
    .select("stripe_subscription_id, plan")
    .eq("id", tenantId)
    .single();
  if (!tenant?.stripe_subscription_id) {
    return { error: "No active subscription to switch" };
  }

  try {
    await switchSubscriptionCadence({
      subscriptionId: tenant.stripe_subscription_id,
      newCadence,
      tier: (tenant.plan as Tier) || "pro",
    });
    await logAuditEvent({
      userEmail: me.email || "unknown",
      action: "billing.cadence_switched",
      entityType: "tenant",
      entityId: tenantId,
      details: { new_cadence: newCadence },
    });
    return { success: true };
  } catch (e: any) {
    return { error: e.message || "Cadence switch failed" };
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
