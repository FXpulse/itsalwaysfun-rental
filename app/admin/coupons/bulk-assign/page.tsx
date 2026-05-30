import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Layers } from "lucide-react";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { BulkAssignForm } from "./BulkAssignForm";

export const dynamic = "force-dynamic";

export default async function BulkAssignPage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/login");

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/coupons" className="text-sm text-slate-500 inline-flex items-center gap-1">
        <ChevronLeft className="h-4 w-4" /> Back to coupons
      </Link>

      <div className="rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-600 text-white p-6 shadow-xl">
        <div className="text-xs uppercase tracking-wider text-violet-100 mb-2 flex items-center gap-1">
          <Layers className="h-3 w-3" /> Bulk assign
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold">Give coupons to many customers at once</h1>
        <p className="text-sm text-violet-100 mt-2">
          Pick customers, set the discount, and we'll generate unique codes + email each one.
        </p>
      </div>

      <BulkAssignForm />
    </div>
  );
}
