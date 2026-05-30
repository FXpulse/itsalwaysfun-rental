// /admin/support — tenant-side support page.
//
// First shows KB articles (browse + search). Below has a ticket form for
// when the KB doesn't help. The form posts to /api/admin/support which
// triggers AI triage in the background.

import { redirect } from "next/navigation";
import Link from "next/link";
import { LifeBuoy, BookOpen, ArrowRight } from "lucide-react";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { SupportForm } from "./SupportForm";

export const dynamic = "force-dynamic";

export default async function TenantSupportPage() {
  const me = await getCurrentUserRole();
  if (!me) redirect("/admin/login");

  const supabase = createAdminClient({ unscoped: true });
  const { data: articles } = await supabase
    .from("kb_articles")
    .select("id, slug, title, category")
    .eq("is_published", true)
    .order("category")
    .order("title");

  type Article = { id: string; slug: string; title: string; category: string | null };
  const list = (articles as Article[]) || [];
  const grouped: Record<string, Article[]> = {};
  for (const a of list) {
    const c = a.category || "Other";
    if (!grouped[c]) grouped[c] = [];
    grouped[c]!.push(a);
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      <div className="bg-gradient-to-br from-indigo-50 via-violet-50 to-purple-50 rounded-2xl p-6 border border-violet-200">
        <h1 className="text-2xl font-bold text-brand-navy flex items-center gap-2">
          <LifeBuoy className="h-7 w-7 text-violet-600" /> Support
        </h1>
        <p className="text-slate-600 mt-2">
          Empezá buscando una guía. Si no encontrás respuesta, mandanos un ticket y nuestro AI te responde en minutos.
        </p>
      </div>

      {/* Knowledge base */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h2 className="text-lg font-bold text-brand-navy flex items-center gap-2 mb-3">
          <BookOpen className="h-5 w-5" /> Knowledge base
        </h2>
        {Object.entries(grouped).length === 0 ? (
          <p className="text-sm text-slate-500">No guides yet.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{category}</h3>
                <ul className="space-y-0.5">
                  {items.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/admin/support/kb/${a.slug}`}
                        className="text-sm text-brand-navy hover:underline inline-flex items-center gap-1 py-1"
                      >
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                        {a.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Ticket form */}
      <section>
        <h2 className="text-lg font-bold text-brand-navy mb-2">Couldn&apos;t find an answer?</h2>
        <p className="text-sm text-slate-500 mb-3">Send us a ticket. Most are resolved in under a day.</p>
        <SupportForm />
      </section>
    </div>
  );
}
