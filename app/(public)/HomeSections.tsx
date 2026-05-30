// Renders tenant-configured home sections on the public home page.
// Sections come from tenant_home_sections in display_order ascending.

import { sanitizeCustomHtml } from "@/lib/admin/home-sections";

interface SectionRow {
  section_type: string;
  display_order: number;
  content: Record<string, string>;
}

export function HomeSections({ sections }: { sections: SectionRow[] }) {
  if (!sections || sections.length === 0) return null;
  const sorted = [...sections].sort((a, b) => a.display_order - b.display_order);

  return (
    <>
      {sorted.map((s, i) => {
        if (s.section_type === "stats_banner") return <StatsBanner key={i} content={s.content} />;
        if (s.section_type === "why_us") return <WhyUs key={i} content={s.content} />;
        if (s.section_type === "cta_banner") return <CtaBanner key={i} content={s.content} />;
        if (s.section_type === "custom_html") return <CustomHtml key={i} content={s.content} />;
        return null;
      })}
    </>
  );
}

function StatsBanner({ content }: { content: Record<string, string> }) {
  return (
    <section className="bg-gradient-to-r from-brand-navy to-brand-navy-dark text-white py-10">
      <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
        {[1, 2, 3].map((n) => {
          const num = content[`stat_${n}_number`];
          const label = content[`stat_${n}_label`];
          if (!num) return null;
          return (
            <div key={n}>
              <div className="text-4xl sm:text-5xl font-bold text-brand-yellow">{num}</div>
              <div className="text-sm uppercase tracking-wider text-white/80 mt-1">{label}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function WhyUs({ content }: { content: Record<string, string> }) {
  return (
    <section className="bg-slate-50 py-12">
      <div className="max-w-6xl mx-auto px-4">
        {content.heading && (
          <h2 className="text-3xl font-bold text-center text-brand-navy mb-10">{content.heading}</h2>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => {
            const title = content[`feature_${n}_title`];
            const body = content[`feature_${n}_body`];
            if (!title) return null;
            return (
              <div key={n} className="bg-white rounded-2xl shadow-sm p-6 ring-1 ring-slate-100">
                <h3 className="font-bold text-brand-navy text-lg mb-2">{title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CtaBanner({ content }: { content: Record<string, string> }) {
  if (!content.headline) return null;
  return (
    <section className="bg-gradient-to-br from-brand-yellow/30 via-amber-100 to-orange-100 py-14">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-brand-navy mb-3">{content.headline}</h2>
        {content.subheadline && (
          <p className="text-lg text-slate-700 mb-6">{content.subheadline}</p>
        )}
        {content.button_text && content.button_link && (
          <a
            href={content.button_link}
            className="inline-block bg-brand-navy hover:bg-brand-navy-dark text-white font-bold text-base rounded-full px-8 py-3 shadow-md hover:shadow-lg transition"
          >
            {content.button_text}
          </a>
        )}
      </div>
    </section>
  );
}

function CustomHtml({ content }: { content: Record<string, string> }) {
  const html = sanitizeCustomHtml(content.html || "");
  if (!html.trim()) return null;
  return (
    <section className="py-8">
      <div className="max-w-6xl mx-auto px-4" dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}
