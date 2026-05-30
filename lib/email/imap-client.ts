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
      const mailbox: any = (this.flow as any).mailbox;
      const exists = typeof mailbox?.exists === "number" ? mailbox.exists : -1;
      if (exists === 0) {
        return [];
      }
      const out: { uid: number; raw: Buffer }[] = [];
      // imapflow API: flow.fetch(range, query, [options]).
      // To treat `range` as UID-based (so `1:*` means UID 1 to highest UID,
      // not sequence number 1 to last), pass `{ uid: true }` as the OPTIONS
      // arg, NOT as part of the query. Previously we passed it inside the
      // query which left the range interpreted as sequence numbers — fetch
      // sometimes returned zero results.
      const range = `${sinceUid + 1}:*`;
      for await (const msg of this.flow.fetch(
        range,
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
