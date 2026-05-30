// /superadmin/support — unified ticket inbox across all tenants.
// AI triage results visible per row. Operator can: assign, change status,
// reply, send AI-drafted response as-is or edited.

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Ticket, AlertTriangle, CheckCircle2, Clock, Sparkles, Bot,
  Filter, ChevronRight,
} from "lucide-react";
import { getSuperadminUser } from "@/lib/auth/superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { Crumbs } from "../Crumbs";

export const dynamic = "force-dynamic";
export const revalidate = 30;

interface SupportTicket {
  id: string;
  tenant_business_name: string | null;
  tenant_owner_email: string | null;
  subject: string;
  body: string;
  category: string | null;
  priority: string;
  status: string;
  ai_category: string | null;
  ai_priority: string | null;
  ai_suggested_response: string | null;
  ai_confidence: number | null;
  ai_processed_at: string | null;
  created_at: string;
  resolved_at: string | null;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export default async function SupportPage({
  searchParams,
}: { searchParams: { status?: string; priority?: string; category?: string } }) {
  const me = await getSuperadminUser();
  if (!me) redirect("/superadmin/login?error=not_superadmin");

  const supabase = createAdminClient({ unscoped: true });

  let query = supabase.from("support_tickets").select("*").order("created_at", { ascending: false });
  const status = searchParams.status || "open";
  if (status !== "all") query = query.eq("status", status);
  if (searchParams.priority) query = query.eq("priority", searchParams.priority);
  if (searchParams.category) query = query.eq("category", searchParams.category);

  const { data: tickets } = await query;
  const list = (tickets as SupportTicket[]) || [];

  // Stats for the header
  const { data: allTickets } = await supabase
    .from("support_tickets").select("status, priority, ai_confidence");
  const all = (allTickets as Array<{ status: string; priority: string; ai_confidence: number | null }>) || [];
  const counts = {
    open: all.filter((t) => t.status === "open").length,
    in_progress: all.filter((t) => t.status === "in_progress").length,
    waiting_on_tenant: all.filter((t) => t.status === "waiting_on_tenant").length,
    resolved: all.filter((t) => t.status === "resolved").length,
    urgent: all.filter((t) => t.priority === "urgent" && t.status !== "resolved" && t.status !== "closed").length,
    ai_high_confidence: all.filter((t) => (t.ai_confidence || 0) >= 0.8 && t.status === "open").length,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <Crumbs trail={[{ label: "Support" }]} />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-brand-navy flex items-center gap-2">
            <Ticket className="h-7 w-7 text-violet-500" /> Support tickets
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            AI triage runs automatically. High-confidence suggestions can be sent with 1 click.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatTile label="Open" value={counts.open} color="violet" icon={<Ticket className="h-4 w-4" />} />
        <StatTile label="In progress" value={counts.in_progress} color="blue" icon={<Clock className="h-4 w-4" />} />
        <StatTile label="Waiting on tenant" value={counts.waiting_on_tenant} color="amber" icon={<Clock className="h-4 w-4" />} />
        <StatTile label="Resolved" value={counts.resolved} color="emerald" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatTile label="🔥 Urgent open" value={counts.urgent} color="rose" icon={<AlertTriangle className="h-4 w-4" />} />
        <StatTile label="AI ready to send" value={counts.ai_high_confidence} color="indigo" icon={<Bot className="h-4 w-4" />} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap text-sm bg-white rounded-lg shadow-sm border border-slate-200 p-3">
        <Filter className="h-4 w-4 text-slate-400" />
        <span className="text-xs uppercase tracking-wider text-slate-500">Filter:</span>
        {(["open", "in_progress", "waiting_on_tenant", "resolved", "all"] as const).map((s) => (
          <Link
            key={s}
            href={`/superadmin/support?status=${s}`}
            className={`px-2 py-1 rounded text-xs font-semibold transition ${
              status === s ? "bg-brand-navy text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s.replace(/_/g, " ")}
          </Link>
        ))}
        <span className="mx-2 text-slate-300">|</span>
        <Link
          href="/superadmin/kb"
          className="text-xs text-violet-700 hover:underline inline-flex items-center gap-1"
        >
          <Sparkles className="h-3 w-3" /> Knowledge base
        </Link>
      </div>

      {/* Tickets */}
      <div className="space-y-3">
        {list.length === 0 ? (
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-10 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-emerald-900">¡Inbox limpio!</h2>
            <p className="text-sm text-emerald-700 mt-1">
              {status === "open" ? "Cero tickets abiertos. Volvé después." : `No hay tickets en estado "${status.replace(/_/g, " ")}".`}
            </p>
          </div>
        ) : list.map((t) => <TicketCard key={t.id} ticket={t} />)}
      </div>
    </div>
  );
}

function StatTile({
  label, value, icon, color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "violet" | "blue" | "amber" | "emerald" | "rose" | "indigo";
}) {
  const map = {
    violet: "bg-violet-50 border-violet-200 text-violet-900",
    blue: "bg-blue-50 border-blue-200 text-blue-900",
    amber: "bg-amber-50 border-amber-200 text-amber-900",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-900",
    rose: "bg-rose-50 border-rose-200 text-rose-900",
    indigo: "bg-indigo-50 border-indigo-200 text-indigo-900",
  };
  return (
    <div className={`rounded-xl border ${map[color]} p-3 shadow-sm`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-80">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    low: "bg-slate-100 text-slate-600",
    normal: "bg-blue-100 text-blue-800",
    high: "bg-amber-100 text-amber-900",
    urgent: "bg-rose-100 text-rose-900 animate-pulse",
  };
  return (
    <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${map[priority] || map.normal}`}>
      {priority.toUpperCase()}
    </span>
  );
}

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  const map: Record<string, string> = {
    billing: "bg-emerald-100 text-emerald-800",
    "how-to": "bg-blue-100 text-blue-800",
    bug: "bg-rose-100 text-rose-900",
    cancel: "bg-amber-100 text-amber-900",
    other: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${map[category] || map.other}`}>
      {category}
    </span>
  );
}

function TicketCard({ ticket }: { ticket: SupportTicket }) {
  const aiConfidence = ticket.ai_confidence || 0;
  const aiHigh = aiConfidence >= 0.8;
  const aiMid = aiConfidence >= 0.5 && aiConfidence < 0.8;

  return (
    <Link
      href={`/superadmin/support/${ticket.id}`}
      className="block bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-violet-300 transition overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <PriorityBadge priority={ticket.priority} />
              <CategoryBadge category={ticket.category} />
              {ticket.ai_processed_at && aiHigh && (
                <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-indigo-100 text-indigo-900 inline-flex items-center gap-0.5">
                  <Bot className="h-2.5 w-2.5" /> AI ready ({Math.round(aiConfidence * 100)}%)
                </span>
              )}
              {ticket.ai_processed_at && aiMid && (
                <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-blue-50 text-blue-700 inline-flex items-center gap-0.5">
                  <Bot className="h-2.5 w-2.5" /> AI draft ({Math.round(aiConfidence * 100)}%)
                </span>
              )}
              {!ticket.ai_processed_at && (
                <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-slate-100 text-slate-500 inline-flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" /> Triaging…
                </span>
              )}
            </div>
            <h3 className="font-bold text-brand-navy truncate">{ticket.subject}</h3>
            <p className="text-sm text-slate-600 line-clamp-2 mt-0.5">{ticket.body}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-slate-400">{timeAgo(ticket.created_at)}</div>
            <ChevronRight className="h-4 w-4 text-slate-300 mt-1 ml-auto" />
          </div>
        </div>
        <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">
          <strong>{ticket.tenant_business_name || "(unknown tenant)"}</strong>
          {ticket.tenant_owner_email && (
            <span className="ml-1 text-slate-400">· {ticket.tenant_owner_email}</span>
          )}
        </div>

        {/* AI suggestion preview */}
        {ticket.ai_suggested_response && (
          <div className="mt-3 bg-indigo-50 border-l-4 border-indigo-300 rounded-r p-3 text-xs text-indigo-900">
            <div className="font-bold uppercase tracking-wider text-[10px] text-indigo-700 mb-1 flex items-center gap-1">
              <Bot className="h-3 w-3" /> AI suggestion
            </div>
            <p className="line-clamp-2">{ticket.ai_suggested_response}</p>
          </div>
        )}
      </div>
    </Link>
  );
}
