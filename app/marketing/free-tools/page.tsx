// /free-tools/ — placeholder index that lists available free utilities.
// Today: 1099-NEC tracker. Future: free quote template, free rental contract.

import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Free Tools for Rental Businesses | RentalFlow",
  description:
    "Free utilities for bouncy house, party, and event rental owners — built by rental owners. No signup required.",
  alternates: { canonical: "/free-tools" },
};

const TOOLS = [
  {
    href: "/free-tools/1099-tracker",
    icon: FileText,
    title: "1099-NEC Tracker",
    blurb:
      "Track contractor payments and stay compliant with the IRS $600 1099-NEC threshold. Free, no signup, runs in your browser.",
  },
];

export default function FreeToolsIndex() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-brand-navy mb-2">
          Free tools for rental businesses
        </h1>
        <p className="text-slate-600 mb-10">
          Built by rental owners. No signup. Your data stays in your browser.
        </p>
        <div className="grid gap-4">
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="card hover:shadow-lg transition group p-6 flex items-start gap-4"
            >
              <t.icon className="h-10 w-10 text-brand-navy flex-shrink-0" />
              <div className="flex-1">
                <h2 className="text-xl font-bold text-brand-navy group-hover:underline">
                  {t.title}
                </h2>
                <p className="text-sm text-slate-600 mt-1">{t.blurb}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-brand-navy" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
