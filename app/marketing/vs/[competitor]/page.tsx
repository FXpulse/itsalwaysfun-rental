// Comparison page per competitor. Lives at /marketing/vs/[competitor].
// Reads data from lib/marketing/competitors.ts. Adding a new competitor
// is one entry to that array — no UI duplication.

import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Minus, Sparkles, ExternalLink, ChevronLeft } from "lucide-react";
import { COMPETITORS, getCompetitorBySlug } from "@/lib/marketing/competitors";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return COMPETITORS.map((c) => ({ competitor: c.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { competitor: string };
}) {
  const c = getCompetitorBySlug(params.competitor);
  if (!c) return { title: "Not found" };
  return {
    title: `RentalFlow vs ${c.name} — honest comparison`,
    description: `${c.name} (${c.pricing}) vs RentalFlow ($99/mo, AI-native). ${c.positioning}`,
  };
}

export default function VsCompetitorPage({
  params,
}: {
  params: { competitor: string };
}) {
  const c = getCompetitorBySlug(params.competitor);
  if (!c) notFound();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50">
      <div className="container mx-auto px-4 py-12 md:py-16 max-w-5xl">
        <Link
          href="/marketing/vs"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-navy mb-6"
        >
          <ChevronLeft className="h-4 w-4" /> All comparisons
        </Link>

        {/* Hero */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-1 bg-violet-100 text-violet-700 text-xs font-bold uppercase tracking-wider px-2 py-1 rounded mb-3">
            <Sparkles className="h-3 w-3" /> Honest side-by-side
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-brand-navy mb-3">
            RentalFlow <span className="text-slate-400 font-normal">vs</span> {c.name}
          </h1>
          <p className="text-lg text-slate-600 max-w-3xl">{c.positioning}</p>

          <div className="grid sm:grid-cols-3 gap-3 mt-6 text-sm">
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                Their customers
              </div>
              <div className="text-slate-800 font-semibold">{c.customerCount}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                Founded
              </div>
              <div className="text-slate-800 font-semibold">{c.founded}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                Pricing
              </div>
              <div className="text-slate-800 font-semibold">{c.pricing}</div>
            </div>
          </div>
        </div>

        {/* Feature comparison table */}
        <div className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden mb-10">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left text-xs uppercase tracking-wider text-slate-500 font-bold px-4 py-3">
                  Feature
                </th>
                <th className="text-left text-xs uppercase tracking-wider text-violet-700 font-bold px-4 py-3">
                  RentalFlow
                </th>
                <th className="text-left text-xs uppercase tracking-wider text-slate-500 font-bold px-4 py-3">
                  {c.name}
                </th>
                <th className="text-center text-xs uppercase tracking-wider text-slate-500 font-bold px-2 py-3 w-16">
                  Winner
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {c.rows.map((row, i) => (
                <tr key={i} className={row.winner === "us" ? "bg-violet-50/40" : ""}>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {row.feature}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.ours}</td>
                  <td className="px-4 py-3 text-slate-700">{row.theirs}</td>
                  <td className="px-2 py-3 text-center">
                    {row.winner === "us" && (
                      <span className="inline-flex items-center gap-1 text-violet-700 font-bold text-xs">
                        <Check className="h-3.5 w-3.5" /> Us
                      </span>
                    )}
                    {row.winner === "them" && (
                      <span className="text-slate-500 font-bold text-xs">
                        {c.name.split(" ")[0]}
                      </span>
                    )}
                    {row.winner === "tie" && (
                      <span className="inline-flex items-center text-slate-400 text-xs">
                        <Minus className="h-3 w-3" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Where they win + where we win */}
        <div className="grid md:grid-cols-2 gap-4 mb-10">
          <div className="card border-slate-200">
            <h2 className="font-bold text-slate-800 mb-3 text-sm uppercase tracking-wider">
              Where {c.name} wins
            </h2>
            <ul className="space-y-2 text-sm text-slate-700">
              {c.whereTheyWin.map((w, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card border-violet-300 bg-gradient-to-br from-violet-50/50 to-white">
            <h2 className="font-bold text-violet-900 mb-3 text-sm uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Where RentalFlow wins
            </h2>
            <ul className="space-y-2 text-sm text-slate-700">
              {c.whereWeWin.map((w, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-violet-600 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Honest TL;DR */}
        <div className="bg-slate-900 text-white rounded-xl p-6 md:p-8 mb-10">
          <h2 className="font-bold text-violet-300 text-xs uppercase tracking-wider mb-2">
            The honest TL;DR
          </h2>
          <p className="text-lg leading-relaxed">{c.cta}</p>
        </div>

        {/* Dual CTA */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            href="/signup"
            className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-5 py-4 rounded-lg text-center"
          >
            Try RentalFlow 90 days free
          </Link>
          <a
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white border-2 border-slate-300 hover:border-slate-400 text-slate-700 font-semibold px-5 py-4 rounded-lg text-center inline-flex items-center justify-center gap-1"
          >
            See {c.name} <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <p className="text-[11px] text-slate-400 text-center mt-6 italic">
          Comparison reflects public information at time of writing. Competitors
          update features; we'll keep this page honest. If you spot something
          wrong, email{" "}
          <a href="mailto:hello@getrentalflow.com" className="underline">
            hello@getrentalflow.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
