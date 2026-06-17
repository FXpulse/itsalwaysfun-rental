"use server";

// Beta feedback submission. Called from the floating widget in admin.
// The user is authenticated (admin or staff role). Tenant must be in the
// beta program. Submission writes a row to beta_feedback and emails
// Ludmila so she sees it in the day, not when she checks the dashboard.

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant/server";
import { isEmailConfigured } from "@/lib/email/send";
import { getSaasOwnerInbox } from "@/lib/email/saas-owner";
import { sendFromSaasOwner } from "@/lib/email/saas-owner-send";

const InputSchema = z.object({
  category: z.enum(["bug", "feature", "ux", "other"]),
  body: z.string().trim().min(5).max(4000),
  page_path: z.string().max(500).optional(),
});

export async function submitBetaFeedback(input: unknown) {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const userClient = createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return { error: "unauthorized" };

  const tenantId = getCurrentTenantId();
  if (!tenantId || tenantId === "__marketing__") {
    return { error: "no_tenant" };
  }

  const admin = createAdminClient({ unscoped: true });

  // Verify tenant is in the beta program — front-end already hides the
  // widget for non-beta tenants, but server-side double-check.
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, business_name, beta_program, owner_email")
    .eq("id", tenantId)
    .single();
  if (!tenant || !(tenant as any).beta_program) {
    return { error: "not_in_beta_program" };
  }

  // Insert
  const { data: row, error } = await admin
    .from("beta_feedback")
    .insert({
      tenant_id: tenantId,
      submitted_by_user_id: user.id,
      submitted_by_email: user.email,
      category: parsed.data.category,
      page_path: parsed.data.page_path || null,
      body: parsed.data.body,
    })
    .select("id")
    .single();
  if (error || !row) return { error: error?.message || "Insert failed" };

  // Email Ludmila — non-fatal
  if (isEmailConfigured()) {
    try {
      const businessName = (tenant as any).business_name || "(unnamed tenant)";
      const ownerEmail = (tenant as any).owner_email || "(unknown)";
      const categoryEmoji =
        parsed.data.category === "bug"
          ? "🐛"
          : parsed.data.category === "feature"
          ? "💡"
          : parsed.data.category === "ux"
          ? "🎨"
          : "💬";
      await sendFromSaasOwner({
        to: getSaasOwnerInbox(),
        subject: `${categoryEmoji} Beta feedback from ${businessName} — ${parsed.data.category}`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#0f172a;line-height:1.55">
<p style="background:#fff8e1;border-left:4px solid #f59e0b;padding:10px 14px;border-radius:4px;margin:0 0 14px">
  <strong>${categoryEmoji} ${parsed.data.category.toUpperCase()}</strong> from beta tester
</p>
<table style="border-collapse:collapse;font-size:13px;margin-bottom:14px">
  <tr><td style="padding:4px 10px 4px 0;color:#64748b">Tenant:</td><td><strong>${businessName}</strong> (${ownerEmail})</td></tr>
  <tr><td style="padding:4px 10px 4px 0;color:#64748b">From user:</td><td>${user.email}</td></tr>
  ${parsed.data.page_path ? `<tr><td style="padding:4px 10px 4px 0;color:#64748b">On page:</td><td><code>${parsed.data.page_path}</code></td></tr>` : ""}
  <tr><td style="padding:4px 10px 4px 0;color:#64748b">Feedback ID:</td><td><code>${row.id}</code></td></tr>
</table>
<p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;font-weight:bold">What they wrote</p>
<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:14px;white-space:pre-wrap">${escapeHtml(parsed.data.body)}</div>
<p style="margin-top:18px">
  <a href="https://getrentalflow.com/superadmin/beta-program/feedback" style="background:#1a1a6e;color:white;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:bold">Open feedback inbox</a>
</p>
</div>`,
        text: `${categoryEmoji} ${parsed.data.category.toUpperCase()} from ${businessName} (${ownerEmail})
From user: ${user.email}
${parsed.data.page_path ? `On page: ${parsed.data.page_path}\n` : ""}Feedback ID: ${row.id}

What they wrote:
${parsed.data.body}

Open: https://getrentalflow.com/superadmin/beta-program/feedback`,
        tags: [
          { name: "type", value: "beta_feedback" },
          { name: "category", value: parsed.data.category },
        ],
      });
    } catch (e) {
      // log but don't fail the operator — their row is already in DB
      console.error("[beta-feedback email failed, non-fatal]", e);
    }
  }

  return { ok: true, id: row.id };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
