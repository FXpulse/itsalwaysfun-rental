import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Sparkles } from "lucide-react";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { getCurrentTenantId } from "@/lib/tenant/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SECTION_DEFS } from "@/lib/admin/home-sections";
import { SectionsClient } from "./SectionsClient";

export const dynamic = "force-dynamic";

export default async function HomeSectionsPage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/login");
  const tenantId = getCurrentTenantId();
  if (!tenantId) redirect("/admin/dashboard");

  const supabase = createAdminClient({ unscoped: true });
  const { data: rows } = await supabase
    .from("tenant_home_sections")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("display_order");

  const existing = new Map<string, any>(
    ((rows as any[]) || []).map((r) => [r.section_type, r]),
  );

  // Build the union: every section type, with existing data if set
  const sections = SECTION_DEFS.map((def) => {
    const row = existing.get(def.type);
    return {
      def,
      id: row?.id || null,
      is_enabled: row?.is_enabled ?? false,
      display_order: row?.display_order ?? def.default_order,
      content: row?.content || def.default_content,
    };
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/admin/site" className="text-sm text-slate-500 inline-flex items-center gap-1">
        <ChevronLeft className="h-4 w-4" /> Back to website content
      </Link>

      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 text-white p-6 shadow-xl">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-emerald-100 mb-2">
          <Sparkles className="h-3 w-3" /> Home page sections
        </div>
        <h1 className="text-3xl font-bold">Add extra sections to your home page</h1>
        <p className="text-sm text-emerald-100 mt-1">
          Toggle on the sections you want, fill in the content, and they show up on your public home page automatically.
        </p>
      </div>

      <SectionsClient sections={sections} />
    </div>
  );
}
