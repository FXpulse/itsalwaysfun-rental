// Stripe SDK server-side singleton.
import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.startsWith("PASTE")) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY in environment."
    );
  }

  _stripe = new Stripe(key, {
    // Pin API version for stability
    apiVersion: "2024-09-30.acacia" as Stripe.LatestApiVersion,
    typescript: true,
    appInfo: {
      name: "ItsAlwaysFun Rental",
      version: "0.1.0",
    },
  });
  return _stripe;
}

export function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY || "";
  return key.startsWith("sk_") && !key.startsWith("PASTE");
}
