// GET /api/cron/email-sync
// Every 5 min. For each active email_account, sync new messages from every
// active folder, run rules, store. Fail-soft per account.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { ImapClient } from "@/lib/email/imap-client";
import { parseRawMessage } from "@/lib/email/parser";
import { evaluateConditions } from "@/lib/email/rules-engine";
import type {
  EmailAccount, EmailFolder, EmailMessage, EmailRule,
  RuleActionBlock, RuleAction,
} from "@/lib/email/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return await runHandler();
  } catch (e: any) {
    // Defense-in-depth try/catch. Do NOT call Sentry here — if Sentry itself
    // throws, the outer Next.js fallback renders an HTML 500 page that the
    // sync-now UI can't parse.
    try {
      console.error("[email-sync route] top-level error:", e);
    } catch {}
    return NextResponse.json(
      {
        error: "internal_error",
        message: String(e?.message || e),
        stack: String(e?.stack || "").slice(0, 1500),
      },
      { status: 500 },
    );
  }
}

async function runHandler() {
  const auth = headers().get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Skip Sentry.withMonitor — it has been throwing on this route. Run the
  // sync inline; errors still get captured by Sentry via the outer try/catch
  // in GET().
  {
    const supabase = createAdminClient({ unscoped: true });

    const { data: accounts, error } = await supabase
      .from("email_accounts").select("*")
      .eq("is_active", true);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const results: any[] = [];
    for (const account of (accounts as EmailAccount[]) || []) {
      try {
        const r = await syncOneAccount(supabase, account);
        results.push({ account: account.email_address, ...r });
        await supabase.from("email_accounts").update({
          last_sync_at: new Date().toISOString(),
          consecutive_failures: 0,
          last_sync_error: null,
        }).eq("id", account.id);
      } catch (e: any) {
        Sentry.captureException(e, {
          tags: { account_id: account.id, stage: "email_sync" },
        });
        // Dump ALL properties of the error (including non-enumerable). imapflow
        // sometimes attaches the details to keys we don't anticipate.
        let dump = "";
        try {
          dump = JSON.stringify(e, Object.getOwnPropertyNames(e)).slice(0, 800);
        } catch { dump = "(dump_failed)"; }
        const stackHead = String(e?.stack || "").split("\n").slice(0, 4).join(" / ").slice(0, 400);
        const fullError = `msg=${String(e?.message || e)} | name=${e?.name} | dump=${dump} | stack=${stackHead}`;

        const failures = (account.consecutive_failures || 0) + 1;
        await supabase.from("email_accounts").update({
          consecutive_failures: failures,
          last_sync_error: fullError,
          last_sync_error_at: new Date().toISOString(),
          is_active: failures >= 3 ? false : account.is_active,
        }).eq("id", account.id);
        results.push({
          account: account.email_address, error: fullError,
        });
      }
    }

    return NextResponse.json({ ok: true, results });
  }
}

async function syncOneAccount(supabase: any, account: EmailAccount) {
  const imap = new ImapClient(account);
  let foldersSynced = 0;
  let messagesFetched = 0;
  try {
    await imap.connect();

    // 1. LIST + upsert folders
    const folders = await imap.listFolders();
    for (const f of folders) {
      await supabase.from("email_folders").upsert({
        account_id: account.id,
        path: f.path, name: f.name, special_use: f.specialUse, is_active: true,
      }, { onConflict: "account_id,path" });
    }

    // 2. Read back active folders for this account
    const { data: dbFolders } = await supabase
      .from("email_folders").select("*")
      .eq("account_id", account.id).eq("is_active", true);

    const uidMap: Record<string, number> =
      (account.last_synced_uid_per_folder as any) || {};

    // 3. For each folder, fetch new UIDs
    for (const folder of (dbFolders as EmailFolder[]) || []) {
      const sinceUid = uidMap[folder.path] || 0;
      const newMessages = await imap.fetchSinceUid(folder.path, sinceUid);
      foldersSynced++;
      if (newMessages.length === 0) continue;

      let maxUid = sinceUid;
      for (const { uid, raw } of newMessages) {
        try {
          const parsed = await parseRawMessage(raw);
          // dedupe by Message-ID
          if (parsed.message_id_header) {
            const { data: existing } = await supabase
              .from("email_messages").select("id")
              .eq("account_id", account.id)
              .eq("message_id_header", parsed.message_id_header)
              .maybeSingle();
            if (existing) { maxUid = Math.max(maxUid, uid); continue; }
          }

          // match-or-create thread
          const thread = await matchOrCreateThread(supabase, account.id, folder.id, parsed);

          // insert message
          const { data: msg, error: msgErr } = await supabase
            .from("email_messages").insert({
              thread_id: thread.id, account_id: account.id, folder_id: folder.id,
              direction: "incoming", imap_uid: uid,
              message_id_header: parsed.message_id_header,
              in_reply_to: parsed.in_reply_to,
              from_address: parsed.from_address,
              to_addresses: parsed.to_addresses,
              cc_addresses: parsed.cc_addresses,
              subject: parsed.subject,
              body_text: parsed.body_text,
              body_html: parsed.body_html,
              received_at: parsed.received_at,
              has_attachments: parsed.has_attachments,
              raw_size_bytes: parsed.raw_size_bytes,
            })
            .select("*").single();
          if (msgErr || !msg) {
            Sentry.captureException(msgErr || new Error("insert returned no row"), {
              tags: { stage: "insert_message", uid: String(uid) },
            });
            maxUid = Math.max(maxUid, uid);
            continue;
          }
          messagesFetched++;

          // update thread counters
          await supabase.from("email_threads").update({
            last_message_at: parsed.received_at,
            message_count: thread.message_count + 1,
            unread_count: thread.unread_count + 1,
          }).eq("id", thread.id);

          // run rules
          await applyRulesToMessage(supabase, account.id, msg as EmailMessage);

          maxUid = Math.max(maxUid, uid);
        } catch (perMsg) {
          Sentry.captureException(perMsg, {
            tags: { stage: "per_message", uid: String(uid) },
          });
        }
      }

      uidMap[folder.path] = maxUid;
    }

    await supabase.from("email_accounts").update({
      last_synced_uid_per_folder: uidMap,
    }).eq("id", account.id);

    return { foldersSynced, messagesFetched };
  } finally {
    await imap.close();
  }
}

async function matchOrCreateThread(
  supabase: any, accountId: string, folderId: string,
  parsed: Awaited<ReturnType<typeof parseRawMessage>>,
) {
  // 1. Try matching by In-Reply-To → existing message → its thread
  if (parsed.in_reply_to) {
    const { data: parent } = await supabase
      .from("email_messages").select("thread_id")
      .eq("account_id", accountId)
      .eq("message_id_header", parsed.in_reply_to)
      .maybeSingle();
    if (parent?.thread_id) {
      const { data: th } = await supabase
        .from("email_threads").select("*").eq("id", parent.thread_id).single();
      if (th) return th;
    }
  }
  // 2. Fallback — normalized subject + participant set
  const normSubject = (parsed.subject || "")
    .replace(/^(re|fwd|fw):\s*/gi, "")
    .replace(/^(re|fwd|fw):\s*/gi, "")
    .trim();
  const participants = [
    parsed.from_address,
    ...parsed.to_addresses,
    ...parsed.cc_addresses,
  ].map((s) => s.toLowerCase()).sort();
  const { data: existing } = await supabase
    .from("email_threads").select("*")
    .eq("account_id", accountId)
    .eq("subject", normSubject)
    .eq("participants", participants)
    .maybeSingle();
  if (existing) return existing;

  // 3. Create new thread
  const { data: created } = await supabase.from("email_threads").insert({
    account_id: accountId, folder_id: folderId, subject: normSubject,
    participants, message_count: 0, unread_count: 0,
    last_message_at: parsed.received_at,
  }).select("*").single();
  return created;
}

async function applyRulesToMessage(
  supabase: any, accountId: string, msg: EmailMessage,
) {
  const { data: rules } = await supabase
    .from("email_rules").select("*")
    .eq("account_id", accountId).eq("is_active", true)
    .order("priority", { ascending: true });
  for (const rule of (rules as EmailRule[]) || []) {
    if (!evaluateConditions(rule.condition_jsonb, msg)) continue;
    const block: RuleActionBlock = rule.action_jsonb;
    for (const action of block.actions || []) {
      await executeAction(supabase, action, msg);
    }
    await supabase.from("email_rules").update({
      match_count: rule.match_count + 1,
      last_run_at: new Date().toISOString(),
    }).eq("id", rule.id);
    await supabase.from("email_audit_log").insert({
      account_id: accountId, action: "rule_fired",
      details_jsonb: { rule_id: rule.id, message_id: msg.id },
    });
    if (block.stop_processing) break;
  }
}

async function executeAction(supabase: any, action: RuleAction, msg: EmailMessage) {
  switch (action.type) {
    case "apply_label":
      if (action.label_id) {
        await supabase.from("email_thread_labels").upsert({
          thread_id: msg.thread_id, label_id: action.label_id,
        });
      }
      break;
    case "mark_read":
      await supabase.from("email_messages")
        .update({ is_read: true }).eq("id", msg.id);
      break;
    case "mark_unread":
      await supabase.from("email_messages")
        .update({ is_read: false }).eq("id", msg.id);
      break;
    case "archive":
      await supabase.from("email_threads")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", msg.thread_id);
      break;
    // move_to_folder, forward_to, auto_reply are stubs in MVP — log only
    default:
      break;
  }
}
