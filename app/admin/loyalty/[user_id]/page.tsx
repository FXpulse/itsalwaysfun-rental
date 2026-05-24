import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { formatCurrency } from "@/lib/utils";
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
                      {new Date(r.created_at).toLocaleDateString()}
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
                    {new Date(t.created_at).toLocaleString()}
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
