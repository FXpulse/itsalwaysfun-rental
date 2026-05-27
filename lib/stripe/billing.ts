// Stripe Subscriptions for tenant billing (RentalFlow charges tenants
// their monthly plan). Separate from Stripe Connect (which routes
// customer payments to the tenant's bank).
//
// Setup outside code:
//   1. Stripe Dashboard → Products → create 3 products (Starter, Pro,
//      Enterprise) with monthly recurring prices ($99 / $199 / $499)
//   2. Copy each Price ID and set as env vars:
//      STRIPE_PRICE_STARTER=price_xxx
//      STRIPE_PRICE_PRO=price_xxx
//      STRIPE_PRICE_ENTERPRISE=price_xxx

import { getStripe } from "./server";

export type Tier = "starter" | "pro" | "enterprise";

export interface TierInfo {
  id: Tier;
  name: string;
  price_cents: number;
  price_id_env_var: string;
  features: string[];
}

export const TIERS: Record<Tier, TierInfo> = {
  starter: {
    id: "starter",
    name: "Starter",
    price_cents: 9900,
    price_id_env_var: "STRIPE_PRICE_STARTER",
    features: [
      "Up to 50 bookings/month",
      "Online booking page",
      "Stripe payments",
      "Email confirmations",
      "Calendar + inventory",
      "Basic reports",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price_cents: 19900,
    price_id_env_var: "STRIPE_PRICE_PRO",
    features: [
      "Unlimited bookings",
      "Custom domain",
      "Quotes + gift cards + packages",
      "SMS confirmations",
      "Advanced reports + P&L",
      "1099-NEC year-end automation",
      "Liability waiver + COI",
      "Loyalty program",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    price_cents: 49900,
    price_id_env_var: "STRIPE_PRICE_ENTERPRISE",
    features: [
      "Everything in Pro",
      "Multi-location",
      "API access + Zapier",
      "Priority support",
      "Custom integrations",
      "Dedicated onboarding",
    ],
  },
};

export function getPriceIdForTier(tier: Tier): string | null {
  const envName = TIERS[tier]?.price_id_env_var;
  if (!envName) return null;
  const id = process.env[envName];
  return id || null;
}

/** Ensure the tenant has a Stripe Customer. Creates if missing. */
export async function ensureCustomer(params: {
  tenantId: string;
  ownerEmail: string;
  businessName: string;
  existingCustomerId?: string | null;
}): Promise<string> {
  const stripe = getStripe();
  if (params.existingCustomerId) {
    // Verify it still exists
    try {
      const c = await stripe.customers.retrieve(params.existingCustomerId);
      if (!(c as any).deleted) return params.existingCustomerId;
    } catch {}
  }
  const customer = await stripe.customers.create({
    email: params.ownerEmail,
    name: params.businessName,
    metadata: { tenant_id: params.tenantId },
  });
  return customer.id;
}

/** Create a Stripe Checkout Session for a new subscription. */
export async function createSubscriptionCheckout(params: {
  customerId: string;
  tier: Tier;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
}): Promise<string> {
  const stripe = getStripe();
  const priceId = getPriceIdForTier(params.tier);
  if (!priceId) {
    throw new Error(
      `Stripe Price for "${params.tier}" tier not configured. Set ${TIERS[params.tier].price_id_env_var} env var.`,
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: params.customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    subscription_data: params.trialDays
      ? { trial_period_days: params.trialDays }
      : undefined,
    allow_promotion_codes: true,
  });

  if (!session.url) throw new Error("Stripe Checkout session has no URL");
  return session.url;
}

/** Generate a Customer Portal session URL for a tenant to manage their
 *  subscription (update card, cancel, upgrade, view invoices). */
export async function createBillingPortal(params: {
  customerId: string;
  returnUrl: string;
}): Promise<string> {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });
  return session.url;
}
