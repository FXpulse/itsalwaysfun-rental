// KB article view (tenant-side).

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, BookOpen } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function KbArticlePage({ params }: { params: { slug: string } }) {
  const supabase = createAdminClient({ unscoped: true });
  const { data: article } = await supabase
    .from("kb_articles")
    .select("title, body_md, category, view_count, helpful_count")
    .eq("slug", params.slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!article) notFound();

  // bump view count
  await supabase.rpc("kb_increment_view", { p_slug: params.slug }).single().then(() => null).catch(() => {
    // no rpc — fall back to direct update
    return supabase.from("kb_articles")
      .update({ view_count: (article.view_count || 0) + 1 })
      .eq("slug", params.slug);
  });

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <Link href="/admin/support" className="text-sm text-slate-500 inline-flex items-center gap-1 mb-3">
        <ChevronLeft className="h-4 w-4" /> Back to support
      </Link>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-violet-700 mb-2">
          <BookOpen className="h-3.5 w-3.5" /> {article.category || "General"}
        </div>
        <h1 className="text-2xl font-bold text-brand-navy mb-4">{article.title}</h1>
        <article className="prose prose-sm max-w-none whitespace-pre-wrap font-sans text-slate-700">
          {article.body_md}
        </article>
      </div>
      <div className="mt-4 text-center text-xs text-slate-400">
        Couldn&apos;t find what you needed? <Link href="/admin/support#ticket" className="text-violet-700 underline">Send us a ticket.</Link>
      </div>
    </div>
  );
}
