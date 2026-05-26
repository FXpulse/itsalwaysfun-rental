// Audit logging helper for server actions.
// Call logAuditEvent() at the end of destructive/sensitive operations to
// persist a record in admin_audit_log. Read history at /admin/audit-log.

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

interface AuditParams {
  userEmail: string;
  userRole?: string;
  action: string;                   // dotted lowercase: 'booking.refunded'
  entityType?: string;              // 'booking', 'gift_card', etc.
  entityId?: string | null;
  details?: Record<string, any>;    // arbitrary context — old/new values, amounts, reason
}

export async function logAuditEvent(params: AuditParams): Promise<void> {
  try {
    let ipAddress: string | null = null;
    let userAgent: string | null = null;
    try {
      const h = headers();
      ipAddress =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        h.get("x-real-ip") ||
        null;
      userAgent = h.get("user-agent") || null;
    } catch {
      // headers() throws when called outside a request context (e.g. cron) — fine
    }

    const supabase = createAdminClient();
    await supabase.from("admin_audit_log").insert({
      user_email: params.userEmail,
      user_role: params.userRole || null,
      action: params.action,
      entity_type: params.entityType || null,
      entity_id: params.entityId || null,
      details: params.details || null,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  } catch (e) {
    // Audit log failure should NEVER break the actual action — log + swallow
    console.error("[audit log insert failed]", e);
  }
}
