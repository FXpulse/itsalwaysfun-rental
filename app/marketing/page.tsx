// RentalFlow marketing landing — served at getrentalflow.com apex.
// Middleware rewrites "/" → "/marketing" when host is the SaaS apex.

import Link from "next/link";
import {
  Check,
  Zap,
  Shield,
  CreditCard,
  BarChart3,
  Smartphone,
  Mail,
  ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

const TIERS = [
  {
    name: "Starter",
    price: "$99",
    period: "/mo",
    cta: "Start free trial",
    features: [
      "Up to 50 bookings/month",
      "Online booking page",
      "Stripe payments",
      "Email confirmations",
      "Calendar + inventory",
      "Basic reports",
    ],
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$199",
    period: "/mo",
    cta: "Start free trial",
    features: [
      "Unlimited bookings",
      "Custom domain",
      "Quotes + gift cards + packages",
      "SMS confirmations",
      "Advanced reports + P&L",
      "1099-NEC year-end automation",
      "Liability waiver e-signature",
      "COI request management",
      "Loyalty program",
    ],
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "$499",
    period: "/mo",
    cta: "Contact sales",
    features: [
      "Everything in Pro",
      "Multi-location",
      "API access + Zapier",
      "Priority support",
      "Custom integrations",
      "Dedicated onboarding",
    ],
    highlighted: false,
  },
];

const FEATURES = [
  {
    icon: CreditCard,
    title: "Stripe payments built-in",
    description:
      "Connect your Stripe in 5 min. Customer pays online, money lands in your bank in 2 days. Zero transaction fees from us.",
  },
  {
    icon: BarChart3,
    title: "Real-time reports + P&L",
    description:
      "Track revenue, gross margin, cash flow projection, and per-product ROI. Built by a rental owner who actually uses this data.",
  },
  {
    icon: Smartphone,
    title: "Driver mobile (PWA)",
    description:
      "Your drivers see today's routes on their phone, mark stops delivered, capture photos + signatures. No app store needed.",
  },
  {
    icon: Shield,
    title: "Damage protection + waivers",
    description:
      "Liability waiver e-signature at checkout. Damage tracking with protection coverage. COI requests handled automatically.",
  },
  {
    icon: Mail,
    title: "Email + SMS automation",
    description:
      "Booking confirmation, reminders, review requests, anniversary emails. SMS via Twilio. Editable templates.",
  },
  {
    icon: Zap,
    title: "Built by a rental owner",
    description:
      "I run a bounce house rental in Jacksonville FL. Every feature exists because I needed it. No bloat, no consultants.",
  },
];

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="font-bold text-2xl text-brand-navy">RentalFlow</div>
          <div className="flex items-center gap-4">
            <Link
              href="/signup"
              className="bg-brand-navy text-white text-sm font-semibold px-4 py-2 rounded hover:bg-brand-navy/90"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <h1 className="text-4xl sm:text-6xl font-bold text-brand-navy leading-tight mb-6">
          Rental software that doesn't cost $300/mo
          <br />
          <span className="text-brand-yellow-dark">or 8% of every booking</span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-8">
          Bounce house, party rentals, equipment rentals — built by a rental
          owner. Stripe payments, mobile-first dispatch, real-time P&L, 50+
          features. From $99/mo flat.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="bg-brand-navy text-white text-lg font-semibold px-8 py-4 rounded-md hover:bg-brand-navy/90 inline-flex items-center gap-2 justify-center"
          >
            Start free trial <ArrowRight className="h-5 w-5" />
          </Link>
          <a
            href="#pricing"
            className="border border-slate-300 text-slate-700 text-lg font-semibold px-8 py-4 rounded-md hover:bg-slate-50 inline-flex items-center justify-center"
          >
            See pricing
          </a>
        </div>
        <p className="text-xs text-slate-400 mt-4">
          14-day free trial · No credit card required · Cancel anytime
        </p>
      </section>

      {/* Features */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-3xl font-bold text-center text-brand-navy mb-12">
            Everything you need, nothing you don't
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-white border border-slate-200 rounded-lg p-6"
              >
                <div className="bg-brand-yellow/20 w-12 h-12 rounded-md flex items-center justify-center mb-3">
                  <f.icon className="h-6 w-6 text-brand-navy" />
                </div>
                <h3 className="font-bold text-brand-navy mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-3xl font-bold text-center text-brand-navy mb-2">
          Simple, predictable pricing
        </h2>
        <p className="text-center text-slate-600 mb-12">
          Flat monthly fee. No transaction fees. No setup fees. No surprises.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={`border rounded-lg p-6 ${
                t.highlighted
                  ? "border-brand-navy border-2 bg-brand-navy text-white shadow-xl"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className={`text-sm font-semibold uppercase tracking-wide mb-2 ${
                t.highlighted ? "text-brand-yellow" : "text-slate-500"
              }`}>
                {t.name}
              </div>
              <div className="mb-4">
                <span className="text-4xl font-bold">{t.price}</span>
                <span className={`text-base ${t.highlighted ? "text-white/70" : "text-slate-500"}`}>
                  {t.period}
                </span>
              </div>
              <ul className="space-y-2 mb-6">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                      t.highlighted ? "text-brand-yellow" : "text-emerald-600"
                    }`} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`block text-center font-semibold py-3 rounded ${
                  t.highlighted
                    ? "bg-brand-yellow text-brand-navy hover:bg-yellow-300"
                    : "bg-brand-navy text-white hover:bg-brand-navy/90"
                }`}
              >
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-200 bg-brand-navy text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to grow your rentals?</h2>
          <p className="text-lg text-white/80 mb-6">
            Get up and running in under an hour. 14-day free trial. No credit card.
          </p>
          <Link
            href="/signup"
            className="bg-brand-yellow text-brand-navy text-lg font-bold px-8 py-4 rounded-md hover:bg-yellow-300 inline-flex items-center gap-2"
          >
            Start free trial <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} RentalFlow. Built by a rental owner in Jacksonville, FL.
        </div>
      </footer>
    </div>
  );
}
