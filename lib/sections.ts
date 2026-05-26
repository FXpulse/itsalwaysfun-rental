// Read public-site section toggles from site_settings. Server only.
import { createAdminClient } from "@/lib/supabase/admin";

/** Is the public /packages section enabled? Defaults to true. */
export async function isPackagesSectionEnabled(): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "packages_section_enabled")
      .maybeSingle();
    if (!data) return true;
    return (data.value as string)?.toLowerCase() !== "false";
  } catch {
    return true;
  }
}
