import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureCustomerProfile, getLoyaltySettings } from "@/lib/loyalty";
import { formatCurrency } from "@/lib/utils";
import { Sparkles, Award } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PortalPointsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  await ensureCustomerProfile(user.id);
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("customer_profiles")
    .select("loyalty_points")
    .eq("user_id", user.id)
    .single();

  const { data: tx } = await admin
    .from("loyalty_transactions")
    .select("type, points, description, created_at, booking_id")
    .eq("user_id", user.id)
    .in("type", ["booking_points", "points_redeemed", "admin_adjustment"])
    .order("created_at", { ascending: false })
    .limit(50);

  const settings = await getLoyaltySettings();
  const balance = profile?.loyalty_points || 0;
  const dollarsWorth = (balance / settings.points_redemption_rate).toFixed(2);
  const canRedeem = balance >= settings.min_redeem_points;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy mb-1">Loyalty points</h1>
        <p className="text-sm text-slate-500">
          Earn <strong>{settings.points_per_dollar} point per $1</strong> spent. Redeem
          {" "}<strong>{settings.points_redemption_rate} points = $1 off</strong> at checkout.
        </p>
      </div>

      {/* Big balance card */}
      <div className="card bg-gradient-to-br from-brand-navy to-brand-navy-dark text-white border-0">
        <div className="flex items-start gap-3">
          <Sparkles className="h-8 w-8 text-brand-yellow flex-shrink-0" />
          <div className="flex-1">
            <div className="text-xs text-white/70 uppercase tracking-widest">
              Your balance
            </div>
            <div className="text-4xl font-bold mt-1">{balance.toLocaleString()}</div>
            <div className="text-sm text-white/80 mt-1">
              ≈ <strong className="text-brand-yellow">${dollarsWorth}</strong> in discount
            </div>
            {canRedeem ? (
              <div className="text-xs text-brand-yellow mt-3">
                ✓ Ready to redeem! Use them at checkout.
              </div>
            ) : (
              <div className="text-xs text-white/60 mt-3">
                Need {settings.min_redeem_points - balance} more points to redeem (min{" "}
                {settings.min_redeem_points})
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">
          Points history
        </h2>
        {!tx || tx.length === 0 ? (
          <div className="card text-center text-slate-400 py-8">
            <Award className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No points history yet. Book your first rental to start earning!</p>
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tx.map((t: any, i: number) => (
                  <tr key={i}>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">{t.description || t.type}</td>
                    <td
                      className={`px-4 py-3 text-right font-mono font-semibold ${
                        t.points >= 0 ? "text-green-700" : "text-amber-700"
                      }`}
                    >
                      {t.points > 0 ? "+" : ""}
                      {t.points.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
