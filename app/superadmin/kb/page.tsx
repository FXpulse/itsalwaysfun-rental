// /superadmin/kb — Knowledge base article list with analytics.

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  BookOpen, Plus, Eye, ThumbsUp, ThumbsDown, Bot,
  ChevronRight, Sparkles,
} from "lucide-react";
import { getSuperadminUser } from "@/lib/auth/superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { Crumbs } from "../Crumbs";

export const dynamic = "force-dynamic";

interface KbArticle {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  tags: string[];
  is_published: boolean;
  view_count: number;
  helpful_count: number;
  unhelpful_count: number;
  ai_resolved_count: number;
  updated_at: string;
}

export default async function KbPage() {
  const me = await getSuperadminUser();
  if (!me) redirect("/superadmin/login?error=not_superadmin");

  const supabase = createAdminClient({ unscoped: true });
  const { data: articles } = await supabase
    .from("kb_articles")
    .select("*")
    .order("category")
    .order("title");

  const list = (articles as KbArticle[]) || [];
  const grouped: Record<string, KbArticle[]> = {};
  for (const a of list) {
    const c = a.category || "Other";
    if (!grouped[c]) grouped[c] = [];
    grouped[c]!.push(a);
  }

  const totals = {
    articles: list.length,
    views: list.reduce((s, a) => s + a.view_count, 0),
    ai_resolved: list.reduce((s, a) => s + a.ai_resolved_count, 0),
    helpful: list.reduce((s, a) => s + a.helpful_count, 0),
    drafts: list.filter((a) => !a.is_published).length,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <Crumbs trail={[{ label: "Knowledge Base" }]} />

      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 text-white p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-yellow-300/20 rounded-full blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-blue-100 text-xs uppercase tracking-wider mb-2">
              <BookOpen className="h-3.5 w-3.5" /> Knowledge Base
            </div>
            <h1 className="text-3xl font-bold">{totals.articles} articles · {totals.ai_resolved} AI auto-resolves</h1>
            <p className="text-sm text-blue-100 mt-2">
              Every new article makes the AI smarter at closing tickets without you.
            </p>
          </div>
          <Link
            href="/superadmin/kb/new"
            className="bg-white text-violet-700 hover:bg-yellow-100 font-bold rounded-lg px-4 py-2.5 inline-flex items-center gap-2 shadow"
          >
            <Plus className="h-4 w-4" /> New article
          </Link>
        </div>
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Mini icon={<Eye className="h-4 w-4" />} label="Total views" value={totals.views} />
          <Mini icon={<Bot className="h-4 w-4" />} label="AI resolves" value={totals.ai_resolved} accent="text-yellow-200" />
          <Mini icon={<ThumbsUp className="h-4 w-4" />} label="Helpful" value={totals.helpful} />
          <Mini icon={<Sparkles className="h-4 w-4" />} label="Drafts" value={totals.drafts} />
        </div>
      </div>

      {/* Articles grouped by category */}
      {Object.entries(grouped).map(([category, articles]) => (
        <section key={category}>
          <h2 className="font-bold text-brand-navy mb-3 flex items-center gap-2 text-lg">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 bg-slate-100 rounded px-2 py-0.5">
              {category}
            </span>
            <span className="text-slate-300 text-sm">({articles.length})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {articles.map((a) => <ArticleCard key={a.id} article={a} />)}
          </div>
        </section>
      ))}

      {list.length === 0 && (
        <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-10 text-center">
          <BookOpen className="h-12 w-12 text-violet-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-violet-900">No articles yet</h2>
          <p className="text-sm text-violet-700 mt-1 mb-4">Start writing — every article reduces your support load.</p>
          <Link href="/superadmin/kb/new" className="btn-primary inline-flex items-center gap-1">
            <Plus className="h-4 w-4" /> Write the first article
          </Link>
        </div>
      )}
    </div>
  );
}

function Mini({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: string }) {
  return (
    <div className="bg-white/10 backdrop-blur rounded-lg p-3 border border-white/20">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-blue-100">
        {icon} {label}
      </div>
      <div className={`text-2xl font-bold mt-1 ${accent || ""}`}>{value}</div>
    </div>
  );
}

function ArticleCard({ article }: { article: KbArticle }) {
  const helpRatio = article.helpful_count + article.unhelpful_count > 0
    ? Math.round((article.helpful_count / (article.helpful_count + article.unhelpful_count)) * 100)
    : null;

  return (
    <Link
      href={`/superadmin/kb/${article.id}/edit`}
      className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-violet-300 transition p-4 block"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-bold text-brand-navy line-clamp-2 flex-1">{article.title}</h3>
        {!article.is_published && (
          <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-amber-100 text-amber-900 shrink-0">DRAFT</span>
        )}
      </div>
      <div className="flex items-center gap-1 flex-wrap mb-3">
        {article.tags && article.tags.length > 0 && article.tags.slice(0, 3).map((t) => (
          <span key={t} className="text-[10px] bg-slate-100 text-slate-600 rounded-full px-1.5 py-0.5">#{t}</span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1 text-center text-[11px] pt-3 border-t border-slate-100">
        <div>
          <Eye className="h-3 w-3 mx-auto text-slate-400" />
          <div className="font-semibold text-slate-700 mt-0.5">{article.view_count}</div>
        </div>
        <div>
          <Bot className="h-3 w-3 mx-auto text-indigo-500" />
          <div className="font-semibold text-indigo-700 mt-0.5">{article.ai_resolved_count}</div>
        </div>
        <div>
          {helpRatio !== null ? (
            <>
              <ThumbsUp className="h-3 w-3 mx-auto text-emerald-500" />
              <div className="font-semibold text-emerald-700 mt-0.5">{helpRatio}%</div>
            </>
          ) : (
            <>
              <ThumbsDown className="h-3 w-3 mx-auto text-slate-300" />
              <div className="text-slate-400 mt-0.5">—</div>
            </>
          )}
        </div>
      </div>
      <div className="text-[10px] text-slate-400 mt-2 inline-flex items-center gap-0.5">
        Edit <ChevronRight className="h-3 w-3" />
      </div>
    </Link>
  );
}
