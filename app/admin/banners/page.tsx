import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { BannersManager } from "./BannersManager";

export const dynamic = "force-dynamic";

export interface BannerRow {
  id: string;
  image_url: string;
  alt_text: string | null;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export default async function AdminBannersPage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/dashboard");

  const supabase = createAdminClient();
  const { data: banners } = await supabase
    .from("home_banners")
    .select("*")
    .order("sort_order", { ascending: true });

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1">Home Banners</h1>
      <p className="text-sm text-slate-500 mb-6">
        Banners shown in the carousel at the top of the home page. Recommended
        size: <strong>1920 × 600 px</strong>. Upload PNG/JPG/WEBP up to 5 MB.
      </p>
      <BannersManager banners={(banners as BannerRow[]) || []} />
    </div>
  );
}
