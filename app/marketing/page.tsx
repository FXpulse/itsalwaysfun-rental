// RentalFlow marketing landing — served at getrentalflow.com apex.
// Middleware rewrites "/" → "/marketing" when host is the SaaS apex.
//
// Positioning (vs Event Rental Systems competitor):
// - They have 4 tiers $79.95-$399.95. We're $99 flat with EVERYTHING.
// - They target everything from bounce houses to dumpsters. We focus.
// - They gate behind "Book a demo". We let you signup free, no card.
// - Lean into founder story — they show no operator testimonials.

import Link from "next/link";
import Image from "next/image";
import { SaasChatWidget } from "@/components/marketing/SaasChatWidget";
import {
  Check,
  X as XIcon,
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
  "Calendar + inventory + dispatch (driver mobile app)",
  "Quotes + gift cards + packages + coupons",
  "Advanced reports + P&L + cash flow projection",
  "1099-NEC year-end automation",
  "Liability waiver e-signature",
  "COI request management",
  "GHL (Go High Level) CRM integration",
  "Loyalty program + referrals",
  "Per-booking expense tracking",
  "Damage protection + tracking",
  "Audit log + diagnostics + automatic backups",
];

const FEATURES = [
  {
    icon: CreditCard,
    title: "Stripe → your bank in 2 days",
    description:
      "Connect your Stripe in 5 minutes. Customer pays online, money lands in your bank in 2 days. Zero transaction fees from us, ever.",
  },
  {
    icon: BarChart3,
    title: "Real P&L, not vanity metrics",
    description:
      "Real margin, cash flow projection, per-product ROI, customer LTV. Built by a rental owner who actually uses this data to make decisions.",
  },
  {
    icon: Smartphone,
    title: "Driver mobile app (no app store)",
    description:
      "Drivers see today's routes on their phone, tap-to-call, tap-to-navigate, mark stops delivered, capture photos + signatures. Installs in 10 seconds.",
  },
  {
    icon: Shield,
    title: "Waivers + COI handled",
    description:
      "Liability waiver e-signature at checkout (FL-compliant template included). Damage tracking with optional customer protection. Venue COI requests handled in the app.",
  },
  {
    icon: Mail,
    title: "Email + SMS, fully automated",
    description:
      "Booking confirmation, 3-day reminder, review request, anniversary email, abandoned cart recovery. SMS via Twilio. Every template editable.",
  },
  {
    icon: Zap,
    title: "Built by a rental owner",
    description:
      "I run a bounce house rental in Jacksonville, FL. Every feature exists because I needed it. No consultants, no committee, no upsells.",
  },
];

const COMPARISON = [
  { feature: "Online bookings", us: true, them: true },
  { feature: "Stripe payments", us: true, them: true },
  { feature: "Driver mobile app", us: true, them: "Pro+ only" },
  { feature: "Custom domain", us: true, them: "Pro+ only" },
  { feature: "Quotes + gift cards", us: true, them: "Standard+" },
  { feature: "Real-time P&L reports", us: true, them: "Elite only" },
  { feature: "1099-NEC automation", us: true, them: false },
  { feature: "Liability waiver e-sig", us: true, them: false },
  { feature: "Transaction fees", us: "$0", them: "0-3% varies" },
  { feature: "Free trial", us: "__TRIAL_PLACEHOLDER__", them: "Demo gated" },
  { feature: "Monthly cost", us: "$99 flat", them: "$80-$400" },
];

import { isBetaProgramActive, trialDaysForNewSignup } from "@/lib/beta-program";

export default function MarketingPage() {
  const betaOpen = isBetaProgramActive();
  const trialDays = trialDaysForNewSignup();
  const trialLabel = `${trialDays} days, no card`;
  const comparison = COMPARISON.map((row) =>
    row.us === "__TRIAL_PLACEHOLDER__" ? { ...row, us: trialLabel } : row,
  );
  return (
    <div className="min-h-screen bg-white">
      {betaOpen && (
        <a
          href="/beta"
          className="block bg-brand-yellow text-brand-navy text-center text-sm font-bold py-2 px-4 hover:bg-yellow-300 transition"
        >
          🎉 BETA PROGRAM OPEN — Get 90 days free (not 30). Tap to read more →
        </a>
      )}
      {/* Header */}
      <header className="border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" aria-label="RentalFlow home">
            <Image
              src="/01_rentalflow_lockup_light.svg"
              alt="RentalFlow"
              width={180}
              height={40}
              priority
              className="h-10 w-auto"
            />
          </Link>
          <div className="flex items-center gap-4">
            <a
              href="#pricing"
              className="text-sm text-slate-600 hover:text-brand-navy hidden sm:inline"
            >
              Pricing
            </a>
            <a
              href="https://testbouncers.getrentalflow.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-600 hover:text-brand-navy hidden sm:inline"
            >
              Live demo
            </a>
            <Link
              href="/signup"
              className="bg-brand-navy text-white text-sm font-semibold px-4 py-2 rounded hover:bg-brand-navy/90"
            >
              Start {trialDays}-day free trial
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <div className="inline-block bg-amber-100 text-amber-900 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
          Built by a bounce house rental owner
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold text-brand-navy leading-tight mb-6">
          Every feature you need.
          <br />
          <span className="text-brand-yellow-dark">$99/mo flat. Period.</span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-3">
          Bounce house, party + event rentals — built for owners who got tired of
          $400/mo software with features hidden behind tiers and "Contact sales"
          gates.
        </p>
        <p className="text-base text-slate-500 max-w-xl mx-auto mb-8">
          No tiers. No transaction fees. No upsells. Just rental software that works.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="bg-brand-navy text-white text-lg font-semibold px-8 py-4 rounded-md hover:bg-brand-navy/90 inline-flex items-center gap-2 justify-center"
          >
            Start {trialDays}-day free trial <ArrowRight className="h-5 w-5" />
          </Link>
          <a
            href="https://testbouncers.getrentalflow.com"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-slate-300 text-slate-700 text-lg font-semibold px-8 py-4 rounded-md hover:bg-slate-50 inline-flex items-center justify-center"
          >
            See live demo →
          </a>
        </div>
        <p className="text-xs text-slate-400 mt-4">
          No credit card · No demo call · Cancel anytime
        </p>
      </section>

      {/* Niche callout */}
      <section className="bg-brand-navy text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 text-center">
          <p className="text-lg sm:text-xl">
            <strong className="text-brand-yellow">If you rent</strong> bounce
            houses, water slides, tents, tables, chairs, generators, inflatables —{" "}
            <strong className="text-brand-yellow">RentalFlow.</strong>
          </p>
          <p className="text-sm text-white/70 mt-2">
            If you rent dumpsters or heavy equipment — go somewhere else. We're focused.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-3xl font-bold text-center text-brand-navy mb-3">
            Turn busy days into easy wins
          </h2>
          <p className="text-center text-slate-600 mb-12 max-w-2xl mx-auto">
            No more phone tag, no spreadsheet juggling, no 11 PM email chains.
            Your customers book online, you ship + collect, RentalFlow handles
            the rest.
          </p>
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

      {/* Comparison */}
      <section className="border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-3xl font-bold text-center text-brand-navy mb-2">
            vs. the competition
          </h2>
          <p className="text-center text-slate-600 mb-8">
            Most rental software locks features behind tiers and charges $80-$400/mo
            with transaction fees on top. We don't.
          </p>
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3"></th>
                  <th className="px-4 py-3 text-center font-bold text-brand-navy">
                    RentalFlow
                  </th>
                  <th className="px-4 py-3 text-center font-bold text-slate-500">
                    Typical competitor
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comparison.map((c) => (
                  <tr key={c.feature}>
                    <td className="px-4 py-3 text-slate-700">{c.feature}</td>
                    <td className="px-4 py-3 text-center">
                      {c.us === true ? (
                        <Check className="h-5 w-5 text-emerald-600 inline" />
                      ) : (
                        <span className="font-bold text-brand-navy">{c.us}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.them === true ? (
                        <Check className="h-5 w-5 text-emerald-600 inline" />
                      ) : c.them === false ? (
                        <XIcon className="h-5 w-5 text-red-500 inline" />
                      ) : (
                        <span className="text-slate-500 text-xs">{c.them}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-center text-xs text-slate-400 mt-4">
            Comparison based on Event Rental Systems public tier pricing.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-3xl font-bold text-center text-brand-navy mb-2">
          One price. Every feature.
        </h2>
        <p className="text-center text-slate-600 mb-8">
          No tiered upsells. No "contact sales for X." You get everything,
          flat $99 per month.
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
              Cheaper than the Standard plan of the alternatives. With more features.
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
            Start {trialDays}-day free trial
          </Link>
          <p className="text-center text-xs text-white/60 mt-3">
            No credit card · No demo · Cancel anytime
          </p>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Multi-location or 1000+ bookings/month? Same price.{" "}
          Custom integration?{" "}
          <a
            href="mailto:hello@getrentalflow.com"
            className="text-brand-navy underline"
          >
            Email us
          </a>
          .
        </p>
      </section>

      {/* Founder story */}
      <section className="bg-slate-50 border-t border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          <div className="bg-white border border-slate-200 rounded-lg p-8">
            <div className="flex items-start gap-4 mb-4">
              <div className="text-4xl">👋</div>
              <div>
                <h3 className="font-bold text-brand-navy text-lg">
                  Why I built RentalFlow
                </h3>
                <p className="text-xs text-slate-500">
                  Ludmila — owner, It's Always Fun, LLC (Jacksonville, FL)
                </p>
              </div>
            </div>
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                I ran my bounce house rental on the "industry standard" software
                for two years. $400/month. Half the features locked behind upsells.
                Booking flow was clunky. Driver mobile app didn't exist.
              </p>
              <p>
                So I built my own. Then a friend who runs party rentals in another
                city asked to use it. So here it is — packaged as RentalFlow.
              </p>
              <p className="font-semibold text-brand-navy">
                $99/month, every feature, no BS. Built by an owner, for owners.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-200 bg-brand-navy text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to switch?</h2>
          <p className="text-lg text-white/80 mb-6">
            Get up and running in under an hour. Import your existing inventory
            in minutes. We'll even help with migration on a call.
          </p>
          <Link
            href="/signup"
            className="bg-brand-yellow text-brand-navy text-lg font-bold px-8 py-4 rounded-md hover:bg-yellow-300 inline-flex items-center gap-2"
          >
            Start {trialDays}-day free trial <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="text-xs text-white/60 mt-4">
            Or{" "}
            <a
              href="https://testbouncers.getrentalflow.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              poke around the live demo
            </a>{" "}
            first — no signup needed.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} RentalFlow. Built by a rental owner in
          Jacksonville, FL.
        </div>
      </footer>

      {/* RentalFlow native AI chat — replaces GHL widget. Powered by gpt-4o-mini
          with the full product knowledge baked into the system prompt.
          Endpoint: /api/chat/saas */}
      <SaasChatWidget />
    </div>
  );
}
