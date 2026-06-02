import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantInfo } from "@/lib/tenant/business";
import { CouponsManager } from "./CouponsManager";

export const dynamic = "force-dynamic";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed" | "overnight_free";
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  expires_at: string | null;
  is_active: boolean;
  referrer_user_id: string | null;
  referrer_email: string | null;
}

export default async function AdminCouponsPage() {
  const supabase = createAdminClient();
  const tenant = await getTenantInfo();
  const tz = tenant.timezone;
  const { data: coupons } = await supabase
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });

  // Resolve referrer emails — coupons table only has user_id; emails live in auth.users
  const referrerIds = Array.from(new Set(
    ((coupons as any[]) || []).map((c) => c.referrer_user_id).filter(Boolean),
  ));
  const emailMap = new Map<string, string>();
  if (referrerIds.length > 0) {
    // For small N this is fine. For >1000 customers we'd batch differently.
    const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    for (const u of (usersData?.users || [])) {
      if (referrerIds.includes(u.id) && u.email) emailMap.set(u.id, u.email);
    }
  }

  const enriched: Coupon[] = ((coupons as any[]) || []).map((c) => ({
    ...c,
    referrer_email: c.referrer_user_id ? (emailMap.get(c.referrer_user_id) || null) : null,
  }));

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1">Coupons</h1>
      <p className="text-sm text-slate-500 mb-6">
        Discount codes customers can apply at checkout. Assign a coupon to a customer to track referrals + pay commission automatically.
      </p>
      <CouponsManager coupons={enriched} tz={tz} />
    </div>
  );
}
