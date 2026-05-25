import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { PackageEditor } from "../PackageEditor";

export const dynamic = "force-dynamic";

export default async function NewPackagePage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/dashboard");

  const supabase = createAdminClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, slug, price_per_day")
    .eq("is_active", true)
    .eq("is_addon", false)
    .order("name");

  return <PackageEditor products={products || []} />;
}
