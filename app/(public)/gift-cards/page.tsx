import type { Metadata } from "next";
import { Gift, Phone } from "lucide-react";
import { isStripeConfigured } from "@/lib/stripe/server";
import { isGiftCardSalesEnabled } from "@/lib/gift-cards";
import { getSiteSettings } from "@/lib/site-settings";
import { GiftCardPurchase } from "./GiftCardPurchase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gift Cards — It's Always Fun",
  description:
    "Give the gift of fun. Buy a bounce house rental gift card — any amount, delivered instantly by email.",
};

export default async function GiftCardsPage() {
  const stripeReady = isStripeConfigured();
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
  const salesEnabled = await isGiftCardSalesEnabled();
  const settings = await getSiteSettings();

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-navy to-brand-navy-dark text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-yellow rounded-full mb-4">
            <Gift className="h-8 w-8 text-brand-navy" />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3">
            Give the gift of fun
          </h1>
          <p className="text-lg text-white/90 max-w-2xl mx-auto">
            Any amount. Delivered instantly by email. They redeem at checkout
            for any rental — bounce houses, slides, party gear.
          </p>
        </div>
      </section>

      {/* Purchase form */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid md:grid-cols-3 gap-6 mb-8 text-center">
          <Perk title="Any amount" desc="From $10 to $10,000 — pick the perfect value." />
          <Perk title="Instant delivery" desc="Emailed the moment payment clears." />
          <Perk title="Never expires" desc="Use the balance over multiple bookings." />
        </div>

        {salesEnabled ? (
          <GiftCardPurchase
            stripeConfigured={stripeReady}
            stripePublishableKey={publishableKey}
          />
        ) : (
          <div className="bg-white border-2 border-amber-200 rounded-lg p-8 text-center">
            <h2 className="text-xl font-bold text-brand-navy mb-2">
              Online gift card sales paused
            </h2>
            <p className="text-slate-600 mb-4">
              We're not selling gift cards online right now. Call us to purchase
              one by phone — we'll email the code straight to your recipient.
            </p>
            <a
              href={`tel:${settings.business_phone.replace(/\D/g, "")}`}
              className="inline-flex items-center gap-2 bg-brand-navy text-white font-semibold px-5 py-2.5 rounded hover:bg-brand-navy-dark"
            >
              <Phone className="h-4 w-4" /> Call {settings.business_phone}
            </a>
          </div>
        )}
      </section>
    </div>
  );
}

function Perk({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-white rounded-lg p-4 border border-slate-200">
      <div className="font-bold text-brand-navy mb-1">{title}</div>
      <div className="text-sm text-slate-600">{desc}</div>
    </div>
  );
}
