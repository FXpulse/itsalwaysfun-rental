// lib/email/smtp-client.ts
//
// Wrapper over nodemailer for SMTP send. After successful send, builds the
// RFC822 message string that the caller can APPEND to the Sent folder via
// ImapClient.

import nodemailer, { type SendMailOptions } from "nodemailer";
import type { EmailAccount } from "./types";
import { decryptPassword } from "./encryption";

export interface SendInput {
  from: string;          // "Name <email@host>"
  to: string[];
  cc?: string[];
  subject: string;
  text: string;
  html?: string;
  inReplyTo?: string | null;
  references?: string[];
}

export interface SendResult {
  messageId: string;
  rfc822: string;        // serialized message, suitable for IMAP APPEND
}

export async function smtpSend(
  account: EmailAccount,
  input: SendInput,
): Promise<SendResult> {
  const transport = nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port,
    secure: account.smtp_tls,
    auth: {
      user: account.username,
      pass: decryptPassword(account.encrypted_password),
    },
  });

  const headers: Record<string, string> = {};
  if (input.inReplyTo) headers["In-Reply-To"] = input.inReplyTo;
  if (input.references && input.references.length > 0) {
    headers["References"] = input.references.join(" ");
  }

  const mailOpts: SendMailOptions = {
    from: input.from,
    to: input.to,
    cc: input.cc,
    subject: input.subject,
    text: input.text,
    html: input.html,
    headers,
  };

  const info = await transport.sendMail(mailOpts);

  // Build a minimum-viable RFC822 representation for IMAP APPEND from the
  // parts we already know. We don't try to perfectly reconstruct what
  // nodemailer sent — APPEND needs a parseable message and this is enough.
  const lines = [
    `From: ${input.from}`,
    `To: ${input.to.join(", ")}`,
    ...(input.cc && input.cc.length ? [`Cc: ${input.cc.join(", ")}`] : []),
    `Subject: ${input.subject}`,
    `Message-ID: ${info.messageId}`,
    ...(input.inReplyTo ? [`In-Reply-To: ${input.inReplyTo}`] : []),
    ...(input.references && input.references.length
      ? [`References: ${input.references.join(" ")}`] : []),
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    input.text,
  ];
  const rfc822 = lines.join("\r\n");

  transport.close();

  return {
    messageId: info.messageId || "",
    rfc822,
  };
}
