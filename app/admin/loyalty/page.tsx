import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { getLoyaltySettings } from "@/lib/loyalty";
import { formatCurrency } from "@/lib/utils";
import {
  Sparkles,
  Gift,
  DollarSign,
  Users,
  Settings,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { PayoutRequestsPanel } from "./PayoutRequestsPanel";

export const dynamic = "force-dynamic";

export default async function AdminLoyaltyPage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/dashboard");

  const supabase = createAdminClient();
  const settings = await getLoyaltySettings();

  // Read threshold from site_settings
  const { data: thresholdSetting } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "commission_payout_threshold_cents")
    .maybeSingle();
  const thresholdCents = parseInt((thresholdSetting?.value as string) || "5000", 10) || 5000;

  // All customer profiles with balances
  const { data: profiles } = await supabase
    .from("customer_profiles")
    .select("user_id, referral_code, loyalty_points, commission_pending_cents, commission_paid_cents, created_at")
    .order("commission_pending_cents", { ascending: false });

  // Map user_ids → emails
  const { data: { users: authUsers } = { users: [] } } =
    await supabase.auth.admin.listUsers({ perPage: 500 });
  const emailMap = new Map((authUsers || []).map((u: any) => [u.id, u.email]));

  // Fetch pending + approved payout requests (need admin attention)
  const { data: pendingRequests } = await supabase
    .from("payout_requests")
    .select("*")
    .in("status", ["pending", "approved"])
    .order("requested_at", { ascending: false });

  const payoutRequests = ((pendingRequests as any[]) || []).map((r) => {
    const authUser = (authUsers || []).find((u: any) => u.id === r.user_id);
    const meta = (authUser?.user_metadata as any) || {};
    const name =
      `${meta.first_name || ""} ${meta.last_name || ""}`.trim() ||
      authUser?.email ||
      "(unknown)";
    return {
      ...r,
      user_email: authUser?.email || "(unknown)",
      user_name: name,
    };
  });

  // Stats totals
  const totals = (profiles || []).reduce(
    (acc: any, p: any) => {
      acc.points += p.loyalty_points || 0;
      acc.pending += p.commission_pending_cents || 0;
      acc.paid += p.commission_paid_cents || 0;
      return acc;
    },
    { points: 0, pending: 0, paid: 0 },
  );

  // Count customers over the payout threshold
  const overThreshold = (profiles || []).filter(
    (p: any) => p.commission_pending_cents >= thresholdCents,
  ).length;

  return (
    <div className="max-w-6xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy mb-1">Loyalty & Referrals</h1>
          <p className="text-sm text-slate-500">
            Customer points, referral commission, and payout management.
          </p>
        </div>
        <Link
          href="/admin/site#loyalty"
          className="text-xs text-slate-500 hover:text-brand-navy inline-flex items-center gap-1"
        >
          <Settings className="h-3 w-3" /> Edit settings
        </Link>
      </div>

      {/* Payout requests panel — only renders if there are any */}
      <PayoutRequestsPanel requests={payoutRequests} />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={Sparkles}
          label="Outstanding points"
          value={totals.points.toLocaleString()}
          sub={`≈ ${formatCurrency(
            Math.round((totals.points / settings.points_redemption_rate) * 100),
          )} liability`}
        />
        <StatCard
          icon={DollarSign}
          label="Pending commission"
          value={formatCurrency(totals.pending)}
          sub={overThreshold > 0 ? `${overThreshold} ready to pay out` : "All below threshold"}
          accent={overThreshold > 0}
        />
        <StatCard
          icon={Gift}
          label="Paid out commission"
          value={formatCurrency(totals.paid)}
        />
        <StatCard
          icon={Users}
          label="Total customers w/ profile"
          value={String(profiles?.length || 0)}
        />
      </div>

      {/* Current rules */}
      <div className="card mb-6 bg-slate-50 border-slate-200">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          Current rules
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <RuleRow label="Points per $1" value={String(settings.points_per_dollar)} />
          <RuleRow
            label="Redemption rate"
            value={`${settings.points_redemption_rate} pts = $1`}
          />
          <RuleRow
            label="Min to redeem"
            value={`${settings.min_redeem_points} pts`}
          />
          <RuleRow
            label="Referral commission"
            value={`${settings.referral_commission_pct}% of 1st booking`}
          />
          <RuleRow
            label="Payout threshold"
            value={`${formatCurrency(thresholdCents)} (alert admin)`}
          />
        </div>
      </div>

      {/* Customer list */}
      {(!profiles || profiles.length === 0) ? (
        <div className="card text-center text-slate-400 py-12">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>No customer profiles yet. Profiles are auto-created when a customer signs into the portal.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-right">Points</th>
                <th className="px-4 py-3 text-right">Pending</th>
                <th className="px-4 py-3 text-right">Paid out</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(profiles || []).map((p: any) => {
                const email = (emailMap.get(p.user_id) as string) || "(no email)";
                const isOverThreshold = p.commission_pending_cents >= thresholdCents;
                return (
                  <tr key={p.user_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{email}</div>
                      <div className="text-[10px] text-slate-400">
                        Joined {new Date(p.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{p.referral_code}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {(p.loyalty_points || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span
                        className={
                          isOverThreshold ? "text-amber-700 font-bold" : "text-slate-700"
                        }
                      >
                        {formatCurrency(p.commission_pending_cents || 0)}
                      </span>
                      {isOverThreshold && (
                        <div className="text-[10px] text-amber-700 inline-flex items-center gap-1 mt-0.5 justify-end">
                          <AlertTriangle className="h-3 w-3" />
                          payout!
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500">
                      {formatCurrency(p.commission_paid_cents || 0)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/loyalty/${p.user_id}`}
                        className="text-xs text-brand-navy hover:underline inline-flex items-center gap-1"
                      >
                        Open <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`card py-3 ${accent ? "bg-amber-50 border-amber-200" : ""}`}>
      <div className="flex items-center gap-2 text-xs text-slate-500 uppercase">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-2xl font-bold text-brand-navy mt-1">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function RuleRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-semibold text-brand-navy">{value}</div>
    </div>
  );
}
