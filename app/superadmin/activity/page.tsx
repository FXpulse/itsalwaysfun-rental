import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  UserPlus,
  Ticket,
  CheckCircle2,
  Mail,
  BookOpen,
  CreditCard,
  XCircle,
  Sparkles,
  LayoutDashboard,
  Download,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchActivityStream, type ActivityEvent } from "@/lib/superadmin/activity-stream";

export const dynamic = "force-dynamic";

export default async function SuperadminActivityPage() {
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

  const events = await fetchActivityStream(80);

  // Group by day
  const byDay = new Map<string, ActivityEvent[]>();
  for (const e of events) {
    const day = e.ts.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(e);
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-fuchsia-600 via-purple-600 to-violet-700 text-white p-6 shadow-xl">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-violet-100 mb-2">
          <LayoutDashboard className="h-3 w-3" />
          <Link href="/superadmin/dashboard" className="hover:underline">Dashboard</Link>
          <span className="text-violet-300">›</span>
          <span>Activity</span>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Activity className="h-7 w-7" /> Activity Stream
            </h1>
            <p className="text-sm text-violet-100 mt-1">
              Live feed across the entire platform — {events.length} events in last 14 days.
            </p>
          </div>
          <a
            href="/api/superadmin/activity/export"
            className="bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-lg px-3 py-2 inline-flex items-center gap-1.5 transition backdrop-blur"
          >
            <Download className="h-4 w-4" /> Export CSV
          </a>
        </div>
      </div>

      {/* Timeline grouped by day */}
      <div className="space-y-4">
        {Array.from(byDay.entries()).map(([day, dayEvents]) => (
          <div key={day}>
            <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-2 pl-2">
              {formatDay(day)} · <span className="text-slate-400 font-normal">{dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="card divide-y divide-slate-100">
              {dayEvents.map((e, i) => (
                <EventRow key={`${day}-${i}`} event={e} />
              ))}
            </div>
          </div>
        ))}
        {events.length === 0 && (
          <div className="card p-10 text-center text-slate-400">
            <Sparkles className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p>No activity yet. The first signup will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDay(day: string): string {
  const d = new Date(day);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function EventRow({ event }: { event: ActivityEvent }) {
  const cfg = iconForKind(event.kind);
  const time = new Date(event.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const inner = (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition">
      <div className={`flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center ${cfg.bg}`}>
        {cfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-800 truncate">{event.title}</div>
        {event.subtitle && <div className="text-xs text-slate-500 truncate">{event.subtitle}</div>}
        {event.tenant_name && (
          <div className="text-xs text-slate-400 mt-0.5">
            <span className="inline-block bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">{event.tenant_name}</span>
          </div>
        )}
      </div>
      <span className="text-xs text-slate-400 font-mono whitespace-nowrap">{time}</span>
    </div>
  );
  if (event.href) {
    return <Link href={event.href}>{inner}</Link>;
  }
  return inner;
}

function iconForKind(kind: ActivityEvent["kind"]) {
  const map = {
    signup: { icon: <UserPlus className="h-4 w-4 text-emerald-700" />, bg: "bg-emerald-100" },
    ticket_created: { icon: <Ticket className="h-4 w-4 text-amber-700" />, bg: "bg-amber-100" },
    ticket_resolved: { icon: <CheckCircle2 className="h-4 w-4 text-emerald-700" />, bg: "bg-emerald-100" },
    email_received: { icon: <Mail className="h-4 w-4 text-indigo-700" />, bg: "bg-indigo-100" },
    kb_view: { icon: <BookOpen className="h-4 w-4 text-violet-700" />, bg: "bg-violet-100" },
    payment_succeeded: { icon: <CreditCard className="h-4 w-4 text-emerald-700" />, bg: "bg-emerald-100" },
    payment_failed: { icon: <CreditCard className="h-4 w-4 text-rose-700" />, bg: "bg-rose-100" },
    subscription_canceled: { icon: <XCircle className="h-4 w-4 text-rose-700" />, bg: "bg-rose-100" },
    lead_signup: { icon: <Sparkles className="h-4 w-4 text-fuchsia-700" />, bg: "bg-fuchsia-100" },
  };
  return map[kind] || { icon: <Activity className="h-4 w-4 text-slate-700" />, bg: "bg-slate-100" };
}
