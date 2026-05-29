"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

export function ReplyForm({
  threadId, defaultTo, defaultSubject, accountLabel, accountEmail,
}: {
  threadId: string;
  defaultTo: string;
  defaultSubject: string;
  accountLabel: string;
  accountEmail: string;
}) {
  const router = useRouter();
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const draftKey = `email_draft_${threadId}`;

  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      try {
        const d = JSON.parse(saved);
        if (d.body) setBody(d.body);
        if (d.subject) setSubject(d.subject);
      } catch {}
    }
  }, [draftKey]);

  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify({ body, subject }));
    }, 1000);
    return () => clearTimeout(t);
  }, [body, subject, draftKey]);

  function submit() {
    if (!to.trim() || !body.trim()) {
      toast.error("Fill 'to' and message body");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/superadmin/email/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread_id: threadId,
          to: to.split(",").map((s) => s.trim()).filter(Boolean),
          subject, body_text: body,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || "Send failed");
        return;
      }
      localStorage.removeItem(draftKey);
      toast.success("Reply sent ✓");
      router.refresh();
    });
  }

  return (
    <div className="card border-2 border-brand-navy">
      <h2 className="font-bold text-brand-navy mb-2">Reply</h2>
      <div className="text-xs text-slate-500 mb-2">From: {accountLabel} &lt;{accountEmail}&gt;</div>
      <div className="space-y-2">
        <input className="input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To (comma-separated)" />
        <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
        <textarea
          className="input min-h-[200px]" value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your reply..."
        />
        <div className="text-right">
          <button onClick={submit} disabled={pending} className="btn-primary inline-flex items-center gap-1">
            <Send className="h-4 w-4" /> {pending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
