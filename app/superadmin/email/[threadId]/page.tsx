import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getSuperadminUser } from "@/lib/auth/superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReplyForm } from "./ReplyForm";
import type { EmailMessage, EmailThread, EmailAccount } from "@/lib/email/types";

export const dynamic = "force-dynamic";

export default async function ThreadPage({ params }: { params: { threadId: string } }) {
  const me = await getSuperadminUser();
  if (!me) redirect("/superadmin/login?error=not_superadmin");

  const supabase = createAdminClient({ unscoped: true });
  const { data: thread } = await supabase
    .from("email_threads").select("*").eq("id", params.threadId).maybeSingle();
  if (!thread) notFound();
  const th = thread as EmailThread;

  const [{ data: messages }, { data: account }] = await Promise.all([
    supabase.from("email_messages").select("*")
      .eq("thread_id", params.threadId)
      .order("received_at", { ascending: true, nullsFirst: true }),
    supabase.from("email_accounts").select("*").eq("id", th.account_id).single(),
  ]);

  // Mark all messages in this thread as read
  await supabase.from("email_messages")
    .update({ is_read: true })
    .eq("thread_id", params.threadId).eq("is_read", false);
  await supabase.from("email_threads").update({ unread_count: 0 }).eq("id", th.id);

  const list = (messages as EmailMessage[]) || [];
  const acct = account as EmailAccount;
  const lastIncoming = [...list].reverse().find((m) => m.direction === "incoming");
  const replyTo = lastIncoming?.from_address || "";

  return (
    <div className="max-w-3xl">
      <Link href="/superadmin/email" className="text-sm text-slate-500 inline-flex items-center gap-1 mb-3">
        <ChevronLeft className="h-4 w-4" /> Back to inbox
      </Link>

      <h1 className="text-xl font-bold text-brand-navy mb-1">{th.subject || "(no subject)"}</h1>
      <div className="text-xs text-slate-500 mb-4">
        {acct.label} · {th.message_count} messages
      </div>

      <div className="space-y-3 mb-6">
        {list.map((m) => (
          <article key={m.id} className="card">
            <div className="text-xs text-slate-500 mb-2 flex items-center justify-between">
              <div>
                <strong>{m.from_address}</strong> → {(m.to_addresses || []).join(", ")}
              </div>
              <div>
                {m.received_at ? new Date(m.received_at).toLocaleString() :
                 m.sent_at ? new Date(m.sent_at).toLocaleString() : ""}
              </div>
            </div>
            {m.body_html ? (
              <iframe
                srcDoc={m.body_html}
                sandbox=""
                className="w-full min-h-[300px] border border-slate-100 rounded"
              />
            ) : (
              <pre className="text-sm whitespace-pre-wrap font-sans">{m.body_text}</pre>
            )}
          </article>
        ))}
      </div>

      <ReplyForm
        threadId={th.id}
        defaultTo={replyTo}
        defaultSubject={th.subject?.startsWith("Re:") ? th.subject : `Re: ${th.subject || ""}`}
        accountLabel={acct.label}
        accountEmail={acct.email_address}
      />
    </div>
  );
}
