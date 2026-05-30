"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Send, CheckCircle2, Pencil, Clock } from "lucide-react";
import { sendReply, setStatus } from "./actions";

export function TicketActions({
  ticketId,
  defaultResponse,
  tenantEmail,
  currentStatus,
}: {
  ticketId: string;
  defaultResponse: string;
  tenantEmail: string | null;
  currentStatus: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState(defaultResponse);
  const [edited, setEdited] = useState(false);
  const [pending, startTransition] = useTransition();
  const [status, setLocalStatus] = useState(currentStatus);

  function handleSend(markResolved: boolean) {
    if (!body.trim()) {
      toast.error("Write a response first");
      return;
    }
    startTransition(async () => {
      const r = await sendReply(ticketId, body.trim(), markResolved);
      if (r?.error) {
        toast.error(r.error);
        return;
      }
      toast.success(markResolved ? "Reply sent + resolved ✓" : "Reply sent ✓");
      router.refresh();
    });
  }

  function changeStatus(next: string) {
    startTransition(async () => {
      const r = await setStatus(ticketId, next);
      if (r?.error) {
        toast.error(r.error);
        return;
      }
      setLocalStatus(next);
      toast.success(`Status → ${next.replace(/_/g, " ")}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
          <Pencil className="h-3 w-3" /> Response (edit or send as-is)
        </label>
        <textarea
          className="input min-h-[140px] text-sm"
          value={body}
          onChange={(e) => { setBody(e.target.value); setEdited(true); }}
        />
        {tenantEmail && (
          <p className="text-[11px] text-slate-400 mt-1">
            Will be emailed to: <strong>{tenantEmail}</strong>
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
        <button
          onClick={() => handleSend(true)}
          disabled={pending}
          className="btn-primary inline-flex items-center gap-1 disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" /> {pending ? "Sending…" : edited ? "Send (edited) + Resolve" : "Send AI response + Resolve"}
        </button>
        <button
          onClick={() => handleSend(false)}
          disabled={pending}
          className="border border-slate-300 text-slate-700 hover:bg-slate-50 px-3 py-2 rounded text-sm inline-flex items-center gap-1 font-semibold disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> Send (keep open)
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">Status:</span>
          {["open", "in_progress", "waiting_on_tenant", "resolved", "closed"].map((s) => (
            <button
              key={s}
              onClick={() => changeStatus(s)}
              disabled={pending || s === status}
              className={`text-xs px-2 py-1 rounded font-semibold transition disabled:opacity-50 ${
                s === status ? "bg-brand-navy text-white cursor-default" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              {s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
