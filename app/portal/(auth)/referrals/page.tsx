import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureCustomerProfile, getLoyaltySettings } from "@/lib/loyalty";
import { formatCurrency } from "@/lib/utils";
import { getTenantBusinessName } from "@/lib/tenant/business";
import { ReferralBox } from "./ReferralBox";
import { PayoutSection } from "./PayoutSection";
import { Gift, Users, DollarSign } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PortalReferralsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Ensure profile + get code
  await ensureCustomerProfile(user.id);
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("customer_profiles")
    .select("referral_code, commission_pending_cents, commission_paid_cents, w9_url, w9_uploaded_at, w9_tax_year")
    .eq("user_id", user.id)
    .single();

  // Payout requests (current + history)
  const { data: payoutHistory } = await admin
    .from("payout_requests")
    .select("id, amount_cents, payout_type, status, requested_at, approved_at, processed_at, rejected_reason")
    .eq("user_id", user.id)
    .order("requested_at", { ascending: false })
    .limit(20);

  // List of referred users (people who used this person's code)
  const { data: referredProfiles } = await admin
    .from("customer_profiles")
    .select("user_id, created_at")
    .eq("referred_by_user_id", user.id);

  // For each referred user, get their email + their first paid booking total (if any)
  const referredList: Array<{
    email: string;
    joined: string;
    has_paid: boolean;
    first_paid_total: number;
  }> = [];
  if (referredProfiles && referredProfiles.length > 0) {
    const { data: { users } = { users: [] } } = await admin.auth.admin.listUsers({
      perPage: 200,
    });
    const userMap = new Map((users || []).map((u: any) => [u.id, u.email]));

    for (const rp of referredProfiles) {
      const email = (userMap.get(rp.user_id) as string) || "(unknown)";
      const { data: paidBookings } = await admin
        .from("bookings")
        .select("total_amount")
        .ilike("customer_email", email)
        .eq("stripe_payment_status", "paid")
        .order("created_at", { ascending: true })
        .limit(1);

      referredList.push({
        email,
        joined: rp.created_at,
        has_paid: (paidBookings || []).length > 0,
        first_paid_total: (paidBookings?.[0] as any)?.total_amount || 0,
      });
    }
  }

  // Commission earned ledger
  const { data: commissionTx } = await admin
    .from("loyalty_transactions")
    .select("commission_cents, description, created_at, booking_id")
    .eq("user_id", user.id)
    .eq("type", "referral_commission")
    .order("created_at", { ascending: false })
    .limit(20);

  const settings = await getLoyaltySettings();
  const businessName = await getTenantBusinessName();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy mb-1">Refer friends, earn rewards</h1>
        <p className="text-sm text-slate-500">
          Share your link below. When someone books for the first time using your link, you
          earn <strong>{settings.referral_commission_pct}% commission</strong>.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={Users}
          label="Referred"
          value={String(referredList.length)}
        />
        <StatCard
          icon={Gift}
          label="Paid commission"
          value={formatCurrency(profile?.commission_paid_cents || 0)}
        />
        <StatCard
          icon={DollarSign}
          label="Pending commission"
          value={formatCurrency(profile?.commission_pending_cents || 0)}
          accent
        />
      </div>

      {/* Referral code/link box */}
      <ReferralBox code={profile?.referral_code || ""} businessName={businessName} />

      {/* Payout request section */}
      <PayoutSection
        pendingBalance={profile?.commission_pending_cents || 0}
        hasW9OnFile={!!profile?.w9_url}
        w9UploadedAt={profile?.w9_uploaded_at || null}
        w9TaxYear={profile?.w9_tax_year || null}
        payoutHistory={(payoutHistory as any[]) || []}
      />

      {/* Referred list */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">
          People you referred
        </h2>
        {referredList.length === 0 ? (
          <div className="card text-center text-slate-400 py-8">
            <Gift className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No referrals yet. Share your link to start earning!</p>
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Friend's email</th>
                  <th className="px-4 py-3 text-left">Joined</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Your commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {referredList.map((r) => (
                  <tr key={r.email}>
                    <td className="px-4 py-3">{r.email}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(r.joined).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {r.has_paid ? (
                        <span className="text-xs bg-green-100 text-green-800 rounded px-2 py-0.5">
                          Booked ✓
                        </span>
                      ) : (
                        <span className="text-xs bg-amber-100 text-amber-800 rounded px-2 py-0.5">
                          Waiting
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {r.has_paid
                        ? formatCurrency(
                            Math.round(
                              r.first_paid_total * (settings.referral_commission_pct / 100),
                            ),
                          )
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Commission ledger */}
      {commissionTx && commissionTx.length > 0 && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">
            Commission history
          </h2>
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {commissionTx.map((t: any) => (
                  <tr key={t.created_at + (t.booking_id || "")}>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">{t.description || "Commission"}</td>
                    <td className="px-4 py-3 text-right font-mono text-green-700 font-semibold">
                      +{formatCurrency(t.commission_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400 text-center">
        Pending commission is paid out manually — we'll contact you when balance reaches
        a payout threshold.
      </p>
    </div>
  );
}

function StatCard({
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
    <div className={`card py-3 ${accent ? "bg-brand-yellow/10 border-brand-yellow/30" : ""}`}>
      <div className="flex items-center gap-2 text-xs text-slate-500 uppercase">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-xl font-bold text-brand-navy mt-1">{value}</div>
    </div>
  );
}
