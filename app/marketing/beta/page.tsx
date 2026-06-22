// /marketing/beta — the beta program landing page. Served on
// getrentalflow.com/beta (middleware rewrites /beta → /marketing/beta when
// host is the marketing apex).
//
// Pitch: signups during the program window get 60 days free.
// No code, no cap by count, just by time (BETA_PROGRAM_END_AT env).

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Truck,
  Smartphone,
  MessageCircle,
  ShieldCheck,
  Mail,
  CreditCard,
  Sparkles,
  Calendar,
  ClipboardCheck,
  Users,
  Gift,
  Lock,
} from "lucide-react";
import { isBetaProgramActive, betaProgramEndAt } from "@/lib/beta-program";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "RentalFlow Beta — 60 days free for early operators",
  description:
    "Run your whole rental business on one platform. Beta program: 60 days free, no card required. Help us polish, get a $99 flat plan after.",
};

const FEATURES: Array<{ icon: any; title: string; body: string }> = [
  {
    icon: Calendar,
    title: "Branded site + booking wizard",
    body: "Your colors, your photos, your domain. 5-step customer wizard with multi-day pricing, add-ons, coupons, waivers, and Stripe checkout.",
  },
  {
    icon: CreditCard,
    title: "Stripe Connect — money to YOUR bank",
    body: "Stripe charges, payouts hit your account in ~2 days. We never touch your money. 2.9% + 30¢ Stripe fee — RentalFlow takes nothing per transaction.",
  },
  {
    icon: Truck,
    title: "Dispatch + driver mobile app",
    body: "Drag-and-drop route planner in admin. Installable PWA for the team — today's stops, navigate-to-customer, photo proof, signed e-waiver.",
  },
  {
    icon: ClipboardCheck,
    title: "Delivery + pickup checklists",
    body: "Per-product inspection templates. Drivers tick items in the app at delivery and pickup. Damage evidence locked to the booking for insurance.",
  },
  {
    icon: MessageCircle,
    title: "Per-booking team chat",
    body: "Admin, staff, and assigned driver chat per booking with @mentions. No more separate WhatsApp groups for coordination.",
  },
  {
    icon: Mail,
    title: "Email + SMS lifecycle",
    body: "Confirmation, 3d reminder, review request, 90d re-engagement, anniversary — all automated, all editable, A2P 10DLC-compliant SMS included.",
  },
  {
    icon: Smartphone,
    title: "Customer portal",
    body: "Customers log in via 6-digit code, see bookings, loyalty points, referral code. Extend rental + weather cancel self-serve. Fewer calls to you.",
  },
  {
    icon: Users,
    title: "Loyalty + referrals + payouts",
    body: "Points per dollar. Custom referral codes per customer with commission tracking. W-9 collection + 1099-NEC generation for tax season.",
  },
  {
    icon: Gift,
    title: "Gift cards + coupons + packages",
    body: "Self-serve gift card purchase with email + SMS delivery. Discount codes (percent/fixed/overnight-free). Curated multi-product bundles.",
  },
  {
    icon: ShieldCheck,
    title: "Real reports + 1099 generation",
    body: "Revenue, cost margins, P&L, cash flow projection, customer LTV. CSV exports for QuickBooks. 1099-NEC year-end generation for drivers.",
  },
  {
    icon: Sparkles,
    title: "AI admin assistant",
    body: "Ask 'how much did I make last week?' or 'who's delivering today?' in plain English. Reads YOUR data. Doesn't make things up.",
  },
  {
    icon: Lock,
    title: "Security baked in",
    body: "Multi-tenant correct (your data, only yours). 2FA available. CSP headers. Rate limits. Daily DB backups with 84-day retention.",
  },
];

export default function BetaLandingPage() {
  const isOpen = isBetaProgramActive();
  const endAt = betaProgramEndAt();
  const endAtHuman = endAt
    ? endAt.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <main className="min-h-screen bg-white">
      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-brand-navy to-[#0E0E3F] text-white">
        <div className="max-w-5xl mx-auto px-4 py-12 md:py-20">
          <div className="text-center">
            {isOpen ? (
              <span className="inline-block bg-brand-yellow text-brand-navy text-xs font-bold tracking-widest px-3 py-1 rounded-full mb-6">
                BETA PROGRAM · OPEN NOW
              </span>
            ) : (
              <span className="inline-block bg-white/10 text-white/70 text-xs font-bold tracking-widest px-3 py-1 rounded-full mb-6">
                BETA PROGRAM CLOSED
              </span>
            )}

            <h1 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">
              Help us polish RentalFlow.
              <br />
              <span className="text-brand-yellow">Get 60 days free.</span>
            </h1>
            <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-8">
              Built by It's Always Fun, a real Jacksonville rental business. Now
              we're opening it up to other rental operators. Run your whole
              business on it, tell us what's missing, pay nothing for 60 days.
              {endAtHuman && (
                <> Beta window closes <strong>{endAtHuman}</strong>.</>
              )}
            </p>

            {isOpen ? (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/signup"
                  className="bg-brand-yellow text-brand-navy font-bold py-4 px-8 rounded-lg hover:bg-yellow-300 transition inline-flex items-center justify-center gap-2"
                >
                  Start my 60-day trial
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <a
                  href="https://itsalwaysfun.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white/10 text-white border-2 border-white/20 font-bold py-4 px-8 rounded-lg hover:bg-white/20 transition inline-flex items-center justify-center gap-2"
                >
                  See it live (itsalwaysfun.com)
                </a>
              </div>
            ) : (
              <div className="text-center">
                <Link
                  href="/signup"
                  className="bg-brand-yellow text-brand-navy font-bold py-4 px-8 rounded-lg hover:bg-yellow-300 transition inline-flex items-center justify-center gap-2"
                >
                  Start your 30-day trial
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <p className="text-sm text-white/60 mt-3">
                  Beta program is closed. Normal trial is still 30 days free.
                </p>
              </div>
            )}

            <p className="text-xs text-white/60 mt-5">
              No credit card. No code required. Just sign up.
            </p>
          </div>
        </div>
      </section>

      {/* ── The deal ────────────────────────────────────────── */}
      <section className="py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-brand-navy mb-2">
            The deal in one paragraph
          </h2>
          <p className="text-slate-600 text-center text-lg mb-10 max-w-2xl mx-auto">
            You get the whole platform free for 60 days. You don't owe us
            anything in return — but if something's broken or missing, tell us.
            That's the trade.
          </p>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-lg p-5">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 mb-2" />
              <h3 className="font-bold text-slate-800 mb-1">No card upfront</h3>
              <p className="text-sm text-slate-600">
                We don't even ask for one. Sign up with email, build your
                catalog, take real bookings.
              </p>
            </div>
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-lg p-5">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 mb-2" />
              <h3 className="font-bold text-slate-800 mb-1">Real money flows</h3>
              <p className="text-sm text-slate-600">
                Stripe Connect to YOUR bank. Take real bookings, not a sandbox.
                You operate as if you'd already switched.
              </p>
            </div>
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-lg p-5">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 mb-2" />
              <h3 className="font-bold text-slate-800 mb-1">After 60 days</h3>
              <p className="text-sm text-slate-600">
                $99/month flat. Same plan as everyone else. No surprise upgrade
                tiers. No per-booking commission.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── What you get (12 cards) ─────────────────────────── */}
      <section className="bg-slate-50 py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-brand-navy mb-2">
            What you actually get
          </h2>
          <p className="text-slate-600 text-center mb-10 max-w-2xl mx-auto">
            Not bullet points on a deck — every one of these is shipped, in
            production, used daily by It's Always Fun.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="bg-white border border-slate-200 rounded-lg p-5 hover:border-brand-navy hover:shadow-md transition"
                >
                  <div className="bg-brand-yellow/20 text-brand-navy rounded p-2 inline-flex mb-3">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-slate-800 mb-1">{f.title}</h3>
                  <p className="text-sm text-slate-600">{f.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Who's building this ─────────────────────────────── */}
      <section className="py-12 md:py-16">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-brand-navy text-white rounded-2xl p-8 md:p-10">
            <p className="text-brand-yellow text-xs font-bold tracking-widest mb-3">
              WHO'S BUILDING THIS
            </p>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Built by a rental business, for rental businesses.
            </h2>
            <p className="text-white/80 mb-3">
              I'm Ludmila. I run a bounce-house rental business in Jacksonville,
              FL called It's Always Fun. Within a year I was juggling six
              different tools — Squarespace, Calendly, Stripe, Mailchimp,
              GoHighLevel, Google Sheets — and they didn't talk to each other.
              I was the integration.
            </p>
            <p className="text-white/80 mb-3">
              So my husband Henry and I built RentalFlow. IAF runs on it daily.
              Every feature you see exists because IAF needed it first. Now
              we're opening it to other rental operators.
            </p>
            <p className="text-white/80">
              The deal: try it on us for 60 days. If something is missing or
              broken, tell us. That's how we make this better for everyone
              who comes after you.
            </p>
            <p className="text-brand-yellow text-sm mt-5 font-semibold">
              — Ludmila & Henry
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ — quick objections ──────────────────────────── */}
      <section className="bg-slate-50 py-12 md:py-16">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-brand-navy mb-10">
            Quick FAQ
          </h2>

          <div className="space-y-4">
            {[
              {
                q: "Can I keep my current website during the 60 days?",
                a: "Yes. Build your RentalFlow site at yourcompany.getrentalflow.com first. Switch your DNS only when you're comfortable. You can also map your own custom domain anytime.",
              },
              {
                q: "Will I lose my data if I cancel after 60 days?",
                a: "No. We export everything to CSV before deleting your account. Customers, bookings, products, expenses — all yours, formatted for QuickBooks/Excel.",
              },
              {
                q: "Do you ask for a credit card upfront?",
                a: "No. Sign up with email only. You won't see a card form until day 60 (or earlier if you want to remove the trial banner).",
              },
              {
                q: "What happens at day 60?",
                a: "$99/month flat — same plan as every other RentalFlow customer. No surprise pricing tier. Cancel anytime with a CSV export of your data.",
              },
              {
                q: "What if I find a bug or a missing feature?",
                a: "Email Ludmila directly. The product is being actively built — you tell us, we usually ship within 1-2 weeks. That's literally why this program exists.",
              },
              {
                q: "Do you take a cut of my bookings?",
                a: "No. Stripe charges its standard 2.9% + 30¢ (you keep the rest). RentalFlow takes nothing per booking. The $99 flat is our entire pricing.",
              },
              {
                q: "Can my staff use the system too?",
                a: "Yes. Unlimited admin / staff / driver users included. No per-seat pricing. Drivers get a separate installable mobile app.",
              },
              {
                q: "Is it really already used in production?",
                a: "Yes — go to itsalwaysfun.com (Ludmila's IAF business). That's RentalFlow running live, taking real bookings every day.",
              },
            ].map((item) => (
              <details
                key={item.q}
                className="bg-white border border-slate-200 rounded-lg p-4 group"
              >
                <summary className="font-semibold text-slate-800 cursor-pointer flex items-center justify-between">
                  {item.q}
                  <span className="text-slate-400 text-sm group-open:hidden">+</span>
                  <span className="text-slate-400 text-sm hidden group-open:inline">
                    −
                  </span>
                </summary>
                <p className="text-sm text-slate-600 mt-3">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-brand-navy mb-4">
            {isOpen ? "Ready?" : "Want to be notified for the next round?"}
          </h2>
          {isOpen ? (
            <>
              <p className="text-slate-600 mb-8">
                Sign up takes 5 minutes. The first 14 days you can decide if
                it's for you. The other 46 are gravy.
                {endAtHuman && (
                  <> Beta closes <strong>{endAtHuman}</strong>.</>
                )}
              </p>
              <Link
                href="/signup"
                className="bg-brand-yellow text-brand-navy font-bold py-4 px-10 rounded-lg hover:bg-yellow-300 transition inline-flex items-center justify-center gap-2 text-lg"
              >
                Start my 60-day trial
                <ArrowRight className="h-5 w-5" />
              </Link>
            </>
          ) : (
            <p className="text-slate-600 mb-4">
              Email Ludmila at{" "}
              <a
                href="mailto:ludmilayhenry@gmail.com"
                className="text-brand-navy underline font-semibold"
              >
                ludmilayhenry@gmail.com
              </a>{" "}
              to get on the list for the next beta cohort.
            </p>
          )}
        </div>
      </section>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} RentalFlow · Built by It's Always Fun, LLC
        · Jacksonville, FL
      </footer>
    </main>
  );
}
