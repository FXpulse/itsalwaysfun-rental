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

const ALL_FEATURES = [
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
          Every feature you need.
          <br />
          <span className="text-brand-yellow-dark">$99/mo flat. Period.</span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-8">
          Bounce house, party rentals, equipment rentals — built by a rental
          owner. No tiers, no transaction fees, no upsells. Replaces $300/mo
          competitors.
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

      {/* Pricing — single tier, all features included */}
      <section id="pricing" className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-3xl font-bold text-center text-brand-navy mb-2">
          One price. Every feature.
        </h2>
        <p className="text-center text-slate-600 mb-8">
          No tiered upsells. No "Contact sales for X feature." You get everything,
          flat $99 per month. Cheaper than your phone bill.
        </p>

        <div className="border-2 border-brand-navy rounded-lg p-8 bg-gradient-to-br from-brand-navy to-slate-900 text-white shadow-2xl">
          <div className="text-center mb-6">
            <div className="inline-block bg-brand-yellow text-brand-navy text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3">
              Everything included
            </div>
            <div className="mb-2">
              <span className="text-6xl font-bold">$99</span>
              <span className="text-xl text-white/70">/mo</span>
            </div>
            <p className="text-sm text-white/80">
              Replaces $300/mo competitors. 14-day free trial. No credit card.
            </p>
          </div>

          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mb-8 max-w-2xl mx-auto">
            {ALL_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 mt-0.5 flex-shrink-0 text-brand-yellow" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <Link
            href="/signup"
            className="block text-center bg-brand-yellow text-brand-navy text-lg font-bold py-4 rounded hover:bg-yellow-300"
          >
            Start 14-day free trial
          </Link>
          <p className="text-center text-xs text-white/60 mt-3">
            No credit card required · Cancel anytime · Built by a rental owner
          </p>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Multi-location or 1000+ bookings/month? Same price. Need API or custom
          integration? <a href="mailto:hello@getrentalflow.com" className="text-brand-navy underline">Email us</a>.
        </p>
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
