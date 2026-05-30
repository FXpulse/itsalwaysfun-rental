// POST /api/superadmin/email/send
// Body: { thread_id, to[], cc[], subject, body_text, body_html? }

import { NextResponse } from "next/server";
import { z } from "zod";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSuperadminUser } from "@/lib/auth/superadmin";
import { rateLimit } from "@/lib/rate-limit";
import { smtpSend } from "@/lib/email/smtp-client";
import { ImapClient } from "@/lib/email/imap-client";
import type { EmailAccount, EmailThread } from "@/lib/email/types";

const Body = z.object({
  // Reply: thread_id required. Compose new: account_id required + thread_id omitted.
  thread_id: z.string().uuid().optional(),
  account_id: z.string().uuid().optional(),
  to: z.array(z.string().email()).min(1).max(20),
  cc: z.array(z.string().email()).max(20).optional(),
  subject: z.string().min(1).max(998),
  body_text: z.string().min(1).max(50_000),
  body_html: z.string().max(200_000).optional(),
}).refine((d) => d.thread_id || d.account_id, {
  message: "Either thread_id (reply) or account_id (compose new) is required",
});

export const dynamic = "force-dynamic";

async function requireSuperadmin() {
  const user = await getSuperadminUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function POST(req: Request) {
  let user;
  try { user = await requireSuperadmin(); }
  catch { return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }

  const userIp = (headers().get("x-forwarded-for") || "unknown").split(",")[0].trim();
  const rl = await rateLimit(`email_send:${userIp}`, { max: 10, windowSeconds: 60 });
  if (!rl.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", details: parsed.error.errors[0].message }, { status: 400 });
  }

  const supabase = createAdminClient({ unscoped: true });

  // Resolve account + thread (reply path) OR create new thread (compose path)
  let th: EmailThread;
  let acct: EmailAccount;
  let lastIncomingMessageId: string | null = null;

  if (parsed.data.thread_id) {
    const { data: thread } = await supabase
      .from("email_threads").select("*").eq("id", parsed.data.thread_id).single();
    if (!thread) return NextResponse.json({ error: "thread_not_found" }, { status: 404 });
    th = thread as EmailThread;
    const { data: account } = await supabase
      .from("email_accounts").select("*").eq("id", th.account_id).single();
    if (!account) return NextResponse.json({ error: "account_not_found" }, { status: 404 });
    acct = account as EmailAccount;
    const { data: lastIncoming } = await supabase
      .from("email_messages").select("message_id_header")
      .eq("thread_id", th.id).eq("direction", "incoming")
      .order("received_at", { ascending: false }).limit(1).maybeSingle();
    lastIncomingMessageId = lastIncoming?.message_id_header || null;
  } else {
    const { data: account } = await supabase
      .from("email_accounts").select("*").eq("id", parsed.data.account_id!).single();
    if (!account) return NextResponse.json({ error: "account_not_found" }, { status: 404 });
    acct = account as EmailAccount;

    const participants = [acct.email_address, ...parsed.data.to].map((e) => e.toLowerCase()).sort();
    const { data: created } = await supabase.from("email_threads").insert({
      account_id: acct.id,
      folder_id: null,
      subject: parsed.data.subject,
      participants,
      message_count: 0,
      unread_count: 0,
      last_message_at: new Date().toISOString(),
    }).select("*").single();
    if (!created) return NextResponse.json({ error: "thread_create_failed" }, { status: 500 });
    th = created as EmailThread;
  }

  try {
    const sent = await smtpSend(acct, {
      from: `${acct.label} <${acct.email_address}>`,
      to: parsed.data.to,
      cc: parsed.data.cc,
      subject: parsed.data.subject,
      text: parsed.data.body_text,
      html: parsed.data.body_html,
      inReplyTo: lastIncomingMessageId,
      references: lastIncomingMessageId ? [lastIncomingMessageId] : [],
    });

    // APPEND to Sent folder (best-effort)
    try {
      const imap = new ImapClient(acct);
      await imap.connect();
      const { data: sentFolder } = await supabase
        .from("email_folders").select("path").eq("account_id", acct.id)
        .eq("special_use", "\\Sent").maybeSingle();
      if (sentFolder?.path) {
        await imap.appendToFolder(sentFolder.path, sent.rfc822);
      }
      await imap.close();
    } catch (appendErr) {
      Sentry.captureException(appendErr, { tags: { stage: "append_sent" } });
    }

    // Insert outgoing row
    await supabase.from("email_messages").insert({
      thread_id: th.id, account_id: acct.id, folder_id: th.folder_id,
      direction: "outgoing", message_id_header: sent.messageId,
      in_reply_to: lastIncomingMessageId,
      from_address: acct.email_address,
      to_addresses: parsed.data.to,
      cc_addresses: parsed.data.cc || [],
      subject: parsed.data.subject,
      body_text: parsed.data.body_text,
      body_html: parsed.data.body_html || null,
      sent_at: new Date().toISOString(),
      is_read: true,
    });

    await supabase.from("email_threads")
      .update({ last_message_at: new Date().toISOString(),
                message_count: th.message_count + 1 })
      .eq("id", th.id);

    await supabase.from("email_audit_log").insert({
      account_id: acct.id, action: "reply_sent",
      user_email: user.email,
      details_jsonb: { thread_id: th.id, to: parsed.data.to },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    Sentry.captureException(e, { tags: { stage: "smtp_send" } });
    return NextResponse.json({ error: e?.message || "send_failed" }, { status: 500 });
  }
}
