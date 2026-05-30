// /widget/support — embeddable iframe support widget for tenant sites.
// Designed to be loaded inside a 360x520 iframe by:
//   <iframe src="https://getrentalflow.com/widget/support" ...>
// Or auto-mounted by /widget.js loader (see /public/widget.js).

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { BookOpen, Search, Send, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SupportWidgetPage({
  searchParams,
}: { searchParams: { q?: string } }) {
  const supabase = createAdminClient({ unscoped: true });

  let articles: any[] = [];
  if (searchParams.q) {
    const { data } = await supabase
      .from("kb_articles")
      .select("slug, title, category, body_md")
      .eq("is_published", true)
      .or(`title.ilike.%${searchParams.q}%,body_md.ilike.%${searchParams.q}%`)
      .limit(5);
    articles = data || [];
  } else {
    const { data } = await supabase
      .from("kb_articles")
      .select("slug, title, category")
      .eq("is_published", true)
      .order("view_count", { ascending: false })
      .limit(6);
    articles = data || [];
  }

  return (
    <html lang="en">
      <body className="m-0 font-sans bg-white" style={{ width: 360, minHeight: 520 }}>
        <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-purple-100 mb-1">
            <Sparkles className="h-3 w-3" /> RentalFlow Help
          </div>
          <h1 className="text-lg font-bold">Hey — how can we help?</h1>
          <p className="text-xs text-purple-100 mt-1">Search our guides or send a ticket.</p>
        </div>

        <form className="p-3 border-b border-slate-100 bg-slate-50">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              name="q"
              defaultValue={searchParams.q || ""}
              placeholder="Search…"
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-violet-400"
              autoFocus
            />
          </div>
        </form>

        <div className="p-3 max-h-80 overflow-y-auto">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            {searchParams.q ? `Matching "${searchParams.q}"` : "Most viewed"}
          </h2>
          {articles.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No articles matching that. Try a ticket below.</p>
          ) : (
            <ul className="space-y-1">
              {articles.map((a) => (
                <li key={a.slug}>
                  <a
                    href={`/admin/support/kb/${a.slug}`}
                    target="_top"
                    className="block p-2 rounded hover:bg-violet-50 transition border border-slate-100"
                  >
                    <div className="text-xs font-semibold text-brand-navy">{a.title}</div>
                    {a.category && <div className="text-[10px] text-slate-400 mt-0.5">{a.category}</div>}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-3 border-t border-slate-100">
          <Link
            href="/admin/support#ticket"
            target="_top"
            className="block w-full text-center bg-brand-navy hover:bg-brand-navy-dark text-white font-semibold rounded-lg py-2.5 text-sm inline-flex items-center justify-center gap-1"
          >
            <Send className="h-4 w-4" /> Submit a ticket
          </Link>
        </div>

        <div className="text-center text-[10px] text-slate-400 py-2">
          Powered by RentalFlow
        </div>
      </body>
    </html>
  );
}
