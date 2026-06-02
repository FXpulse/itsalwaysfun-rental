import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { getTenantInfo } from "@/lib/tenant/business";
import { formatDateTimeInTz } from "@/lib/tenant/timezone";
import { History, Filter } from "lucide-react";

export const dynamic = "force-dynamic";

const ACTION_STYLES: Record<string, string> = {
  refund: "bg-red-100 text-red-800",
  delete: "bg-red-100 text-red-800",
  deactivate: "bg-amber-100 text-amber-800",
  approve: "bg-green-100 text-green-800",
  cancel: "bg-slate-200 text-slate-700",
  create: "bg-blue-100 text-blue-800",
  update: "bg-slate-100 text-slate-700",
};

function pillStyle(action: string): string {
  for (const key of Object.keys(ACTION_STYLES)) {
    if (action.includes(key)) return ACTION_STYLES[key];
  }
  return "bg-slate-100 text-slate-700";
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: { user?: string; entity?: string; action?: string };
}) {
  const me = await getCurrentUserRole();
  if (!me) redirect("/admin/login");

  const supabase = createAdminClient();
  const tenant = await getTenantInfo();
  const tz = tenant.timezone;
  let query = supabase
    .from("admin_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (searchParams.user) query = query.ilike("user_email", `%${searchParams.user}%`);
  if (searchParams.entity) query = query.eq("entity_type", searchParams.entity);
  if (searchParams.action) query = query.ilike("action", `%${searchParams.action}%`);

  const { data: rows } = await query;
  const list = (rows as any[]) || [];

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1 flex items-center gap-2">
        <History className="h-6 w-6" /> Audit Log
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Every destructive or sensitive admin action — refunds, deletes, payouts,
        gift card deactivations, etc. Staff only see their own actions; admins
        see everyone. Records last 500 events.
      </p>

      <form className="card mb-4 flex flex-wrap items-end gap-3" method="get">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-slate-600 mb-1">User email</label>
          <input
            name="user"
            defaultValue={searchParams.user || ""}
            placeholder="user@example.com"
            className="input"
          />
        </div>
        <div className="w-40">
          <label className="block text-xs text-slate-600 mb-1">Entity</label>
          <select name="entity" defaultValue={searchParams.entity || ""} className="input">
            <option value="">All</option>
            <option value="booking">Booking</option>
            <option value="gift_card">Gift card</option>
            <option value="payout_request">Payout request</option>
            <option value="coupon">Coupon</option>
            <option value="product">Product</option>
            <option value="package">Package</option>
            <option value="contact_message">Contact message</option>
            <option value="coi_request">COI request</option>
          </select>
        </div>
        <div className="w-40">
          <label className="block text-xs text-slate-600 mb-1">Action contains</label>
          <input
            name="action"
            defaultValue={searchParams.action || ""}
            placeholder="refund"
            className="input"
          />
        </div>
        <button type="submit" className="btn-primary inline-flex items-center gap-1">
          <Filter className="h-3 w-3" /> Filter
        </button>
        {(searchParams.user || searchParams.entity || searchParams.action) && (
          <a href="/admin/audit-log" className="text-xs text-slate-500 hover:text-brand-navy">
            Clear
          </a>
        )}
      </form>

      {list.length === 0 ? (
        <div className="card text-center text-slate-400 py-12">
          <History className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p>No audit events match the filters.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left">When</th>
                <th className="px-4 py-2 text-left">Who</th>
                <th className="px-4 py-2 text-left">Action</th>
                <th className="px-4 py-2 text-left">Entity</th>
                <th className="px-4 py-2 text-left">Details</th>
                <th className="px-4 py-2 text-left">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">
                    {formatDateTimeInTz(r.created_at, tz)}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <div className="font-medium text-brand-navy">{r.user_email}</div>
                    {r.user_role && (
                      <div className="text-[10px] text-slate-400">{r.user_role}</div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs font-mono rounded px-2 py-0.5 ${pillStyle(r.action)}`}
                    >
                      {r.action}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {r.entity_type && (
                      <div>
                        <div className="font-medium">{r.entity_type}</div>
                        {r.entity_id && (
                          <code className="text-[10px] text-slate-400">{r.entity_id.substring(0, 8)}</code>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs max-w-[280px]">
                    {r.details && Object.keys(r.details).length > 0 ? (
                      <details>
                        <summary className="cursor-pointer text-slate-600 hover:text-brand-navy">
                          View JSON
                        </summary>
                        <pre className="mt-1 bg-slate-50 p-2 rounded text-[10px] overflow-x-auto">
                          {JSON.stringify(r.details, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-[10px] text-slate-400 font-mono">
                    {r.ip_address || "—"}
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
