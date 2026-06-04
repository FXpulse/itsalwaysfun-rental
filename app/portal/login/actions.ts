"use server";

import { cookies, headers } from "next/headers";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { getTenantEmailConfig } from "@/lib/email/tenant-email";
import { resolveTenantByHostname } from "@/lib/tenant/resolve";
import { ensureCustomerProfile, linkReferrer } from "@/lib/loyalty";

const CODE_LENGTH = 6;
const EXPIRY_MINUTES = 15;
const MAX_ATTEMPTS = 5;

function generateCode(): string {
  // 6-digit numeric code, zero-padded
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

function hashCode(code: string, email: string): string {
  // HMAC the code with email as part of the salt so codes can't be replayed across emails
  return crypto
    .createHmac("sha256", process.env.OTP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "fallback-dev")
    .update(`${email.toLowerCase()}::${code}`)
    .digest("hex");
}

async function getTenantContext(): Promise<{ tenantId: string | null; businessName: string; fromHost: string }> {
  const host = headers().get("host") || "";
  try {
    const t = await resolveTenantByHostname(host);
    if (t && (t as any).id) {
      return { tenantId: (t as any).id, businessName: (t as any).business_name || "RentalFlow", fromHost: host };
    }
  } catch {}
  return { tenantId: null, businessName: "RentalFlow", fromHost: host };
}

/** Request a 6-digit code. Generates, stores hashed, emails via Resend. */
export async function requestPortalCode(email: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
      return { ok: false, error: "Invalid email format" };
    }

    const { tenantId, businessName } = await getTenantContext();
    const supabase = createAdminClient({ unscoped: true });

    // Invalidate previous unconsumed codes for this email (one active code at a time)
    await supabase
      .from("portal_otp_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("email", normalizedEmail)
      .is("consumed_at", null);

    // Generate + store new code
    const code = generateCode();
    const code_hash = hashCode(code, normalizedEmail);
    const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000).toISOString();

    const { error: insertError } = await supabase.from("portal_otp_codes").insert({
      email: normalizedEmail,
      tenant_id: tenantId,
      code_hash,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error("requestPortalCode insert error:", insertError);
      return { ok: false, error: "Failed to save code" };
    }

    // Send email via Resend (full template control)
    const html = `
      <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a2e; margin: 0 0 16px 0;">Your sign-in code</h2>
        <p style="color: #4a4a5e; line-height: 1.5; margin: 0 0 16px 0;">
          Hi,
        </p>
        <p style="color: #4a4a5e; line-height: 1.5; margin: 0 0 24px 0;">
          Use this code to sign in to your <strong>${businessName}</strong> customer portal:
        </p>
        <div style="background: #f4f4f8; padding: 24px; text-align: center; font-size: 36px; font-weight: bold; letter-spacing: 12px; border-radius: 12px; margin: 0 0 24px 0; color: #1a1a2e; font-family: 'SF Mono', Consolas, monospace;">
          ${code}
        </div>
        <p style="color: #888; font-size: 13px; line-height: 1.5; margin: 0 0 8px 0;">
          This code expires in ${EXPIRY_MINUTES} minutes.
        </p>
        <p style="color: #888; font-size: 13px; line-height: 1.5; margin: 0 0 24px 0;">
          If you didn't request this, you can safely ignore this email.
        </p>
        <p style="color: #aaa; font-size: 12px; margin: 24px 0 0 0; border-top: 1px solid #eee; padding-top: 16px;">
          ${businessName}
        </p>
      </div>
    `;

    const text = `Your sign-in code: ${code}\n\nUse this code to sign in to your ${businessName} customer portal.\nExpires in ${EXPIRY_MINUTES} minutes.\n\nIf you didn't request this, ignore this email.`;

    const tenantEmail = await getTenantEmailConfig(tenantId);
    const result = await sendEmail({
      to: normalizedEmail,
      from: tenantEmail.from,
      replyTo: tenantEmail.replyTo,
      subject: `Your ${businessName} sign-in code: ${code}`,
      html,
      text,
      tags: [
        { name: "type", value: "portal_otp" },
        { name: "tenant_id", value: tenantId || "unknown" },
      ],
    });

    if (!result.ok) {
      console.error("requestPortalCode email send error:", result.error);
      return { ok: false, error: result.error || "Failed to send email" };
    }

    return { ok: true };
  } catch (e: any) {
    console.error("requestPortalCode threw:", e);
    return { ok: false, error: e?.message || String(e) };
  }
}

/** Verify the code. On success, creates/signs the user in via Supabase admin. */
export async function verifyPortalCode(email: string, code: string): Promise<{ ok: boolean; error?: string; next?: string }> {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = code.replace(/\s+/g, "").trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      return { ok: false, error: "Code must be 6 digits" };
    }

    const supabase = createAdminClient({ unscoped: true });

    // Find latest unconsumed code for this email
    const { data: rows } = await supabase
      .from("portal_otp_codes")
      .select("*")
      .eq("email", normalizedEmail)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    const row = (rows as any[])?.[0];
    if (!row) {
      return { ok: false, error: "No active code. Request a new one." };
    }

    // Check expiry
    if (new Date(row.expires_at) < new Date()) {
      await supabase.from("portal_otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
      return { ok: false, error: "Code expired. Request a new one." };
    }

    // Check attempts
    if (row.attempts >= MAX_ATTEMPTS) {
      await supabase.from("portal_otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
      return { ok: false, error: "Too many attempts. Request a new code." };
    }

    // Hash incoming and compare
    const incomingHash = hashCode(cleanCode, normalizedEmail);
    if (incomingHash !== row.code_hash) {
      await supabase.from("portal_otp_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return { ok: false, error: `Wrong code. ${MAX_ATTEMPTS - row.attempts - 1} attempts left.` };
    }

    // Consume the code
    await supabase.from("portal_otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);

    // Create or fetch the user via Supabase Admin API
    let userId: string | null = null;
    // Try to find existing user
    const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    // listUsers doesn't filter by email — fallback: query by email via admin user listing
    // Better approach: try createUser, on conflict get the user
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
    });
    if (createErr && !/already.*registered|already.*exists|duplicate/i.test(createErr.message)) {
      console.error("verifyPortalCode create user error:", createErr);
      return { ok: false, error: "Failed to create account" };
    }
    if (created?.user) {
      userId = created.user.id;
    } else {
      // User already exists — find them
      // Supabase admin doesn't have getUserByEmail, so we paginate and find
      // Better: use the customer_profiles table which has email→id mapping
      const { data: profile } = await supabase
        .from("customer_profiles")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();
      if (profile) {
        userId = (profile as any).id;
      } else {
        // Last resort: paginate through users
        let page = 1;
        while (page < 50) {
          const { data: pageData } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
          const found = pageData?.users?.find((u) => u.email?.toLowerCase() === normalizedEmail);
          if (found) {
            userId = found.id;
            break;
          }
          if (!pageData?.users || pageData.users.length < 200) break;
          page++;
        }
      }
    }

    if (!userId) {
      return { ok: false, error: "Could not resolve user account" };
    }

    // Generate a magic link and use it to set the session server-side
    // The trick: admin.generateLink with type 'magiclink' returns a hashed_token + action_link.
    // We use the hashed_token with verifyOtp on the server to set the cookie.
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: normalizedEmail,
    });
    if (linkErr || !linkData?.properties?.hashed_token) {
      console.error("verifyPortalCode generateLink error:", linkErr);
      return { ok: false, error: "Failed to create session" };
    }

    // Use the user-context client to exchange the hashed token for a session cookie
    const userClient = createClient();
    const { error: verifyErr } = await userClient.auth.verifyOtp({
      type: "magiclink",
      token_hash: linkData.properties.hashed_token,
    });
    if (verifyErr) {
      console.error("verifyPortalCode verifyOtp error:", verifyErr);
      return { ok: false, error: "Failed to establish session" };
    }

    // Post-login hookup (best effort)
    try {
      await ensureCustomerProfile(userId);
      const refCookie = cookies().get("iaf_ref")?.value;
      if (refCookie) {
        await linkReferrer(userId, refCookie);
        cookies().set("iaf_ref", "", { maxAge: 0, path: "/" });
      }
    } catch (e) {
      console.error("verifyPortalCode hookup error:", e);
    }

    return { ok: true, next: "/portal" };
  } catch (e: any) {
    console.error("verifyPortalCode threw:", e);
    return { ok: false, error: e?.message || String(e) };
  }
}
