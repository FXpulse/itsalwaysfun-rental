// /free-tools/1099-tracker — server shell. Renders header + footer + the
// SoftwareApplication JSON-LD + mounts the client Tracker.

import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Tracker } from "./Tracker";

export const metadata: Metadata = {
  title: "Free 1099-NEC Tracker for Rental Businesses | RentalFlow",
  description:
    "Track contractor payments and stay compliant with the IRS $600 1099-NEC threshold. Free, no signup, runs in your browser. Built by bouncy house rental owners.",
  alternates: { canonical: "/free-tools/1099-tracker" },
  openGraph: {
    title: "Free 1099-NEC Tracker — RentalFlow",
    description:
      "Track contractor payments against the IRS $600 threshold. Browser-based, no signup.",
    images: [{ url: "/og-1099-tracker.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free 1099-NEC Tracker — RentalFlow",
    description:
      "Track contractor payments against the IRS $600 threshold. Browser-based, no signup.",
    images: ["/og-1099-tracker.png"],
  },
  robots: { index: true, follow: true },
};

export default function TrackerPage({
  searchParams,
}: {
  searchParams: { ref?: string };
}) {
  const h = headers();
  const host = h.get("host") || "getrentalflow.com";
  const proto = h.get("x-forwarded-proto") || "https";
  const baseUrl = `${proto}://${host}`;
  const ref = typeof searchParams.ref === "string" ? searchParams.ref : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Free 1099-NEC Tracker",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${baseUrl}/free-tools/1099-tracker`,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description:
      "Track contractor payments against the IRS $600 1099-NEC threshold. Free, browser-based, no signup.",
    creator: { "@type": "Organization", name: "RentalFlow" },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Hero */}
        <header className="text-center mb-8">
          <div className="inline-block bg-amber-100 text-amber-900 text-xs font-bold tracking-wider px-3 py-1 rounded-full mb-3">
            FREE · NO SIGNUP
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-brand-navy mb-3">
            1099-NEC Tracker
          </h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Stay compliant with the IRS $600 threshold. Add your contractors,
            log payments throughout the year, and see who needs a 1099.{" "}
            <strong>Your data stays in your browser.</strong>
          </p>
          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-slate-500">
            <span>🔒 100% browser-local</span>
            <span>📊 IRS $600 threshold</span>
            <span>🚀 Built by rental owners</span>
          </div>
        </header>

        <Tracker ref_={ref} />

        {/* Footer CTA */}
        <footer className="mt-12 pt-8 border-t border-slate-200 text-center">
          <p className="text-sm text-slate-600 mb-3">
            Built by <strong>It's Always Fun, LLC</strong> — Jacksonville, FL
          </p>
          <Link
            href="/signup?utm_source=free-tools&utm_medium=1099-tracker"
            className="btn-primary inline-block"
          >
            Try RentalFlow free for 30 days →
          </Link>
          <p className="text-xs text-slate-400 mt-3">
            RentalFlow handles 1099 tracking automatically + everything else
            you need to run a rental business.{" "}
            <Link href="/info/privacy-policy" className="underline hover:text-brand-navy">
              Privacy policy
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
