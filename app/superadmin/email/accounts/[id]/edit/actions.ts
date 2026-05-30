"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptPassword } from "@/lib/email/encryption";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

export interface EditInput {
  id: string;
  label: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  username: string;
  password?: string;          // only update if provided
  is_active: boolean;
}

function formatErr(e: any): string {
  const parts: string[] = [];
  if (e?.code) parts.push(`code=${e.code}`);
  if (e?.authenticationFailed) parts.push("auth_failed=true");
  if (e?.serverResponseCode) parts.push(`server_code=${e.serverResponseCode}`);
  if (e?.responseText) parts.push(`text=${String(e.responseText).slice(0, 200)}`);
  parts.push(`msg=${String(e?.message || e)}`);
  return parts.join(" | ");
}

/**
 * Test IMAP + SMTP without saving. Used by the "Test" button so the user
 * can verify credentials before committing.
 */
export async function testEditConnection(input: EditInput): Promise<
  { ok: true } | { ok: false; stage: "imap" | "smtp"; error: string }
> {
  if (!input.password) return { ok: false, stage: "imap", error: "password required to test" };

  try {
    const flow = new ImapFlow({
      host: input.imap_host, port: input.imap_port, secure: true,
      auth: { user: input.username, pass: input.password }, logger: false,
    });
    await flow.connect();
    await flow.logout();
  } catch (e: any) {
    return { ok: false, stage: "imap", error: formatErr(e) };
  }
  try {
    const transport = nodemailer.createTransport({
      host: input.smtp_host, port: input.smtp_port, secure: true,
      auth: { user: input.username, pass: input.password },
    });
    await transport.verify();
    transport.close();
  } catch (e: any) {
    return { ok: false, stage: "smtp", error: formatErr(e) };
  }
  return { ok: true };
}

/**
 * Save changes. Does NOT validate IMAP/SMTP — the user has the option to
 * test separately. This way they can update creds even if the server is
 * temporarily unreachable or if the new credentials need DB propagation
 * time on the mail server side.
 */
export async function saveAccount(input: EditInput): Promise<{ ok: true } | { error: string }> {
  const updates: Record<string, any> = {
    label: input.label,
    imap_host: input.imap_host,
    imap_port: input.imap_port,
    smtp_host: input.smtp_host,
    smtp_port: input.smtp_port,
    username: input.username,
    is_active: input.is_active,
    // Clear last error so the next sync attempt can populate fresh status
    last_sync_error: null,
    last_sync_error_at: null,
    consecutive_failures: 0,
    updated_at: new Date().toISOString(),
  };
  if (input.password) {
    try {
      updates.encrypted_password = encryptPassword(input.password);
    } catch (e: any) {
      return { error: `encryption_failed: ${e?.message || e}` };
    }
  }
  const supabase = createAdminClient({ unscoped: true });
  const { error } = await supabase
    .from("email_accounts")
    .update(updates)
    .eq("id", input.id);
  if (error) return { error: error.message };

  revalidatePath("/superadmin/email/accounts");
  revalidatePath("/superadmin/email");
  return { ok: true };
}
