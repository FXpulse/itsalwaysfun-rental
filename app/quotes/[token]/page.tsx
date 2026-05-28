import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStripeConfigured } from "@/lib/stripe/server";
import { QuoteCustomerView } from "./QuoteCustomerView";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function CustomerQuotePage({
  params,
}: {
  params: { token: string };
}) {
  if (!params.token || params.token.length < 8) notFound();

  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("*")
    .eq("token", params.token)
    .single();

  if (!quote) notFound();

  // First view: mark as viewed
  if (quote.status === "sent") {
    await supabase
      .from("quotes")
      .update({ status: "viewed", viewed_at: new Date().toISOString() })
      .eq("id", quote.id);
    quote.status = "viewed";
    quote.viewed_at = new Date().toISOString();
  }

  // Auto-mark expired if past expires_at
  const isExpired =
    quote.expires_at &&
    new Date(quote.expires_at) < new Date() &&
    quote.status !== "approved" &&
    quote.status !== "converted";

  if (isExpired && quote.status !== "expired") {
    await supabase.from("quotes").update({ status: "expired" }).eq("id", quote.id);
    quote.status = "expired";
  }

  // For approved quotes, fetch booking to get client_secret
  let clientSecret: string | null = null;
  if (quote.status === "approved" && quote.converted_booking_id) {
    const { data: booking } = await supabase
      .from("bookings")
      .select("stripe_payment_intent_id, stripe_payment_status")
      .eq("id", quote.converted_booking_id)
      .single();

    // If booking already paid, mark quote as converted
    if (booking?.stripe_payment_status === "paid") {
      await supabase.from("quotes").update({ status: "converted" }).eq("id", quote.id);
      quote.status = "converted";
    } else if (booking?.stripe_payment_intent_id) {
      // Fetch fresh client_secret from Stripe (it's the same intent, just retrieve it)
      try {
        const { getStripe } = await import("@/lib/stripe/server");
        const stripe = getStripe();
        const intent = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);
        clientSecret = intent.client_secret;
      } catch (e) {
        console.error("Failed to retrieve PaymentIntent", e);
      }
    }
  }

  const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
  const stripeReady = isStripeConfigured() && !!stripePublishableKey;

  // Waiver text + damage protection coverage are needed on the customer page
  // to render the setup form they fill out before paying.
  const { data: protectionAndWaiverRows } = await supabase
    .from("site_settings")
    .select("key, value")
    .in("key", [
      "waiver_title",
      "waiver_text",
      "damage_protection_coverage_cents",
    ]);
  const settingsMap = new Map<string, string>(
    (protectionAndWaiverRows as any[] || []).map((r) => [r.key, r.value]),
  );
  const waiverTitle = settingsMap.get("waiver_title") || "Liability Waiver";
  const waiverText = settingsMap.get("waiver_text") || "";
  const damageCoverageCents = parseInt(
    settingsMap.get("damage_protection_coverage_cents") || "50000",
    10,
  );

  return (
    <QuoteCustomerView
      quote={quote}
      clientSecret={clientSecret}
      stripeConfigured={stripeReady}
      stripePublishableKey={stripePublishableKey}
      waiverTitle={waiverTitle}
      waiverText={waiverText}
      damageCoverageCents={damageCoverageCents}
    />
  );
}
