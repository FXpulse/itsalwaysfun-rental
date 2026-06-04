import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { getTenantInfo } from "@/lib/tenant/business";
import { getCurrentTenantId } from "@/lib/tenant/db";
import { Inbox } from "lucide-react";
import { InboxClient } from "./InboxClient";

export const dynamic = "force-dynamic";

export interface ReplyRow {
  id: string;
  body: string;
  sent_by: string;
  send_error: string | null;
  sent_at: string;
}

export interface ContactMessage {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  source: string;
  emailed_to_admin_at: string | null;
  email_send_error: string | null;
  ghl_webhook_fired_at: string | null;
  ghl_webhook_error: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  admin_notes: string | null;
  created_at: string;
  replies: ReplyRow[];
}

export default async function AdminInboxPage() {
  const me = await getCurrentUserRole();
  if (!me) redirect("/admin/login");

  const supabase = createAdminClient();
  // Tenants without the in-app inbox (default for new SaaS tenants) get
  // customer replies forwarded directly to their notification_email; we
  // bounce them back to the dashboard if they navigate to /admin/inbox
  // directly.
  const tenantId = getCurrentTenantId();
  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("inbox_enabled")
    .eq("id", tenantId)
    .maybeSingle();
  if (!(tenantRow as any)?.inbox_enabled) {
    redirect("/admin/dashboard");
  }

  const tenant = await getTenantInfo();
  const tz = tenant.timezone;
  const { data: messages } = await supabase
    .from("contact_messages")
    .select(`*, replies:contact_message_replies(id, body, sent_by, send_error, sent_at)`)
    .order("is_resolved", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(500);

  // Sort replies oldest-first within each message
  const list: ContactMessage[] = ((messages as any[]) || []).map((m) => ({
    ...m,
    replies: ((m.replies as ReplyRow[]) || []).sort(
      (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime(),
    ),
  }));
  const unresolvedCount = list.filter((m) => !m.is_resolved).length;
  const deliveryIssues = list.filter(
    (m) => !m.is_resolved && (m.ghl_webhook_error || !m.emailed_to_admin_at),
  ).length;

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1 flex items-center gap-2">
        <Inbox className="h-6 w-6" /> Contact Inbox
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Every submission from the public Contact Us form. Messages are also
        emailed to you instantly and pushed to GHL — this is your safety net.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="Open" value={String(unresolvedCount)} accent={unresolvedCount > 0} />
        <Stat label="Delivery issues" value={String(deliveryIssues)} accent={deliveryIssues > 0} />
        <Stat label="Total" value={String(list.length)} />
      </div>

      <InboxClient messages={list} isAdmin={me.role === "admin"} tz={tz} />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`card py-3 ${accent ? "bg-amber-50 border-amber-200" : ""}`}>
      <div className="text-xs text-slate-500 uppercase">{label}</div>
      <div className="text-xl font-bold text-brand-navy mt-1">{value}</div>
    </div>
  );
}
