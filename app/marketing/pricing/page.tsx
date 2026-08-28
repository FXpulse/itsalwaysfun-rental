import Link from "next/link";
import Image from "next/image";
import { Check, ArrowRight, Pause, RefreshCw, XCircle } from "lucide-react";
import { SaasChatWidget } from "@/components/marketing/SaasChatWidget";
import { isBetaProgramActive, trialDaysForNewSignup } from "@/lib/beta-program";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pricing — $99/mo flat. Every feature. | RentalFlow",
  description:
    "One price for everything: $99/mo or $990/yr. No tiers, no per-user fees, no transaction fees. Free trial, no credit card required.",
};

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
  "6 AI agents (chat receptionist, inbox drafts, ticket triage, business assistant, daily brief, operator brief)",
  "API keys + webhooks (Zapier/Make ready)",
  "Calendar ICS feed (Google Calendar / Apple Calendar)",
  "Audit log + diagnostics + automatic backups",
];

const FAQ = [
  {
    q: "Is there really no per-user or per-booking fee?",
    a: "Correct. $99/mo flat covers unlimited bookings, unlimited staff/driver seats, unlimited customers. The only external fee is Stripe's standard 2.9% + $0.30 (which goes to Stripe, not us).",
  },
  {
    q: "What happens after the free trial?",
    a: "You'll be prompted to add a payment method. If you don't, your account pauses (data preserved) — no surprise charge. Add a card any time to resume.",
  },
  {
    q: "Can I pause my subscription for off-season?",
    a: "Yes. Pause 1, 3, or 6 months from your billing settings. Stripe auto-resumes on the date you pick — no manual action required.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes, one click from your billing page. No cancellation fees. Your data stays accessible for 90 days for export.",
  },
  {
    q: "Do you discount for annual billing?",
    a: "Yes — pay $990/year and save 17% ($198/yr) vs monthly. That's the only discount we offer; we don't do custom pricing.",
  },
  {
    q: "Multi-location or 1000+ bookings/month?",
    a: "Same $99/mo price. No enterprise tier, no volume gates.",
  },
];

export default function PricingPage() {
  const betaOpen = isBetaProgramActive();
  const trialDays = trialDaysForNewSignup();

  return (
    <div className="min-h-screen bg-white">
      {betaOpen && (
        <a
          href="/beta"
          className="block bg-brand-yellow text-brand-navy text-center text-sm font-bold py-2 px-4 hover:bg-yellow-300 transition"
        >
          🎉 BETA PROGRAM OPEN — Get 60 days free (not 30). Tap to read more →
        </a>
      )}

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
            <Link
              href="/"
              className="text-sm text-slate-600 hover:text-brand-navy hidden sm:inline"
            >
              Home
            </Link>
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

      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
        <div className="inline-block bg-amber-100 text-amber-900 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
          One price. Every feature.
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-brand-navy leading-tight mb-4">
          $99/month.
          <br />
          <span className="text-brand-yellow-dark">
            Every feature. Flat. Period.
          </span>
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          No tiers. No per-user fees. No per-booking fees. No transaction fees
          from us — ever. Just rental software that works.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-12">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="border-2 border-slate-200 rounded-lg p-8 bg-white">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
              Monthly
            </div>
            <div className="mb-4">
              <span className="text-5xl font-bold text-brand-navy">$99</span>
              <span className="text-lg text-slate-500">/mo</span>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Billed monthly. Cancel anytime.
            </p>
            <Link
              href="/signup"
              className="block text-center bg-white text-brand-navy border-2 border-brand-navy text-base font-bold py-3 rounded hover:bg-slate-50"
            >
              Start {trialDays}-day free trial
            </Link>
          </div>

          <div className="border-2 border-brand-navy rounded-lg p-8 bg-gradient-to-br from-brand-navy to-slate-900 text-white shadow-2xl relative">
            <div className="absolute -top-3 right-6 bg-brand-yellow text-brand-navy text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full">
              Save 17%
            </div>
            <div className="text-xs font-bold uppercase tracking-widest text-white/70 mb-3">
              Annual
            </div>
            <div className="mb-4">
              <span className="text-5xl font-bold">$990</span>
              <span className="text-lg text-white/70">/yr</span>
              <div className="text-sm text-white/80 mt-1">
                = $82.50/mo · saves $198/yr
              </div>
            </div>
            <p className="text-sm text-white/80 mb-6">
              Billed once per year. Cancel anytime, prorated refund.
            </p>
            <Link
              href="/signup?plan=annual"
              className="block text-center bg-brand-yellow text-brand-navy text-base font-bold py-3 rounded hover:bg-yellow-300"
            >
              Start {trialDays}-day free trial
            </Link>
          </div>
        </div>
        <p className="text-center text-xs text-slate-400 mt-6">
          No credit card required for the trial. Payment only if you decide to
          keep it.
        </p>
      </section>

      <section className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-brand-navy mb-3">
            Everything is included
          </h2>
          <p className="text-center text-slate-600 mb-10 max-w-2xl mx-auto">
            No feature gates, no "Contact sales for X." Same $99/mo whether
            you're doing 5 bookings a month or 500.
          </p>
          <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3 max-w-3xl mx-auto">
            {ALL_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-600" />
                <span className="text-slate-700">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-brand-navy mb-10">
          Flexible billing — off-season friendly
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="bg-brand-yellow/20 w-12 h-12 rounded-md flex items-center justify-center mb-3">
              <Pause className="h-6 w-6 text-brand-navy" />
            </div>
            <h3 className="font-bold text-brand-navy mb-2">
              Pause 1, 3, or 6 months
            </h3>
            <p className="text-sm text-slate-600">
              Cold months? Pause your subscription from billing settings.
              Stripe auto-resumes on the date you pick — no manual action.
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="bg-brand-yellow/20 w-12 h-12 rounded-md flex items-center justify-center mb-3">
              <RefreshCw className="h-6 w-6 text-brand-navy" />
            </div>
            <h3 className="font-bold text-brand-navy mb-2">
              Switch monthly ↔ annual anytime
            </h3>
            <p className="text-sm text-slate-600">
              Started monthly and want to save 17%? Upgrade to annual in one
              click. Prorated automatically.
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="bg-brand-yellow/20 w-12 h-12 rounded-md flex items-center justify-center mb-3">
              <XCircle className="h-6 w-6 text-brand-navy" />
            </div>
            <h3 className="font-bold text-brand-navy mb-2">
              Cancel anytime, keep your data
            </h3>
            <p className="text-sm text-slate-600">
              One click cancels. Your data stays accessible for 90 days —
              export bookings, customers, expenses to CSV any time.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white border-t border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-brand-navy mb-10">
            Common pricing questions
          </h2>
          <dl className="space-y-6">
            {FAQ.map((item) => (
              <div
                key={item.q}
                className="bg-slate-50 border border-slate-200 rounded-lg p-6"
              >
                <dt className="font-bold text-brand-navy mb-2">{item.q}</dt>
                <dd className="text-sm text-slate-700">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-brand-navy text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to switch?</h2>
          <p className="text-lg text-white/80 mb-6">
            Live in under an hour. Bulk import your existing inventory.
            We'll even help with migration on a call.
          </p>
          <Link
            href="/signup"
            className="bg-brand-yellow text-brand-navy text-lg font-bold px-8 py-4 rounded-md hover:bg-yellow-300 inline-flex items-center gap-2"
          >
            Start {trialDays}-day free trial <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="text-xs text-white/60 mt-4">
            No credit card · No demo call · Cancel anytime
          </p>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} RentalFlow. Built by a rental owner in
          Jacksonville, FL.
        </div>
      </footer>

      <SaasChatWidget />
    </div>
  );
}
