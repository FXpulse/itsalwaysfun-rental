import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffOrAdmin } from "@/lib/auth/roles";
import { TemplateEditor } from "../TemplateEditor";

export const dynamic = "force-dynamic";

export default async function NewInspectionTemplatePage() {
  await requireStaffOrAdmin();
  const supabase = createAdminClient();

  const [productsR, categoriesR] = await Promise.all([
    supabase.from("products").select("id, name").order("name"),
    supabase.from("categories").select("id, name").order("name"),
  ]);

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <div className="mb-4">
        <Link href="/admin/inspections" className="text-sm text-slate-500 hover:underline">← Templates</Link>
      </div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">New inspection template</h1>
      <TemplateEditor
        products={(productsR.data as any[]) || []}
        categories={(categoriesR.data as any[]) || []}
      />
    </div>
  );
}
