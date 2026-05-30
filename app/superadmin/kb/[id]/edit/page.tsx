import { notFound, redirect } from "next/navigation";
import { getSuperadminUser } from "@/lib/auth/superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { Crumbs } from "../../../Crumbs";
import { ArticleEditor } from "../../ArticleEditor";

export const dynamic = "force-dynamic";

export default async function EditArticlePage({ params }: { params: { id: string } }) {
  const me = await getSuperadminUser();
  if (!me) redirect("/superadmin/login?error=not_superadmin");

  const supabase = createAdminClient({ unscoped: true });
  const { data: article } = await supabase
    .from("kb_articles")
    .select("id, slug, title, body_md, category, tags, is_published, view_count, helpful_count, ai_resolved_count")
    .eq("id", params.id)
    .maybeSingle();

  if (!article) notFound();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <Crumbs
        trail={[
          { label: "Knowledge Base", href: "/superadmin/kb" },
          { label: article.title.slice(0, 60) },
        ]}
      />
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-brand-navy">{article.title}</h1>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>👁 {article.view_count} views</span>
          <span>🤖 {article.ai_resolved_count} AI resolves</span>
          <span>👍 {article.helpful_count}</span>
        </div>
      </div>
      <ArticleEditor
        mode="edit"
        articleId={article.id}
        initial={{
          slug: article.slug,
          title: article.title,
          body_md: article.body_md,
          category: article.category || "",
          tags: (article.tags || []).join(", "),
          is_published: article.is_published,
        }}
      />
    </div>
  );
}
