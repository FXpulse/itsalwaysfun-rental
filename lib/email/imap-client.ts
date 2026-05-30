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
      const range = `${sinceUid + 1}:*`;
      for await (const msg of this.flow.fetch(range, { uid: true, source: true })) {
        const m = msg as FetchMessageObject;
        if (typeof m.uid === "number" && m.uid > sinceUid && m.source) {
          out.push({ uid: m.uid, raw: m.source });
        }
      }
      return out;
    } catch (e: any) {
      // Some servers reject the messageset even when exists > 0 if sinceUid
      // is past the last UID. Treat that as "no new messages" rather than
      // a fatal error.
      const txt = String(e?.responseText || e?.message || "");
      if (/invalid messageset/i.test(txt)) {
        return [];
      }
      throw e;
    } finally {
      lock.release();
    }
  }

  /** APPEND a sent message to a folder (typically the Sent folder). */
  async appendToFolder(folderPath: string, rfc822: Buffer | string): Promise<void> {
    await this.flow.append(folderPath, rfc822, ["\\Seen"]);
  }
}
