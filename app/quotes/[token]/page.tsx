import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStripeConfigured } from "@/lib/stripe/server";
import { QuoteCustomerView } from "./QuoteCustomerView";
import { getSiteSettings } from "@/lib/site-settings";
import { refreshHoldOrFail } from "./actions";

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

  // Re-check availability + refresh hold when the customer returns
  // after the 24h hold expired. If something else snagged the slot,
  // this surfaces an "unavailable" message instead of letting them pay
  // for a booking that's actually in conflict.
  let availabilityError: string | null = null;
  if (quote.status === "approved" && quote.converted_booking_id) {
    const r = await refreshHoldOrFail(params.token);
    if ("error" in r) {
      availabilityError = r.error;
    }
  }

  // For approved quotes, fetch booking to get client_secret + final amount.
  // The Stripe PaymentIntent (and the booking.total_amount) reflect the FULL
  // amount the customer agreed to pay (quote + damage protection + power
  // supply) — we surface that here so the payment UI shows the right number.
  let clientSecret: string | null = null;
  let finalAmountCents: number = quote.total_cents;
  if (quote.status === "approved" && quote.converted_booking_id) {
    const { data: booking } = await supabase
      .from("bookings")
      .select("stripe_payment_intent_id, stripe_payment_status, total_amount")
      .eq("id", quote.converted_booking_id)
      .single();

    if (booking?.total_amount) {
      finalAmountCents = Number(booking.total_amount);
    }

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
        // Trust Stripe's amount as the source of truth (it's what will be charged)
        if (intent.amount) finalAmountCents = intent.amount;
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

  // Power supply add-on — when the customer says they need a generator,
  // we add this product's per-day price × num days to the quote total.
  const { data: powerSupplyRow } = await supabase
    .from("products")
    .select("id, name, slug, price_per_day")
    .eq("slug", "power-supply")
    .eq("is_addon", true)
    .eq("is_active", true)
    .maybeSingle();
  const powerSupplyPerDayCents = powerSupplyRow
    ? Number((powerSupplyRow as any).price_per_day) || 0
    : 0;

  // Per-tenant configurable setup surface options (managed at /admin/categories).
  const { data: surfaceRows } = await supabase
    .from("setup_surfaces")
    .select("value, label, display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  const surfaceOptions = ((surfaceRows as any[]) || []).map((r) => ({
    value: String(r.value),
    label: String(r.label),
  }));

  return (
    <QuoteCustomerView
      quote={quote}
      clientSecret={clientSecret}
      stripeConfigured={stripeReady}
      stripePublishableKey={stripePublishableKey}
      waiverTitle={waiverTitle}
      waiverText={waiverText}
      damageCoverageCents={damageCoverageCents}
      powerSupplyPerDayCents={powerSupplyPerDayCents}
      surfaceOptions={surfaceOptions}
      availabilityError={availabilityError}
      finalAmountCents={finalAmountCents}
    />
  );
}
