// app/superadmin/email/accounts/new/actions.ts
"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptPassword } from "@/lib/email/encryption";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

export interface WizardInput {
  brand: string;
  label: string;
  email_address: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  username: string;
  password: string;
}

export async function testConnections(input: WizardInput): Promise<
  { ok: true } | { ok: false; stage: "imap" | "smtp"; error: string }
> {
  // Test IMAP
  try {
    const flow = new ImapFlow({
      host: input.imap_host, port: input.imap_port, secure: true,
      auth: { user: input.username, pass: input.password }, logger: false,
    });
    await flow.connect();
    await flow.logout();
  } catch (e: any) {
    return { ok: false, stage: "imap", error: String(e?.message || e) };
  }
  // Test SMTP
  try {
    const transport = nodemailer.createTransport({
      host: input.smtp_host, port: input.smtp_port, secure: true,
      auth: { user: input.username, pass: input.password },
    });
    await transport.verify();
    transport.close();
  } catch (e: any) {
    return { ok: false, stage: "smtp", error: String(e?.message || e) };
  }
  return { ok: true };
}

export async function createAccount(input: WizardInput) {
  const encrypted = encryptPassword(input.password);
  const supabase = createAdminClient({ unscoped: true });
  const { error } = await supabase.from("email_accounts").insert({
    brand: input.brand, label: input.label,
    email_address: input.email_address,
    imap_host: input.imap_host, imap_port: input.imap_port, imap_tls: true,
    smtp_host: input.smtp_host, smtp_port: input.smtp_port, smtp_tls: true,
    username: input.username, encrypted_password: encrypted,
    is_active: true,
  });
  if (error) return { error: error.message };
  redirect("/superadmin/email/accounts");
}
