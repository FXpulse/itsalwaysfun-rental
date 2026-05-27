// Stripe Connect Express helpers — tenants connect their own Stripe
// account so payments flow directly to their bank, not the platform's.
//
// Architecture: destination charges with application_fee = 0 (the
// platform charges tenants via separate monthly subscription, not
// per-transaction fees).
//
// IAF (the platform-owner's rental) keeps using direct charges on the
// platform Stripe account — Connect onboarding is for NEW tenants.

import { getStripe } from "./server";

export interface StripeConnectStatus {
  account_id: string | null;
  charges_enabled: boolean;
  details_submitted: boolean;
  payouts_enabled: boolean;
  /** human-readable status: "active" | "pending_onboarding" | "missing_details" | "disabled" */
  status: "active" | "pending_onboarding" | "missing_details" | "disabled" | "not_connected";
}

/** Create a new Stripe Connect Express account for a tenant. */
export async function createConnectAccount(params: {
  email: string;
  businessName: string;
  countryCode?: string;
}): Promise<string> {
  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: "express",
    country: params.countryCode || "US",
    email: params.email,
    business_profile: {
      name: params.businessName,
      product_description: "Equipment + bounce house rentals",
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });
  return account.id;
}

/** Generate an onboarding URL for the tenant to complete Stripe setup.
 *  refreshUrl: where Stripe sends them if the link expires.
 *  returnUrl: where Stripe sends them after onboarding completes. */
export async function createOnboardingLink(params: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}): Promise<string> {
  const stripe = getStripe();
  const link = await stripe.accountLinks.create({
    account: params.accountId,
    refresh_url: params.refreshUrl,
    return_url: params.returnUrl,
    type: "account_onboarding",
  });
  return link.url;
}

/** Generate a login URL to the Stripe Express dashboard for a connected
 *  account — tenants use this to manage their Stripe (payouts, taxes, etc.). */
export async function createDashboardLoginLink(accountId: string): Promise<string> {
  const stripe = getStripe();
  const link = await stripe.accounts.createLoginLink(accountId);
  return link.url;
}

/** Fetch current status of a connected account. */
export async function getConnectStatus(accountId: string | null): Promise<StripeConnectStatus> {
  if (!accountId) {
    return {
      account_id: null,
      charges_enabled: false,
      details_submitted: false,
      payouts_enabled: false,
      status: "not_connected",
    };
  }

  const stripe = getStripe();
  try {
    const acc = await stripe.accounts.retrieve(accountId);
    let status: StripeConnectStatus["status"];
    if (!acc.details_submitted) {
      status = "pending_onboarding";
    } else if (!acc.charges_enabled) {
      status = "missing_details";
    } else if (acc.charges_enabled && acc.payouts_enabled) {
      status = "active";
    } else {
      status = "disabled";
    }
    return {
      account_id: acc.id,
      charges_enabled: !!acc.charges_enabled,
      details_submitted: !!acc.details_submitted,
      payouts_enabled: !!acc.payouts_enabled,
      status,
    };
  } catch (e: any) {
    return {
      account_id: accountId,
      charges_enabled: false,
      details_submitted: false,
      payouts_enabled: false,
      status: "disabled",
    };
  }
}

/** Build the Payment Intent params for a tenant.
 *  - If tenant has a connected account: use destination charge (money
 *    flows to tenant's bank). No application_fee for now (subscription
 *    model handles platform revenue).
 *  - Else: direct charge on platform Stripe (legacy / IAF). */
export function getPaymentIntentTenantParams(
  tenantStripeAccountId: string | null,
): {
  transfer_data?: { destination: string };
  on_behalf_of?: string;
} {
  if (!tenantStripeAccountId) return {};
  return {
    transfer_data: { destination: tenantStripeAccountId },
    on_behalf_of: tenantStripeAccountId,
  };
}
