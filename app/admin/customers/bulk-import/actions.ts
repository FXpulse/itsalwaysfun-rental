"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureCustomerProfile } from "@/lib/loyalty";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { getTenantBusinessName } from "@/lib/tenant/business";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export interface BulkRow {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
}

export interface BulkResult {
  created: number;
  existed: number;
  invited: number;
  failed: number;
  errors: Array<{ row: number; email: string; reason: string }>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function bulkImportCustomers(
  rows: BulkRow[],
  sendInvites: boolean,
): Promise<{ ok: true; result: BulkResult } | { error: string }> {
  await requireAdmin();

  if (rows.length === 0) return { error: "No rows to import" };
  if (rows.length > 500) return { error: "Maximum 500 rows per import — split your file" };

  const supabase = createAdminClient({ unscoped: true });

  // Pre-fetch all auth users once (1 paginated call instead of N) — only matters
  // for medium files; for large ones we'd page properly.
  const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 5000 });
  const emailToUser = new Map<string, string>();
  for (const u of usersData?.users || []) {
    if (u.email) emailToUser.set(u.email.toLowerCase(), u.id);
  }

  let businessName = "us";
  try { businessName = await getTenantBusinessName(); } catch {}
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://itsalwaysfun.net";

  const result: BulkResult = {
    created: 0, existed: 0, invited: 0, failed: 0, errors: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 1;
    const email = (r.email || "").toLowerCase().trim();

    if (!EMAIL_RE.test(email)) {
      result.failed++;
      result.errors.push({ row: rowNum, email: r.email || "(empty)", reason: "invalid email" });
      continue;
    }

    let user_id = emailToUser.get(email) || null;
    let isNew = false;

    if (!user_id) {
      // Create the auth user
      const { data: created, error } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          first_name: r.first_name?.trim() || null,
          last_name: r.last_name?.trim() || null,
          phone: r.phone?.trim() || null,
          created_by: "admin_bulk_import",
        },
      });
      if (error || !created.user) {
        result.failed++;
        result.errors.push({ row: rowNum, email, reason: error?.message || "create_failed" });
        continue;
      }
      user_id = created.user.id;
      emailToUser.set(email, user_id);
      isNew = true;
      result.created++;
    } else {
      // Patch metadata if we have new info
      const updates: Record<string, any> = {};
      if (r.first_name?.trim()) updates.first_name = r.first_name.trim();
      if (r.last_name?.trim()) updates.last_name = r.last_name.trim();
      if (r.phone?.trim()) updates.phone = r.phone.trim();
      if (Object.keys(updates).length > 0) {
        await supabase.auth.admin.updateUserById(user_id, { user_metadata: updates });
      }
      result.existed++;
    }

    // Ensure customer_profile
    await ensureCustomerProfile(user_id);

    // Send invite for NEW users only (not existing ones — they already have access)
    if (isNew && sendInvites && isEmailConfigured()) {
      try {
        const { data: linkData } = await supabase.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: { redirectTo: `${baseUrl}/portal` },
        });
        const magicUrl = linkData?.properties?.action_link;
        if (magicUrl) {
          const firstName = r.first_name?.trim() || email.split("@")[0];
          const sendResult = await sendEmail({
            to: email,
            subject: `Welcome to ${businessName} — your portal is ready`,
            html: inviteHtml(firstName, businessName, magicUrl),
            text: `Hi ${firstName},\n\nWe've created an account for you at ${businessName}. Open your portal (link expires in 1 hour):\n\n${magicUrl}\n\n— ${businessName}`,
            tags: [{ name: "type", value: "customer_invite_bulk" }],
          });
          if (sendResult.ok) result.invited++;
        }
      } catch (e) {
        // Don't fail the whole row over an email — they're created successfully
        console.error("[bulk invite email failed]", e);
      }
    }
  }

  revalidatePath("/admin/customers");
  return { ok: true, result };
}

function inviteHtml(firstName: string, businessName: string, magicUrl: string): string {
  return `<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#0f172a;max-width:600px;margin:0 auto;padding:24px">
  <div style="background:linear-gradient(135deg,#1e1b4b,#312e81);padding:20px;border-radius:16px;margin-bottom:20px;text-align:center;color:white">
    <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700">${businessName}</div>
    <div style="font-size:22px;font-weight:800;margin-top:6px">Welcome 👋</div>
  </div>
  <p style="font-size:15px;line-height:1.55">Hi ${firstName},</p>
  <p style="font-size:15px;line-height:1.6">
    We've created an account for you at ${businessName}. Click below to sign in to your customer portal — no password needed.
  </p>
  <div style="text-align:center;margin:24px 0">
    <a href="${magicUrl}" style="display:inline-block;background:#1e1b4b;color:white;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:8px">
      Open my portal →
    </a>
  </div>
  <p style="font-size:13px;color:#64748b;line-height:1.5">
    Once inside, you can view your bookings, track loyalty points, and see your referral link.
  </p>
  <div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:24px;font-size:12px;color:#64748b">
    This link expires in 1 hour for security.<br>
    — ${businessName}
  </div>
</body></html>`;
}
