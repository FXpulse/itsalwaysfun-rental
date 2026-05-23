import { createAdminClient } from "@/lib/supabase/admin";
import { CouponsManager } from "./CouponsManager";

export const dynamic = "force-dynamic";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  expires_at: string | null;
  is_active: boolean;
}

export default async function AdminCouponsPage() {
  const supabase = createAdminClient();
  const { data: coupons } = await supabase
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1">Coupons</h1>
      <p className="text-sm text-slate-500 mb-6">
        Discount codes customers can apply at checkout. Manage usage limits and expiration here.
      </p>
      <CouponsManager coupons={(coupons as Coupon[]) || []} />
    </div>
  );
}
