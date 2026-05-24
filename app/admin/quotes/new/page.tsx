import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { QuoteEditor } from "../QuoteEditor";

export const dynamic = "force-dynamic";

export default async function NewQuotePage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/dashboard");

  const supabase = createAdminClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, slug, price_per_day")
    .eq("is_active", true)
    .order("name", { ascending: true });

  return <QuoteEditor products={products || []} />;
}
