import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { formatCurrency } from "@/lib/utils";
import { getTenantInfo } from "@/lib/tenant/business";
import { formatDateInTz, formatDateTimeInTz } from "@/lib/tenant/timezone";
import { ArrowLeft, Sparkles, DollarSign, Gift } from "lucide-react";
import { PayoutForm, AdjustForm } from "./Forms";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  booking_points: "Booking points earned",
  points_redeemed: "Points redeemed",
  referral_commission: "Referral commission",
  commission_payout: "Commission paid out",
  admin_adjustment: "Admin adjustment",
};

const TYPE_STYLES: Record<string, string> = {
  booking_points: "bg-green-100 text-green-800",
  points_redeemed: "bg-amber-100 text-amber-800",
  referral_commission: "bg-purple-100 text-purple-800",
  commission_payout: "bg-blue-100 text-blue-800",
  admin_adjustment: "bg-slate-100 text-slate-700",
};

export default async function AdminLoyaltyDetailPage({
  params,
}: {
  params: { user_id: string };
}) {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/dashboard");

  const supabase = createAdminClient();
  const tenant = await getTenantInfo();
  const tz = tenant.timezone;
  const { data: profile } = await supabase
    .from("customer_profiles")
    .select("*")
    .eq("user_id", params.user_id)
    .single();
  if (!profile) notFound();

  // Lookup email
  const { data: authUserRes } = await supabase.auth.admin.getUserById(params.user_id);
  const customerEmail = authUserRes?.user?.email || "(no email)";

  // Lookup referrer email (if any)
  let referrerEmail: string | null = null;
  if (profile.referred_by_user_id) {
    const { data: refUserRes } = await supabase.auth.admin.getUserById(
      profile.referred_by_user_id,
    );
    referrerEmail = refUserRes?.user?.email || null;
  }

  // Coupons assigned to THIS customer (admin-attributed referrer flow)
  const { data: assignedCoupons } = await supabase
    .from("coupons")
    .select("id, code, description, discount_type, discount_value, current_uses, max_uses, is_active, expires_at, created_at")
    .eq("referrer_user_id", params.user_id)
    .order("created_at", { ascending: false });

  // For each assigned coupon, sum the commission earned via that coupon's bookings
  const assignedWithEarnings: Array<any> = [];
  for (const c of (assignedCoupons as any[]) || []) {
    const { data: bookings } = await supabase
      .from("bookings").select("id").eq("coupon_code", c.code);
    const ids = ((bookings as any[]) || []).map((b) => b.id);
    let earned = 0;
    if (ids.length > 0) {
      const { data: tx } = await supabase
        .from("loyalty_transactions")
        .select("commission_cents")
        .eq("user_id", params.user_id)
        .eq("type", "referral_commission")
        .in("booking_id", ids);
      earned = ((tx as any[]) || []).reduce((s, t) => s + (t.commission_cents || 0), 0);
    }
    assignedWithEarnings.push({ ...c, commission_earned_cents: earned });
  }

  // List people THEY referred
  const { data: refList } = await supabase
    .from("customer_profiles")
    .select("user_id, created_at")
    .eq("referred_by_user_id", params.user_id);
  let referredEmails: { email: string; created_at: string }[] = [];
  if (refList && refList.length > 0) {
    const { data: { users } = { users: [] } } = await supabase.auth.admin.listUsers({
      perPage: 200,
    });
    const emailMap = new Map((users || []).map((u: any) => [u.id, u.email]));
    referredEmails = refList.map((r: any) => ({
      email: (emailMap.get(r.user_id) as string) || "(no email)",
      created_at: r.created_at,
    }));
  }

  // Ledger
  const { data: ledger } = await supabase
    .from("loyalty_transactions")
    .select("id, type, points, commission_cents, description, created_at, booking_id")
    .eq("user_id", params.user_id)
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="max-w-5xl">
      <Link
        href="/admin/loyalty"
        className="text-sm text-slate-500 hover:text-brand-navy inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-3 w-3" /> Back to loyalty overview
      </Link>

      <h1 className="text-2xl font-bold text-brand-navy mb-1">{customerEmail}</h1>
      <p className="text-sm text-slate-500 mb-6">
        Referral code: <code className="font-mono text-brand-navy">{profile.referral_code}</code>
        {referrerEmail && (
          <span className="ml-2">
            · Referred by <strong>{referrerEmail}</strong>
          </span>
        )}
      </p>

      {/* Balances */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <BalanceCard
          icon={Sparkles}
          label="Loyalty points"
          value={(profile.loyalty_points || 0).toLocaleString()}
        />
        <BalanceCard
          icon={DollarSign}
          label="Commission pending"
          value={formatCurrency(profile.commission_pending_cents || 0)}
          accent
        />
        <BalanceCard
          icon={Gift}
          label="Paid out"
          value={formatCurrency(profile.commission_paid_cents || 0)}
        />
      </div>

      {/* Payout + Adjust forms */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <h2 className="font-bold text-brand-navy mb-3">Record commission payout</h2>
          <p className="text-xs text-slate-500 mb-3">
            After you pay this customer outside the system (Venmo, Zelle, cash),
            record it here to clear the pending balance + log the audit trail.
          </p>
          <PayoutForm
            userId={params.user_id}
            maxPending={profile.commission_pending_cents || 0}
          />
        </div>

        <div className="card">
          <h2 className="font-bold text-brand-navy mb-3">Manual adjustment</h2>
          <p className="text-xs text-slate-500 mb-3">
            Add or remove points/commission with a reason (audit logged). Use
            negative numbers to subtract.
          </p>
          <AdjustForm userId={params.user_id} />
        </div>
      </div>

      {/* Assigned coupons (admin-attributed referrer flow) */}
      {assignedWithEarnings.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
            🎟 Assigned coupons ({assignedWithEarnings.length})
            <Link href="/admin/coupons" className="text-xs text-violet-700 hover:underline ml-2 normal-case font-normal">
              Manage in coupons →
            </Link>
          </h2>
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Discount</th>
                  <th className="px-4 py-3 text-right">Uses</th>
                  <th className="px-4 py-3 text-right">Commission earned</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignedWithEarnings.map((c) => (
                  <tr key={c.id} className={c.is_active ? "" : "opacity-50"}>
                    <td className="px-4 py-3 font-mono font-bold text-violet-900">{c.code}</td>
                    <td className="px-4 py-3 text-xs">
                      {c.discount_type === "percent"
                        ? `${c.discount_value}% off`
                        : c.discount_type === "fixed"
                          ? `$${(c.discount_value / 100).toFixed(0)} off`
                          : "Overnight free"}
                      {c.description && <div className="text-[10px] text-slate-500">{c.description}</div>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {c.max_uses != null ? `${c.current_uses} / ${c.max_uses}` : `${c.current_uses}`}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-700">
                      {formatCurrency(c.commission_earned_cents)}
                    </td>
                    <td className="px-4 py-3">
                      {c.is_active ? (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 rounded px-2 py-0.5">Active</span>
                      ) : (
                        <span className="text-[10px] bg-slate-200 text-slate-600 rounded px-2 py-0.5">Inactive</span>
                      )}
                      {c.expires_at && new Date(c.expires_at) < new Date() && (
                        <span className="text-[10px] bg-rose-100 text-rose-700 rounded px-2 py-0.5 ml-1">Expired</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Referred users */}
      {referredEmails.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">
            People they referred ({referredEmails.length})
          </h2>
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {referredEmails.map((r) => (
                  <tr key={r.email}>
                    <td className="px-4 py-3">{r.email}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDateInTz(r.created_at, tz)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Full ledger */}
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">
        Full transaction history ({ledger?.length || 0})
      </h2>
      {!ledger || ledger.length === 0 ? (
        <div className="card text-center text-slate-400 py-8">
          No transactions yet.
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-right">Points</th>
                <th className="px-4 py-3 text-right">Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledger.map((t: any) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {formatDateTimeInTz(t.created_at, tz)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] rounded px-2 py-0.5 ${TYPE_STYLES[t.type] || ""}`}
                    >
                      {TYPE_LABEL[t.type] || t.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">{t.description || "—"}</td>
                  <td
                    className={`px-4 py-3 text-right font-mono text-xs ${
                      t.points > 0
                        ? "text-green-700"
                        : t.points < 0
                          ? "text-amber-700"
                          : "text-slate-400"
                    }`}
                  >
                    {t.points
                      ? `${t.points > 0 ? "+" : ""}${t.points.toLocaleString()}`
                      : "—"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono text-xs ${
                      t.commission_cents > 0
                        ? "text-green-700"
                        : t.commission_cents < 0
                          ? "text-amber-700"
                          : "text-slate-400"
                    }`}
                  >
                    {t.commission_cents
                      ? `${t.commission_cents > 0 ? "+" : ""}${formatCurrency(t.commission_cents)}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BalanceCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`card py-3 ${accent ? "bg-amber-50 border-amber-200" : ""}`}>
      <div className="flex items-center gap-2 text-xs text-slate-500 uppercase">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-xl font-bold text-brand-navy mt-1">{value}</div>
    </div>
  );
}
