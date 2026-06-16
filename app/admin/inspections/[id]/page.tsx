import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffOrAdmin } from "@/lib/auth/roles";
import { TemplateEditor } from "../TemplateEditor";

export const dynamic = "force-dynamic";

export default async function EditInspectionTemplatePage({
  params,
}: { params: { id: string } }) {
  await requireStaffOrAdmin();
  const supabase = createAdminClient();

  const [tplR, productsR, categoriesR] = await Promise.all([
    supabase
      .from("inspection_templates")
      .select("id, name, product_id, category_id, items, is_active")
      .eq("id", params.id)
      .maybeSingle(),
    supabase.from("products").select("id, name").order("name"),
    supabase.from("categories").select("id, name").order("name"),
  ]);

  if (!tplR.data) notFound();

  const tpl = tplR.data as any;
  const initial = {
    name: tpl.name as string,
    product_id: tpl.product_id as string | null,
    category_id: tpl.category_id as string | null,
    items: Array.isArray(tpl.items) ? tpl.items : [],
    is_active: tpl.is_active as boolean,
  };

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <div className="mb-4">
        <Link href="/admin/inspections" className="text-sm text-slate-500 hover:underline">← Templates</Link>
      </div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Edit inspection template</h1>
      <TemplateEditor
        templateId={tpl.id}
        initial={initial}
        products={(productsR.data as any[]) || []}
        categories={(categoriesR.data as any[]) || []}
      />
    </div>
  );
}
