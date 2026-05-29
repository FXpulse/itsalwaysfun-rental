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
export type Cadence = "monthly" | "annual";

export interface TierInfo {
  id: Tier;
  name: string;
  price_cents: number;
  price_id_env_var: string;
  annual_price_cents?: number;
  annual_price_id_env_var?: string;
  features: string[];
}

// $99/mo × 12 = $1188/yr. Annual at $990 = $82.50/mo effective = ~17% off.
export const ANNUAL_PRICE_CENTS = 99000;
export const ANNUAL_DISCOUNT_PCT = 17;

// SINGLE-TIER pricing: $99/mo flat, every feature included.
// Tier type union kept for forward-compat (if multi-tier ever returns).
export const TIERS: Record<Tier, TierInfo> = {
  pro: {
    id: "pro",
    name: "Pro",
    price_cents: 9900,
    price_id_env_var: "STRIPE_PRICE_PRO",
    annual_price_cents: ANNUAL_PRICE_CENTS,
    annual_price_id_env_var: "STRIPE_PRICE_PRO_ANNUAL",
    features: [
      "Unlimited bookings",
      "Online booking page + custom domain",
      "Stripe payments → your bank (zero transaction fees)",
      "Email + SMS confirmations",
      "Calendar + inventory + dispatch (driver mobile)",
      "Quotes + gift cards + packages + coupons",
      "Advanced reports + P&L + cash flow",
      "1099-NEC year-end automation",
      "Liability waiver e-signature",
      "COI request management",
      "Loyalty program + referrals",
      "Per-booking expense tracking",
      "Damage protection + tracking",
      "Audit log + diagnostics + automatic backups",
    ],
  },
  // Legacy stubs — keys must exist for the union type but no UI uses them.
  starter: {
    id: "starter",
    name: "Starter (legacy)",
    price_cents: 9900,
    price_id_env_var: "STRIPE_PRICE_STARTER",
    features: ["Legacy tier — use Pro"],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise (legacy)",
    price_cents: 49900,
    price_id_env_var: "STRIPE_PRICE_ENTERPRISE",
    features: ["Legacy tier — use Pro"],
  },
};

/** The only tier exposed in the public signup + billing UI. */
export const ACTIVE_TIER: Tier = "pro";

export function getPriceIdForTier(
  tier: Tier,
  cadence: Cadence = "monthly",
): string | null {
  const tierInfo = TIERS[tier];
  if (!tierInfo) return null;
  const envName =
    cadence === "annual"
      ? tierInfo.annual_price_id_env_var
      : tierInfo.price_id_env_var;
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
  cadence?: Cadence;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
}): Promise<string> {
  const stripe = getStripe();
  const cadence = params.cadence || "monthly";
  const priceId = getPriceIdForTier(params.tier, cadence);
  if (!priceId) {
    const envVar =
      cadence === "annual"
        ? TIERS[params.tier].annual_price_id_env_var
        : TIERS[params.tier].price_id_env_var;
    throw new Error(
      `Stripe Price for "${params.tier}" ${cadence} not configured. Set ${envVar} env var.`,
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

/** Pause subscription billing for a number of months. Stripe stops generating
 *  invoices until `resumes_at`, and the customer is not charged during the
 *  pause. Useful for seasonal rental businesses (winter pause). */
export async function pauseSubscription(params: {
  subscriptionId: string;
  months: number;
}): Promise<{ paused_until: string }> {
  const stripe = getStripe();
  const resumesAt = new Date();
  resumesAt.setMonth(resumesAt.getMonth() + params.months);
  const resumesAtUnix = Math.floor(resumesAt.getTime() / 1000);

  await stripe.subscriptions.update(params.subscriptionId, {
    pause_collection: {
      behavior: "void",
      resumes_at: resumesAtUnix,
    },
  });

  return { paused_until: resumesAt.toISOString() };
}

/** Resume a paused subscription immediately. */
export async function resumeSubscription(params: {
  subscriptionId: string;
}): Promise<void> {
  const stripe = getStripe();
  await stripe.subscriptions.update(params.subscriptionId, {
    pause_collection: "",
  } as any);
}

/** Switch subscription cadence (monthly ↔ annual). Prorates the difference. */
export async function switchSubscriptionCadence(params: {
  subscriptionId: string;
  newCadence: Cadence;
  tier: Tier;
}): Promise<void> {
  const stripe = getStripe();
  const newPriceId = getPriceIdForTier(params.tier, params.newCadence);
  if (!newPriceId) {
    throw new Error(`Price ID for ${params.tier} ${params.newCadence} not configured`);
  }
  const sub = await stripe.subscriptions.retrieve(params.subscriptionId);
  const currentItemId = sub.items.data[0]?.id;
  if (!currentItemId) throw new Error("Subscription has no items");
  await stripe.subscriptions.update(params.subscriptionId, {
    items: [{ id: currentItemId, price: newPriceId }],
    proration_behavior: "create_prorations",
  });
}
