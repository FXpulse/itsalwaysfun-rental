import { createAdminClient } from "@/lib/supabase/admin";
import { SiteSettingsForm } from "./SiteSettingsForm";

export const dynamic = "force-dynamic";

interface SettingRow {
  key: string;
  value: string | null;
  description: string | null;
  category: string;
}

export default async function AdminSitePage() {
  const supabase = createAdminClient();
  const { data: settings } = await supabase
    .from("site_settings")
    .select("key, value, description, category")
    .order("category")
    .order("key");

  // Group by category — explicit Record<string, SettingRow[]> so TS is happy
  const grouped: Record<string, SettingRow[]> = {};
  for (const s of (settings as SettingRow[] | null) || []) {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category]!.push(s);
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1">
        Website Content
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Edit logo, business info, and all text shown on the public website.
        Changes apply immediately (no redeploy needed).
      </p>

      <SiteSettingsForm groupedSettings={grouped} />
    </div>
  );
}
