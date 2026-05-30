// Unified activity stream — pulls from multiple tables and merges by timestamp.

import { createAdminClient } from "@/lib/supabase/admin";

export type ActivityKind =
  | "signup"
  | "ticket_created"
  | "ticket_resolved"
  | "email_received"
  | "kb_view"
  | "payment_succeeded"
  | "payment_failed"
  | "subscription_canceled"
  | "lead_signup";

export interface ActivityEvent {
  kind: ActivityKind;
  ts: string;             // ISO
  title: string;
  subtitle?: string;
  tenant_id?: string;
  tenant_name?: string;
  href?: string;
}

export async function fetchActivityStream(limit = 60): Promise<ActivityEvent[]> {
  const supabase = createAdminClient({ unscoped: true });
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();

  const [signups, tickets, leads, emails] = await Promise.all([
    supabase.from("tenants")
      .select("id, business_name, created_at, owner_email")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("support_tickets")
      .select("id, subject, status, created_at, tenant_id, ai_priority")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase.from("lead_magnet_signups")
      .select("id, email, tool_key, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("email_threads")
      .select("id, subject, last_message_at, account_id")
      .gte("last_message_at", since)
      .order("last_message_at", { ascending: false })
      .limit(20),
  ]);

  // Map tenant IDs to names
  const tenantIds = Array.from(new Set([
    ...((tickets.data as any[]) || []).map((t) => t.tenant_id).filter(Boolean),
  ]));
  const tenantMap = new Map<string, string>();
  if (tenantIds.length > 0) {
    const { data: tList } = await supabase
      .from("tenants").select("id, business_name").in("id", tenantIds);
    for (const t of (tList as any[]) || []) tenantMap.set(t.id, t.business_name);
  }

  const events: ActivityEvent[] = [];

  for (const t of (signups.data as any[]) || []) {
    events.push({
      kind: "signup",
      ts: t.created_at,
      title: `New tenant: ${t.business_name}`,
      subtitle: t.owner_email,
      tenant_id: t.id,
      tenant_name: t.business_name,
      href: `/superadmin/tenants/${t.id}`,
    });
  }
  for (const t of (tickets.data as any[]) || []) {
    const isResolved = t.status === "resolved";
    events.push({
      kind: isResolved ? "ticket_resolved" : "ticket_created",
      ts: t.created_at,
      title: `${isResolved ? "Resolved" : "New"} ticket: ${t.subject}`,
      subtitle: t.ai_priority ? `Priority: ${t.ai_priority}` : undefined,
      tenant_id: t.tenant_id,
      tenant_name: tenantMap.get(t.tenant_id),
      href: `/superadmin/support/${t.id}`,
    });
  }
  for (const l of (leads.data as any[]) || []) {
    events.push({
      kind: "lead_signup",
      ts: l.created_at,
      title: `Lead magnet: ${l.email}`,
      subtitle: `Tool: ${l.tool_key}`,
    });
  }
  for (const e of (emails.data as any[]) || []) {
    if (!e.last_message_at) continue;
    events.push({
      kind: "email_received",
      ts: e.last_message_at,
      title: `Email: ${e.subject || "(no subject)"}`,
      href: `/superadmin/email/${e.id}`,
    });
  }

  return events
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, limit);
}
