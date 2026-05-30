"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Send, CheckCircle2 } from "lucide-react";

export function SupportForm() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  function submit() {
    if (subject.trim().length < 3 || body.trim().length < 10) {
      toast.error("Subject + at least 10 chars of body, please.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || "Could not send ticket");
        return;
      }
      const data = await res.json();
      setSubmittedId(data.ticket_id);
      setSubject("");
      setBody("");
    });
  }

  if (submittedId) {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-6 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
        <h3 className="text-xl font-bold text-emerald-900">Ticket sent ✓</h3>
        <p className="text-sm text-emerald-700 mt-1">
          Our AI is reviewing it right now. You&apos;ll hear back via email shortly.
        </p>
        <button
          onClick={() => setSubmittedId(null)}
          className="mt-3 text-sm text-emerald-700 underline"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Subject</label>
        <input
          className="input"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Brief subject of your issue"
          maxLength={200}
        />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Describe the issue</label>
        <textarea
          className="input min-h-[180px]"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What were you trying to do? What happened? What did you expect?"
          maxLength={20_000}
        />
      </div>
      <div className="text-right pt-2 border-t border-slate-100">
        <button onClick={submit} disabled={pending} className="btn-primary inline-flex items-center gap-1">
          <Send className="h-4 w-4" /> {pending ? "Sending…" : "Send ticket"}
        </button>
      </div>
    </div>
  );
}
