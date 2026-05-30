"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import type { EmailAccount } from "@/lib/email/types";

export function ComposeForm({
  accounts,
  initialTo = "",
  initialCc = "",
  initialSubject = "",
  initialBody = "",
}: {
  accounts: EmailAccount[];
  initialTo?: string;
  initialCc?: string;
  initialSubject?: string;
  initialBody?: string;
}) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [to, setTo] = useState(initialTo);
  const [cc, setCc] = useState(initialCc);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [pending, startTransition] = useTransition();

  function submit() {
    const toList = to.split(",").map((s) => s.trim()).filter(Boolean);
    if (toList.length === 0 || !body.trim() || !subject.trim() || !accountId) {
      toast.error("Fill from / to / subject / body");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/superadmin/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: accountId,
          to: toList,
          cc: cc.split(",").map((s) => s.trim()).filter(Boolean),
          subject,
          body_text: body,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || "Send failed");
        return;
      }
      toast.success("Message sent ✓");
      router.push("/superadmin/email");
    });
  }

  return (
    <div className="card border-2 border-brand-navy space-y-3">
      <div>
        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">From</label>
        <select
          className="input"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label} &lt;{a.email_address}&gt;
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">To</label>
        <input
          className="input"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="recipient@example.com, another@example.com"
        />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
          Cc <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          className="input"
          value={cc}
          onChange={(e) => setCc(e.target.value)}
          placeholder="cc@example.com"
        />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Subject</label>
        <input
          className="input"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Message</label>
        <textarea
          className="input min-h-[300px]"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message..."
        />
      </div>
      <div className="text-right pt-2 border-t border-slate-100">
        <button
          onClick={submit}
          disabled={pending}
          className="btn-primary inline-flex items-center gap-1"
        >
          <Send className="h-4 w-4" /> {pending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
