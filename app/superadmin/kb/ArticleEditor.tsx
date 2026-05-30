"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Save, Eye, Trash2, Sparkles } from "lucide-react";
import { renderMarkdown } from "@/lib/markdown";
import { createArticle, updateArticle, deleteArticle, type ArticleInput } from "./actions";

export function ArticleEditor({
  mode,
  articleId,
  initial,
}: {
  mode: "new" | "edit";
  articleId?: string;
  initial?: ArticleInput;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [data, setData] = useState<ArticleInput>(
    initial || {
      slug: "",
      title: "",
      body_md: "# New article\n\nWrite your KB content here using markdown.\n\n## What this is\n\nA short description...\n\n## Steps\n\n1. First do this\n2. Then this\n3. Finally this\n\n> Tip: include code with backticks like `like this`",
      category: "Setup",
      tags: "",
      is_published: true,
    },
  );

  function set<K extends keyof ArticleInput>(k: K, v: ArticleInput[K]) {
    setData({ ...data, [k]: v });
  }

  function save() {
    if (!data.title.trim() || !data.body_md.trim()) {
      toast.error("Title and body required");
      return;
    }
    startTransition(async () => {
      if (mode === "new") {
        const r = await createArticle(data);
        if (r?.error) toast.error(r.error);
      } else if (articleId) {
        const r = await updateArticle(articleId, data);
        if (r?.error) toast.error(r.error);
        else toast.success("Saved ✓");
      }
    });
  }

  function remove() {
    if (!articleId) return;
    if (!confirm("Delete this article? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteArticle(articleId);
    });
  }

  return (
    <div className="space-y-4">
      {/* Meta */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Title</label>
            <input
              className="input"
              value={data.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="How do I do X?"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Slug (URL)</label>
            <input
              className="input font-mono text-sm"
              value={data.slug}
              onChange={(e) => set("slug", e.target.value)}
              placeholder="auto-generated from title"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Category</label>
            <input
              className="input"
              value={data.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder="Setup / Billing / Integrations / Reports"
              list="kb-categories"
            />
            <datalist id="kb-categories">
              <option value="Setup" />
              <option value="Billing" />
              <option value="Integrations" />
              <option value="Reports" />
              <option value="Bookings" />
              <option value="Troubleshooting" />
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Tags (comma sep)</label>
            <input
              className="input"
              value={data.tags}
              onChange={(e) => set("tags", e.target.value)}
              placeholder="stripe, billing, payments"
            />
          </div>
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.is_published}
            onChange={(e) => set("is_published", e.target.checked)}
          />
          <span className="font-semibold">Published</span>
          <span className="text-xs text-slate-400">(unchecked = draft, hidden from tenants)</span>
        </label>
      </div>

      {/* Side-by-side editor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Markdown
          </div>
          <textarea
            className="w-full p-3 font-mono text-sm focus:outline-none resize-none"
            style={{ minHeight: 500 }}
            value={data.body_md}
            onChange={(e) => set("body_md", e.target.value)}
          />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Eye className="h-3 w-3" /> Preview (live)
          </div>
          <div
            className="p-4 prose prose-sm max-w-none overflow-y-auto"
            style={{ minHeight: 500, maxHeight: 600 }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(data.body_md) }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-200">
        <div>
          {mode === "edit" && (
            <button
              onClick={remove}
              disabled={pending}
              className="text-sm text-rose-600 hover:bg-rose-50 px-3 py-2 rounded inline-flex items-center gap-1"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.back()}
            disabled={pending}
            className="text-sm text-slate-600 hover:bg-slate-100 px-3 py-2 rounded"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={pending}
            className="btn-primary inline-flex items-center gap-1"
          >
            <Save className="h-4 w-4" /> {pending ? "Saving…" : mode === "new" ? "Create" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
