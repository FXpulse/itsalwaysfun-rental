import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { PackageEditor } from "../PackageEditor";

export const dynamic = "force-dynamic";

export default async function EditPackagePage({
  params,
}: {
  params: { id: string };
}) {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/dashboard");

  const supabase = createAdminClient();
  const [{ data: pkg }, { data: products }] = await Promise.all([
    supabase.from("packages").select("*").eq("id", params.id).single(),
    supabase
      .from("products")
      .select("id, name, slug, price_per_day")
      .eq("is_active", true)
      .eq("is_addon", false)
      .order("name"),
  ]);

  if (!pkg) notFound();

  const initial = {
    id: pkg.id,
    slug: pkg.slug,
    name: pkg.name,
    description: pkg.description || "",
    image_url: pkg.image_url || "",
    price_cents: pkg.price_cents,
    items: pkg.items || [],
    display_order: pkg.display_order,
    is_active: pkg.is_active,
  };

  return <PackageEditor initial={initial} products={products || []} />;
}
