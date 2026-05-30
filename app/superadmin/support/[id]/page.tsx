// Ticket detail — operator view with 1-click AI suggested response.

import { notFound, redirect } from "next/navigation";
import {
  Ticket, Bot, ChevronLeft, AlertTriangle, CheckCircle2, Clock, Sparkles,
} from "lucide-react";
import Link from "next/link";
import { getSuperadminUser } from "@/lib/auth/superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { Crumbs } from "../../Crumbs";
import { TicketActions } from "./TicketActions";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  const me = await getSuperadminUser();
  if (!me) redirect("/superadmin/login?error=not_superadmin");

  const supabase = createAdminClient({ unscoped: true });
  const { data: ticket } = await supabase
    .from("support_tickets").select("*").eq("id", params.id).maybeSingle();
  if (!ticket) notFound();

  const { data: replies } = await supabase
    .from("support_ticket_replies").select("*")
    .eq("ticket_id", params.id)
    .order("created_at", { ascending: true });

  let suggestedArticle: { title: string; slug: string } | null = null;
  if (ticket.ai_suggested_article_id) {
    const { data: art } = await supabase
      .from("kb_articles").select("title, slug")
      .eq("id", ticket.ai_suggested_article_id).maybeSingle();
    if (art) suggestedArticle = art as any;
  }

  const conf = ticket.ai_confidence || 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <Crumbs
        trail={[
          { label: "Support", href: "/superadmin/support" },
          { label: ticket.subject.slice(0, 50) },
        ]}
      />

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h1 className="text-2xl font-bold text-brand-navy">{ticket.subject}</h1>
            <p className="text-xs text-slate-500 mt-1">
              From <strong>{ticket.tenant_business_name || "(unknown)"}</strong>
              {ticket.tenant_owner_email && <span> · {ticket.tenant_owner_email}</span>}
              {" · "}
              {new Date(ticket.created_at).toLocaleString()}
            </p>
          </div>
          <StatusPill status={ticket.status} />
        </div>
        <div className="flex items-center gap-2 mb-4">
          {ticket.category && <Tag color="emerald">{ticket.category}</Tag>}
          <Tag color={priorityColor(ticket.priority)}>{ticket.priority.toUpperCase()}</Tag>
        </div>
        <article className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed bg-slate-50 rounded p-3 border border-slate-100">
          {ticket.body}
        </article>
      </div>

      {/* AI suggestion */}
      {ticket.ai_processed_at && ticket.ai_suggested_response ? (
        <div className="rounded-xl border border-indigo-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-50 via-violet-50 to-purple-50 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-indigo-900">
              <Bot className="h-4 w-4" /> AI suggested response
              <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-white border border-indigo-200">
                {Math.round(conf * 100)}% confidence
              </span>
            </div>
            {suggestedArticle && (
              <Link
                href={`/admin/support/kb/${suggestedArticle.slug}`}
                target="_blank"
                className="text-xs text-indigo-700 hover:underline inline-flex items-center gap-1"
              >
                <Sparkles className="h-3 w-3" /> Based on: {suggestedArticle.title}
              </Link>
            )}
          </div>
          <div className="bg-white p-5">
            <TicketActions
              ticketId={ticket.id}
              defaultResponse={ticket.ai_suggested_response}
              tenantEmail={ticket.tenant_owner_email}
              currentStatus={ticket.status}
            />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 inline-flex items-center gap-2">
          <Clock className="h-4 w-4 animate-pulse" /> AI is reviewing this ticket (usually 5-15 seconds)…
        </div>
      )}

      {/* Replies thread */}
      {replies && replies.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
            <h2 className="font-bold text-brand-navy">Replies ({replies.length})</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {(replies as any[]).map((r) => (
              <li key={r.id} className="p-4">
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                  <strong className="text-slate-700">{r.author_email}</strong>
                  <span className="text-[10px] font-bold uppercase rounded px-1.5 py-0.5 bg-slate-100">
                    {r.author_kind}
                  </span>
                  <span>· {new Date(r.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{r.body}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode }> = {
    open: { cls: "bg-violet-100 text-violet-800", icon: <Ticket className="h-3 w-3" /> },
    in_progress: { cls: "bg-blue-100 text-blue-800", icon: <Clock className="h-3 w-3" /> },
    waiting_on_tenant: { cls: "bg-amber-100 text-amber-900", icon: <Clock className="h-3 w-3" /> },
    resolved: { cls: "bg-emerald-100 text-emerald-800", icon: <CheckCircle2 className="h-3 w-3" /> },
    closed: { cls: "bg-slate-200 text-slate-600", icon: <CheckCircle2 className="h-3 w-3" /> },
  };
  const v = map[status] || map.open;
  return (
    <span className={`text-xs font-bold rounded-full px-2.5 py-1 inline-flex items-center gap-1 ${v.cls}`}>
      {v.icon} {status.replace(/_/g, " ")}
    </span>
  );
}

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  const map: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-800",
    blue: "bg-blue-100 text-blue-800",
    amber: "bg-amber-100 text-amber-900",
    rose: "bg-rose-100 text-rose-900 animate-pulse",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${map[color] || map.slate}`}>
      {children}
    </span>
  );
}

function priorityColor(p: string): string {
  if (p === "urgent") return "rose";
  if (p === "high") return "amber";
  if (p === "low") return "slate";
  return "blue";
}
