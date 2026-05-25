// Gift card settings helpers — server only.
import { createAdminClient } from "@/lib/supabase/admin";

/** Is the public /gift-cards purchase page enabled?
 *  Backed by site_settings.gift_card_sales_enabled. Defaults to true. */
export async function isGiftCardSalesEnabled(): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "gift_card_sales_enabled")
      .maybeSingle();
    if (!data) return true; // default on
    return (data.value as string)?.toLowerCase() !== "false";
  } catch {
    return true;
  }
}
