// Index landing for all competitor comparison pages.
// Lives at /marketing/vs — surfaces the 4 sub-pages for SEO + visitor choice.

import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { COMPETITORS } from "@/lib/marketing/competitors";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "RentalFlow vs the competition — honest comparisons",
  description:
    "How RentalFlow stacks up against InflatableOffice, Goodshuffle Pro, Booqable, and TapGoods. Honest side-by-side — including where the others do something better.",
};

export default function VsIndexPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50">
      <div className="container mx-auto px-4 py-12 md:py-20 max-w-5xl">
        <Link
          href="/"
          className="text-sm text-slate-500 hover:text-brand-navy mb-6 inline-block"
        >
          ← Back to RentalFlow
        </Link>

        <div className="mb-8">
          <div className="inline-flex items-center gap-1 bg-violet-100 text-violet-700 text-xs font-bold uppercase tracking-wider px-2 py-1 rounded mb-3">
            <Sparkles className="h-3 w-3" /> Honest comparison
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-brand-navy mb-3">
            How we compare
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl">
            We don't pretend RentalFlow has every feature every competitor has.
            We highlight what's <em>genuinely different</em> — including the
            spots where they do something better than us. Read whichever
            applies to the tool you're already considering.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {COMPETITORS.map((c) => (
            <Link
              key={c.slug}
              href={`/marketing/vs/${c.slug}`}
              className="card border-2 border-slate-200 hover:border-violet-300 hover:shadow-lg transition group"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-xl font-bold text-brand-navy mb-1">
                    vs {c.name}
                  </h2>
                  <p className="text-xs text-slate-500 italic">{c.tagline}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-violet-600 shrink-0" />
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">
                    Customers
                  </div>
                  <div className="text-slate-700 font-medium">
                    {c.customerCount}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">
                    Founded
                  </div>
                  <div className="text-slate-700 font-medium">{c.founded}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">
                    Pricing
                  </div>
                  <div className="text-slate-700 font-medium">{c.pricing}</div>
                </div>
              </div>

              <p className="text-sm text-slate-600 mt-3 line-clamp-2">
                {c.positioning}
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-12 bg-violet-50 border border-violet-200 rounded-lg p-6 text-center">
          <p className="text-sm text-violet-900 mb-3 font-medium">
            Not sure which one applies?
          </p>
          <p className="text-xs text-violet-700 mb-4 max-w-xl mx-auto">
            The TL;DR across all 4: incumbents are feature-complete for
            traditional operations but were built before AI. RentalFlow is
            AI-native — the system does more of the work so you do less.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-violet-600 hover:bg-violet-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm"
          >
            Try 90 days free
          </Link>
        </div>
      </div>
    </div>
  );
}
