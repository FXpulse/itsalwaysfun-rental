import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteSettings } from "@/lib/site-settings";
import { faqPageJsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { headers } from "next/headers";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 60;

interface Faq {
  id: string;
  question: string;
  answer: string;
}

export default async function FAQsPage() {
  const supabase = createAdminClient();
  const [{ data: faqs }, settings] = await Promise.all([
    supabase
      .from("faqs")
      .select("id, question, answer")
      .eq("is_active", true)
      .order("display_order"),
    getSiteSettings(),
  ]);

  const list = (faqs as Faq[]) || [];

  // SEO: FAQPage schema → Google shows FAQs as rich snippets in SERP
  const h = headers();
  const host = h.get("host") || "itsalwaysfun.net";
  const proto = h.get("x-forwarded-proto") || "https";
  const baseUrl = `${proto}://${host}`;
  const faqJsonLd = list.length > 0
    ? faqPageJsonLd({ faqs: list.map((f) => ({ question: f.question, answer: f.answer })), baseUrl })
    : null;
  const breadcrumbLd = breadcrumbJsonLd({
    items: [
      { name: "Home", url: `${baseUrl}/` },
      { name: "Info", url: `${baseUrl}/info` },
      { name: "FAQs", url: `${baseUrl}/info/faqs` },
    ],
  });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-brand-navy mb-2">
          Frequently Asked Questions
        </h1>
        <p className="text-slate-600">
          Can't find an answer? Call us at{" "}
          <a href={`tel:${settings.business_phone.replace(/\D/g, "")}`} className="text-brand-navy font-semibold underline">
            {settings.business_phone}
          </a>
        </p>
      </div>

      {list.length === 0 ? (
        <div className="card text-center text-slate-400 py-8">
          No FAQs published yet.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((f) => (
            <details key={f.id} className="card group">
              <summary className="cursor-pointer font-semibold text-brand-navy text-lg list-none flex items-center justify-between">
                <span>{f.question}</span>
                <span className="text-brand-yellow group-open:rotate-45 transition-transform text-2xl leading-none">
                  +
                </span>
              </summary>
              <p className="text-slate-700 mt-3 leading-relaxed whitespace-pre-line">
                {f.answer}
              </p>
            </details>
          ))}
        </div>
      )}

      <div className="text-center mt-10">
        <p className="text-slate-600 mb-4">Still have questions?</p>
        <Link href="/contact" className="btn-primary inline-block">
          Contact us
        </Link>
      </div>
    </div>
  );
}
