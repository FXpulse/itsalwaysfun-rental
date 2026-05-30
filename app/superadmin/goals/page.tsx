import { redirect } from "next/navigation";
import Link from "next/link";
import { Target, Sparkles, LayoutDashboard, Plus, CheckCircle2, Trash2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchActiveGoals, formatGoalLabel } from "@/lib/superadmin/goals";
import { GoalForm } from "./GoalForm";
import { deleteGoal } from "./actions";

export const dynamic = "force-dynamic";

export default async function SuperadminGoalsPage() {
  const authClient = createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) redirect("/superadmin/login");

  const supabase = createAdminClient({ unscoped: true });
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .eq("is_superadmin", true)
    .maybeSingle();
  if (!roleRow) redirect("/superadmin/login?error=not_superadmin");

  const goals = await fetchActiveGoals();

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white p-6 shadow-xl">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-amber-100 mb-2">
          <LayoutDashboard className="h-3 w-3" />
          <Link href="/superadmin/dashboard" className="hover:underline">Dashboard</Link>
          <span className="text-amber-200">›</span>
          <span>Goals</span>
        </div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Target className="h-7 w-7" /> Your goals
        </h1>
        <p className="text-sm text-amber-50 mt-1">
          Set targets, watch progress live, ship.
        </p>
      </div>

      <GoalForm />

      {/* Goals list */}
      {goals.length === 0 ? (
        <div className="card p-10 text-center text-slate-400">
          <Sparkles className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p>No active goals. Set your first one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((g) => {
            const cls = {
              ahead: "from-emerald-50 to-teal-50 ring-emerald-200",
              on_track: "from-blue-50 to-indigo-50 ring-blue-200",
              behind: "from-amber-50 to-orange-50 ring-amber-200",
              achieved: "from-emerald-100 to-emerald-200 ring-emerald-300",
              missed: "from-rose-50 to-pink-50 ring-rose-200",
            }[g.projected_status];
            const pctColor =
              g.projected_status === "achieved" ? "bg-emerald-500" :
              g.projected_status === "ahead" ? "bg-emerald-500" :
              g.projected_status === "on_track" ? "bg-blue-500" :
              g.projected_status === "behind" ? "bg-amber-500" :
              "bg-rose-500";

            return (
              <div
                key={g.id}
                className={`rounded-2xl ring-1 bg-gradient-to-br ${cls} p-5 shadow-sm`}
              >
                <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
                  <div>
                    <h3 className="font-bold text-slate-800">{formatGoalLabel(g)}</h3>
                    <div className="text-xs text-slate-600 mt-0.5">
                      {g.current_value.toLocaleString()} / {Number(g.target).toLocaleString()} ·{" "}
                      {g.days_remaining > 0 ? `${g.days_remaining}d remaining` : `${Math.abs(g.days_remaining)}d overdue`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={g.projected_status} />
                    <form action={async () => {
                      "use server";
                      await deleteGoal(g.id);
                    }}>
                      <button type="submit" className="text-slate-400 hover:text-rose-600" title="Delete goal">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </div>

                <div className="w-full bg-white/60 rounded-full h-3 overflow-hidden">
                  <div
                    className={`${pctColor} h-full transition-all`}
                    style={{ width: `${g.pct_complete}%` }}
                  />
                </div>
                <div className="text-right text-xs font-bold text-slate-700 mt-1">{g.pct_complete}%</div>

                {g.projected_hit_date && g.projected_status !== "achieved" && (
                  <div className="mt-3 text-xs text-slate-600">
                    Projected hit date:{" "}
                    <strong>{new Date(g.projected_hit_date).toLocaleDateString()}</strong>
                    {" "}— at current velocity
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "ahead" | "on_track" | "behind" | "achieved" | "missed" }) {
  const cfg = {
    achieved: { cls: "bg-emerald-600 text-white", label: "✅ Achieved", icon: <CheckCircle2 className="h-3 w-3" /> },
    ahead: { cls: "bg-emerald-100 text-emerald-800", label: "Ahead", icon: <ArrowUpRight className="h-3 w-3" /> },
    on_track: { cls: "bg-blue-100 text-blue-800", label: "On track", icon: <ArrowUpRight className="h-3 w-3" /> },
    behind: { cls: "bg-amber-100 text-amber-800", label: "Behind", icon: <ArrowDownRight className="h-3 w-3" /> },
    missed: { cls: "bg-rose-100 text-rose-800", label: "Missed", icon: <ArrowDownRight className="h-3 w-3" /> },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2 py-0.5 ${cfg.cls}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}
