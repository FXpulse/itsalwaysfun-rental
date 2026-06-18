// lib/email/imap-client.ts
//
// Thin wrapper over imapflow. Single-connection pattern: connect → do work → close.
// Caller is responsible for awaiting close() in a finally block.

import { ImapFlow, type ListResponse, type FetchMessageObject } from "imapflow";
import type { EmailAccount } from "./types";
import { decryptPassword } from "./encryption";

export interface ImapFolderInfo {
  path: string;
  name: string;
  specialUse: string | null;
}

export class ImapClient {
  private flow: ImapFlow;

  constructor(account: EmailAccount) {
    this.flow = new ImapFlow({
      host: account.imap_host,
      port: account.imap_port,
      secure: account.imap_tls,
      auth: {
        user: account.username,
        pass: decryptPassword(account.encrypted_password),
      },
      logger: false,
    });
  }

  async connect(): Promise<void> {
    await this.flow.connect();
  }

  async close(): Promise<void> {
    try {
      await this.flow.logout();
    } catch {
      // ignore
    }
  }

  /** List all folders in this account. */
  async listFolders(): Promise<ImapFolderInfo[]> {
    const list: ListResponse[] = await this.flow.list();
    return list.map((b) => ({
      path: b.path,
      name: b.name,
      specialUse: typeof b.specialUse === "string" ? b.specialUse : null,
    }));
  }

  /** Fetch new UIDs in a folder strictly greater than `sinceUid`.
   *
   *  Returns empty array if the folder is empty (the IMAP FETCH command
   *  rejects `1:*` ranges on a 0-message folder with "Invalid messageset"). */
  async fetchSinceUid(
    folderPath: string,
    sinceUid: number,
  ): Promise<{ uid: number; raw: Buffer }[]> {
    const lock = await this.flow.getMailboxLock(folderPath);
    try {
      // ImapFlow's `mailbox` property is typed as `MailboxLockObject | boolean`
      // in its .d.ts but the runtime shape always has `exists`. Casting to any
      // is the cheapest way around the union without bloating type defs.
      const mailbox: any = (this.flow as any).mailbox;
      const exists = typeof mailbox?.exists === "number" ? mailbox.exists : -1;
      if (exists === 0) {
        return [];
      }
      const out: { uid: number; raw: Buffer }[] = [];
      // Two-step approach: SEARCH for UIDs first, then FETCH each by UID.
      // More robust than range fetch — works the same across all IMAP servers.
      // ImapFlow's `search` overload signature only accepts a narrow set of
      // criteria objects; `{ uid: "N:*" }` is supported at runtime but not in
      // the published types — hence the cast.
      const searchResult = await (this.flow as any).search(
        sinceUid > 0 ? { uid: `${sinceUid + 1}:*` } : { all: true },
        { uid: true },
      );
      // `search` with `{ uid: true }` returns UID array
      const uids: number[] = Array.isArray(searchResult) ? searchResult : [];
      const newUids = uids.filter((u) => u > sinceUid);
      if (newUids.length === 0) return [];

      // `fetch` second/third params are FetchQueryObject in the types but the
      // runtime accepts a richer subset — narrow types reject `source: true`
      // even though it's documented in the README. Cast to any to use it.
      for await (const msg of this.flow.fetch(
        newUids,
        { uid: true, source: true } as any,
        { uid: true } as any,
      )) {
        const m = msg as FetchMessageObject;
        if (typeof m.uid === "number" && m.uid > sinceUid && m.source) {
          out.push({ uid: m.uid, raw: m.source });
        }
      }
      return out;
    } catch (e: any) {
      const txt = String(e?.responseText || e?.message || "");
      if (/invalid messageset/i.test(txt)) {
        return [];
      }
      throw e;
    } finally {
      lock.release();
    }
  }

  /** Number of messages currently in a folder. Lightweight — opens + reads
   *  mailbox.exists, then closes. */
  async folderMessageCount(folderPath: string): Promise<number> {
    const lock = await this.flow.getMailboxLock(folderPath);
    try {
      // Same ImapFlow type/runtime mismatch as fetchSinceUid above — see
      // comment there. Don't try to "fix" the cast without checking ImapFlow's
      // current published types first.
      const mailbox: any = (this.flow as any).mailbox;
      return typeof mailbox?.exists === "number" ? mailbox.exists : 0;
    } finally {
      lock.release();
    }
  }

  /** APPEND a sent message to a folder (typically the Sent folder). */
  async appendToFolder(folderPath: string, rfc822: Buffer | string): Promise<void> {
    await this.flow.append(folderPath, rfc822, ["\\Seen"]);
  }
}
