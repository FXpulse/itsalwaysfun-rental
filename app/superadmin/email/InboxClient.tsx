"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Inbox, Send, FileText, Trash2, Archive, PenSquare, LayoutDashboard } from "lucide-react";
import type { EmailAccount, EmailFolder, EmailThread, EmailLabel } from "@/lib/email/types";
import { bulkArchive, bulkMarkRead } from "./actions";

export function InboxClient({
  accounts, folders, labels, threads, page, pageSize, filters,
}: {
  accounts: EmailAccount[]; folders: EmailFolder[]; labels: EmailLabel[];
  threads: EmailThread[]; page: number; pageSize: number;
  filters: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  }

  function applyBulk(action: () => Promise<{ error?: string } | void>) {
    if (selected.size === 0) return;
    startTransition(async () => {
      const r = await action();
      if (r && "error" in r && r.error) toast.error(r.error);
      else {
        toast.success("Done");
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Sidebar */}
      <aside className="col-span-3 space-y-2">
        {accounts.map((a) => (
          <div key={a.id}>
            <div className="text-xs font-bold uppercase text-slate-500 mb-1">{a.label}</div>
            {folders.filter((f) => f.account_id === a.id).map((f) => (
              <Link key={f.id}
                href={`/superadmin/email?account=${a.id}&folder=${f.id}`}
                className={`block px-2 py-1 rounded text-sm ${
                  filters.folder === f.id ? "bg-brand-navy text-white" : "hover:bg-slate-100"
                }`}>
                <span className="inline-flex items-center gap-1">
                  {f.special_use === "\\Sent" ? <Send className="h-3 w-3" /> :
                   f.special_use === "\\Drafts" ? <FileText className="h-3 w-3" /> :
                   f.special_use === "\\Trash" ? <Trash2 className="h-3 w-3" /> :
                   <Inbox className="h-3 w-3" />}
                  {f.name} {f.unread_count > 0 && <strong>({f.unread_count})</strong>}
                </span>
              </Link>
            ))}
          </div>
        ))}
      </aside>

      {/* Main */}
      <main className="col-span-9">
        {/* Hero strip — colorful header with stats */}
        <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 text-white p-4 mb-4 shadow-lg flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-violet-100 mb-1">
              <LayoutDashboard className="h-3 w-3" />
              <Link href="/superadmin/dashboard" className="hover:text-white underline-offset-2 hover:underline">
                Dashboard
              </Link>
              <span className="text-violet-300">›</span>
              <span>Inbox</span>
            </div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Inbox className="h-5 w-5" /> {threads.length} threads
              <span className="text-xs font-normal text-violet-200">
                · {accounts.length} account{accounts.length !== 1 ? "s" : ""}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/superadmin/email/compose"
              className="bg-white hover:bg-violet-50 text-violet-700 font-bold text-sm rounded-lg px-4 py-2 inline-flex items-center gap-1 shadow"
            >
              <PenSquare className="h-4 w-4" /> Compose
            </Link>
            <button
              onClick={() => router.refresh()}
              className="bg-white/20 hover:bg-white/30 text-white text-sm rounded-lg px-3 py-2 inline-flex items-center gap-1 transition"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-3 text-sm flex items-center gap-3">
            <strong>{selected.size} selected</strong>
            <button onClick={() => applyBulk(() => bulkArchive(Array.from(selected)))}
                    disabled={pending}
                    className="text-amber-900 hover:underline inline-flex items-center gap-1">
              <Archive className="h-3 w-3" /> Archive
            </button>
            <button onClick={() => applyBulk(() => bulkMarkRead(Array.from(selected), true))}
                    disabled={pending} className="text-amber-900 hover:underline">
              Mark read
            </button>
            <button onClick={() => applyBulk(() => bulkMarkRead(Array.from(selected), false))}
                    disabled={pending} className="text-amber-900 hover:underline">
              Mark unread
            </button>
          </div>
        )}

        <div className="divide-y divide-slate-100 bg-white rounded shadow-sm">
          {threads.length === 0 ? (
            <p className="p-4 text-slate-500 text-sm">No emails in this folder.</p>
          ) : threads.map((t) => (
            <div key={t.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50">
              <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
              <Link href={`/superadmin/email/${t.id}`} className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  {t.unread_count > 0 && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                  <span className={`truncate ${t.unread_count > 0 ? "font-semibold" : ""}`}>
                    {(t.participants || []).slice(0, 2).join(", ") || "(no participants)"}
                  </span>
                </div>
                <div className="text-sm truncate text-slate-600">{t.subject || "(no subject)"}</div>
              </Link>
              <span className="text-xs text-slate-400 whitespace-nowrap">
                {t.last_message_at ? new Date(t.last_message_at).toLocaleDateString() : ""}
              </span>
            </div>
          ))}
        </div>

        {threads.length === pageSize && (
          <div className="flex justify-between mt-3">
            {page > 1 && (
              <Link href={`?page=${page - 1}`} className="text-sm">← Prev</Link>
            )}
            <Link href={`?page=${page + 1}`} className="text-sm ml-auto">Next →</Link>
          </div>
        )}
      </main>
    </div>
  );
}
