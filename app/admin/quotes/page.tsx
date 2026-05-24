import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { formatCurrency } from "@/lib/utils";
import { Plus, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-200 text-slate-700",
  sent: "bg-blue-100 text-blue-800",
  viewed: "bg-indigo-100 text-indigo-800",
  approved: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-800",
  expired: "bg-amber-100 text-amber-800",
  converted: "bg-purple-100 text-purple-800",
};

export default async function AdminQuotesPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/dashboard");

  const supabase = createAdminClient();
  let query = supabase
    .from("quotes")
    .select(
      "id, quote_number, customer_first_name, customer_last_name, customer_email, event_date, total_cents, status, sent_at, viewed_at, approved_at, created_at, expires_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (searchParams.status && searchParams.status !== "all") {
    query = query.eq("status", searchParams.status);
  }

  const { data: quotes } = await query;
  const list = quotes || [];

  // Summary counts (all-time)
  const { data: allQuotes } = await supabase
    .from("quotes")
    .select("status, total_cents");
  const stats = {
    draft: 0,
    sent: 0,
    approved: 0,
    converted_revenue: 0,
  };
  (allQuotes || []).forEach((q: any) => {
    if (q.status === "draft") stats.draft += 1;
    if (q.status === "sent" || q.status === "viewed") stats.sent += 1;
    if (q.status === "approved" || q.status === "converted") stats.approved += 1;
    if (q.status === "converted") stats.converted_revenue += q.total_cents || 0;
  });

  const currentStatus = searchParams.status || "all";

  return (
    <div className="max-w-6xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy mb-1">Quotes</h1>
          <p className="text-sm text-slate-500">
            Send customers a magic link they can approve to start a booking.
          </p>
        </div>
        <Link href="/admin/quotes/new" className="btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> New quote
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Drafts" value={String(stats.draft)} />
        <SummaryCard label="Sent / awaiting" value={String(stats.sent)} />
        <SummaryCard label="Approved" value={String(stats.approved)} />
        <SummaryCard label="Converted revenue" value={formatCurrency(stats.converted_revenue)} />
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-4 text-xs">
        {["all", "draft", "sent", "viewed", "approved", "converted", "declined", "expired"].map((s) => (
          <Link
            key={s}
            href={`/admin/quotes${s === "all" ? "" : `?status=${s}`}`}
            className={`px-3 py-1 rounded-full transition ${
              currentStatus === s
                ? "bg-brand-navy text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="card text-center text-slate-400 py-12">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>
            {currentStatus === "all"
              ? "No quotes yet. Create one to get started."
              : `No quotes with status "${currentStatus}".`}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Quote</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Event</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Sent</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((q: any) => (
                <tr key={q.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs">{q.quote_number}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {q.customer_first_name} {q.customer_last_name}
                    </div>
                    <div className="text-xs text-slate-500">{q.customer_email}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{q.event_date}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-brand-navy">
                    {formatCurrency(q.total_cents)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs rounded px-2 py-0.5 ${STATUS_STYLES[q.status] || ""}`}
                    >
                      {q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {q.sent_at ? new Date(q.sent_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/quotes/${q.id}`}
                      className="text-xs text-brand-navy hover:underline"
                    >
                      Open →
                    </Link>
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card py-3">
      <div className="text-xs text-slate-500 uppercase">{label}</div>
      <div className="text-2xl font-bold text-brand-navy">{value}</div>
    </div>
  );
}
