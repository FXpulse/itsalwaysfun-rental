import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { formatCurrency } from "@/lib/utils";
import { Plus, Package as PackageIcon, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminPackagesPage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/dashboard");

  const supabase = createAdminClient();
  const { data: packages } = await supabase
    .from("packages")
    .select("*")
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  const list = (packages as any[]) || [];

  return (
    <div className="max-w-5xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy mb-1">Packages</h1>
          <p className="text-sm text-slate-500">
            Pre-bundled product sets at a fixed price. Customers book the whole
            bundle as one item. Great for parties: "Birthday Bundle = bounce
            house + 12 chairs + cotton candy".
          </p>
        </div>
        <Link href="/admin/packages/new" className="btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> New package
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="card text-center text-slate-400 py-12">
          <PackageIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>No packages yet. Create one to start offering bundles.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {list.map((p) => (
            <Link
              key={p.id}
              href={`/admin/packages/${p.id}`}
              className={`card hover:shadow-md transition ${!p.is_active ? "opacity-50" : ""}`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-brand-navy">{p.name}</h2>
                  <code className="text-xs text-slate-400">/{p.slug}</code>
                </div>
                <div className="text-right">
                  <div className="font-bold text-brand-navy text-lg">
                    {formatCurrency(p.price_cents)}
                  </div>
                  {!p.is_active && (
                    <span className="text-[10px] bg-slate-200 text-slate-600 rounded px-1.5">
                      DISABLED
                    </span>
                  )}
                </div>
              </div>
              {p.description && (
                <p className="text-xs text-slate-600 mb-2 line-clamp-2">{p.description}</p>
              )}
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{(p.items || []).length} item{(p.items || []).length === 1 ? "" : "s"} in bundle</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
