import { redirect } from "next/navigation";
import Link from "next/link";
import { Megaphone, Plus, CheckCircle2, AlertTriangle, Eye } from "lucide-react";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/login");

  const supabase = createAdminClient();
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, subject, status, recipient_count, sent_count, failed_count, sent_at, created_at")
    .order("created_at", { ascending: false });
  const list = (campaigns as any[]) || [];

  return (
    <div className="max-w-4xl space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-fuchsia-600 via-violet-600 to-indigo-700 text-white p-6 shadow-xl">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-fuchsia-100 mb-2">
          <Megaphone className="h-3 w-3" /> Campaigns
        </div>
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Send targeted emails to your customers</h1>
            <p className="text-sm text-fuchsia-100 mt-1">
              Filter by tag, booking activity, or spend. Personalize with {`{firstName}`}. Sent via Resend.
            </p>
          </div>
          <Link
            href="/admin/campaigns/new"
            className="bg-white hover:bg-fuchsia-50 text-fuchsia-700 font-bold rounded-lg px-4 py-2 inline-flex items-center gap-1 shadow"
          >
            <Plus className="h-4 w-4" /> New campaign
          </Link>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card p-10 text-center text-slate-400">
          <Megaphone className="h-10 w-10 mx-auto mb-3 text-slate-300" />
          <p>No campaigns yet. Create your first one above.</p>
          <p className="text-xs mt-2">
            Common starting points: VIP customer announcement, promoter-only coupon drop, win-back inactive customers.
          </p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-right">Recipients</th>
                <th className="px-3 py-2 text-right">Sent</th>
                <th className="px-3 py-2 text-right">Failed</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Sent at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-semibold text-slate-800">{c.name}</td>
                  <td className="px-3 py-2 text-right font-mono">{c.recipient_count || 0}</td>
                  <td className="px-3 py-2 text-right font-mono text-emerald-700">{c.sent_count || 0}</td>
                  <td className={`px-3 py-2 text-right font-mono ${c.failed_count > 0 ? "text-rose-700" : "text-slate-400"}`}>
                    {c.failed_count || 0}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {c.sent_at ? new Date(c.sent_at).toLocaleString() : <span className="text-slate-400">—</span>}
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: any; label: string }> = {
    draft: { cls: "bg-slate-100 text-slate-700", icon: <Eye className="h-3 w-3" />, label: "Draft" },
    sending: { cls: "bg-blue-100 text-blue-800", icon: <Megaphone className="h-3 w-3" />, label: "Sending" },
    sent: { cls: "bg-emerald-100 text-emerald-800", icon: <CheckCircle2 className="h-3 w-3" />, label: "Sent" },
    failed: { cls: "bg-rose-100 text-rose-800", icon: <AlertTriangle className="h-3 w-3" />, label: "Failed" },
  };
  const v = map[status] || map.draft;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 ${v.cls}`}>
      {v.icon} {v.label}
    </span>
  );
}
