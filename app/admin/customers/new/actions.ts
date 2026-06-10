"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureCustomerProfile } from "@/lib/loyalty";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { getTenantEmailConfig } from "@/lib/email/tenant-email";
import { getTenantBusinessName } from "@/lib/tenant/business";
import { getCurrentTenantId } from "@/lib/tenant/db";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

interface CreateInput {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  send_invite: boolean;
}

export async function createCustomerManually(input: CreateInput): Promise<
  { ok: true; user_id: string; existed: boolean; invited: boolean }
  | { error: string }
> {
  await requireAdmin();

  const email = (input.email || "").toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Invalid email" };
  }

  const supabase = createAdminClient({ unscoped: true });

  // 1. Check if a user with this email already exists in auth.users
  let user_id: string | null = null;
  let existed = false;
  {
    const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const found = (users?.users || []).find(
      (u) => (u.email || "").toLowerCase() === email,
    );
    if (found) {
      user_id = found.id;
      existed = true;
    }
  }

  // 2. If not, create them
  if (!user_id) {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        first_name: input.first_name?.trim() || null,
        last_name: input.last_name?.trim() || null,
        phone: input.phone?.trim() || null,
        created_by: "admin_manual",
      },
    });
    if (error || !created.user) {
      return { error: error?.message || "Could not create user" };
    }
    user_id = created.user.id;
  } else {
    // Patch metadata if we have new info
    const updates: Record<string, any> = {};
    if (input.first_name?.trim()) updates.first_name = input.first_name.trim();
    if (input.last_name?.trim()) updates.last_name = input.last_name.trim();
    if (input.phone?.trim()) updates.phone = input.phone.trim();
    if (Object.keys(updates).length > 0) {
      await supabase.auth.admin.updateUserById(user_id, { user_metadata: updates });
    }
  }

  // 3. Ensure customer_profile (RPC creates one with a generated referral_code)
  await ensureCustomerProfile(user_id, getCurrentTenantId());

  // 4. Optional: send a magic-link invite email
  let invited = false;
  if (input.send_invite && isEmailConfigured()) {
    try {
      // Generate magic link
      const { data: linkData } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "https://itsalwaysfun.com"}/portal`,
        },
      });
      const magicUrl = linkData?.properties?.action_link;
      if (magicUrl) {
        let businessName = "us";
        try { businessName = await getTenantBusinessName(); } catch {}
        const firstName = input.first_name?.trim() || email.split("@")[0];

        const html = `<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#0f172a;max-width:600px;margin:0 auto;padding:24px">
  <div style="background:linear-gradient(135deg,#1e1b4b,#312e81);padding:20px;border-radius:16px;margin-bottom:20px;text-align:center;color:white">
    <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700">${businessName}</div>
    <div style="font-size:22px;font-weight:800;margin-top:6px">Welcome 👋</div>
  </div>
  <p style="font-size:15px;line-height:1.55">Hi ${firstName},</p>
  <p style="font-size:15px;line-height:1.6">
    We've created an account for you at ${businessName}. Click the button below to sign in to your customer portal — no password needed.
  </p>
  <div style="text-align:center;margin:24px 0">
    <a href="${magicUrl}" style="display:inline-block;background:#1e1b4b;color:white;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:8px">
      Open my portal →
    </a>
  </div>
  <p style="font-size:13px;color:#64748b;line-height:1.5">
    Once inside, you can view your bookings, track loyalty points, see your referral link, and manage payouts.
  </p>
  <div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:24px;font-size:12px;color:#64748b">
    This link expires in 1 hour for security.<br>
    — ${businessName}
  </div>
</body></html>`;
        const text = `Hi ${firstName},

We've created an account for you at ${businessName}. Open your portal here (link expires in 1 hour):

${magicUrl}

— ${businessName}`;
        const tenantEmail = await getTenantEmailConfig(getCurrentTenantId());
        const result = await sendEmail({
          to: email,
          from: tenantEmail.from,
          replyTo: tenantEmail.replyTo,
          subject: `Welcome to ${businessName} — your portal is ready`,
          html, text,
          tags: [{ name: "type", value: "customer_invite" }],
        });
        invited = result.ok;
      }
    } catch (e) {
      console.error("[customer-invite email failed]", e);
    }
  }

  revalidatePath("/admin/customers");
  return { ok: true, user_id, existed, invited };
}
