"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Mail,
  Phone,
  Check,
  RotateCcw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
} from "lucide-react";
import { markResolved, reopenMessage, deleteMessage, replyToMessage } from "./actions";
import type { ContactMessage } from "./page";

import { Send, MessageSquare } from "lucide-react";

export function InboxClient({
  messages,
  isAdmin,
}: {
  messages: ContactMessage[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyAndResolve, setReplyAndResolve] = useState(true);

  function handleResolve(m: ContactMessage) {
    startTransition(async () => {
      const r = await markResolved(m.id, note);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Marked resolved");
      setResolvingId(null);
      setNote("");
      router.refresh();
    });
  }

  function handleReopen(m: ContactMessage) {
    startTransition(async () => {
      const r = await reopenMessage(m.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Reopened");
      router.refresh();
    });
  }

  function handleSendReply(m: ContactMessage) {
    if (!replyBody.trim()) {
      toast.error("Write a reply first");
      return;
    }
    startTransition(async () => {
      const r = await replyToMessage(m.id, replyBody, replyAndResolve);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(
        replyAndResolve ? "Reply sent + marked resolved" : "Reply sent",
      );
      setReplyingId(null);
      setReplyBody("");
      setReplyAndResolve(true);
      router.refresh();
    });
  }

  function handleDelete(m: ContactMessage) {
    if (!confirm(`Delete message from ${m.first_name}? Cannot undo.`)) return;
    startTransition(async () => {
      const r = await deleteMessage(m.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Deleted");
      router.refresh();
    });
  }

  if (messages.length === 0) {
    return (
      <div className="card text-center py-12 text-slate-400">
        <Mail className="h-10 w-10 mx-auto mb-2 opacity-40" />
        <p>No contact messages yet.</p>
        <p className="text-xs mt-2">
          When someone submits the public /contact form, it'll show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((m) => {
        const isResolving = resolvingId === m.id;
        const hasIssue = !m.is_resolved && (m.ghl_webhook_error || !m.emailed_to_admin_at);
        return (
          <div
            key={m.id}
            className={`card border-l-4 ${
              m.is_resolved
                ? "border-l-slate-300 opacity-70"
                : hasIssue
                  ? "border-l-amber-500"
                  : "border-l-brand-navy"
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <strong className="text-brand-navy">
                    {m.first_name} {m.last_name}
                  </strong>
                  {m.is_resolved ? (
                    <span className="text-xs bg-green-100 text-green-800 rounded px-2 py-0.5 inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Resolved
                    </span>
                  ) : (
                    <span className="text-xs bg-amber-100 text-amber-800 rounded px-2 py-0.5 inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Open
                    </span>
                  )}
                  {m.source !== "website-contact" && (
                    <span className="text-[10px] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">
                      {m.source}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                  <a
                    href={`mailto:${m.email}`}
                    className="inline-flex items-center gap-1 hover:text-brand-navy"
                  >
                    <Mail className="h-3 w-3" /> {m.email}
                  </a>
                  {m.phone && (
                    <a
                      href={`tel:${m.phone}`}
                      className="inline-flex items-center gap-1 hover:text-brand-navy"
                    >
                      <Phone className="h-3 w-3" /> {m.phone}
                    </a>
                  )}
                  <span>· {new Date(m.created_at).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex gap-1">
                {!replyingId && (
                  <button
                    onClick={() => {
                      setReplyingId(m.id);
                      setReplyBody("");
                      setReplyAndResolve(!m.is_resolved);
                    }}
                    className="text-xs bg-brand-navy text-white rounded px-3 py-1.5 font-semibold hover:bg-brand-navy-dark inline-flex items-center gap-1"
                  >
                    <Mail className="h-3 w-3" /> Reply
                  </button>
                )}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded p-3 mb-3 text-sm whitespace-pre-wrap">
              {m.message}
            </div>

            {/* Reply thread */}
            {m.replies.length > 0 && (
              <div className="mb-3 space-y-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold inline-flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> Replies ({m.replies.length})
                </div>
                {m.replies.map((r) => (
                  <div
                    key={r.id}
                    className={`rounded p-3 text-sm border-l-2 ${
                      r.send_error
                        ? "bg-red-50 border-red-300"
                        : "bg-blue-50 border-blue-400"
                    }`}
                  >
                    <div className="text-[10px] text-slate-500 mb-1 flex items-center gap-2 flex-wrap">
                      <strong>{r.sent_by}</strong>
                      <span>· {new Date(r.sent_at).toLocaleString()}</span>
                      {r.send_error && (
                        <span className="text-red-700 inline-flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" /> Failed: {r.send_error}
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-slate-700">{r.body}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Inline reply composer */}
            {replyingId === m.id && (
              <div className="bg-white border-2 border-brand-navy rounded p-3 mb-3 space-y-2">
                <div className="text-xs text-slate-600">
                  To: <strong>{m.email}</strong>{" "}
                  <span className="text-slate-400">· From: bookings@itsalwaysfun.com (your replies route to your inbox)</span>
                </div>
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  rows={6}
                  autoFocus
                  placeholder={`Hi ${m.first_name},\n\nThanks for reaching out...`}
                  className="input font-sans"
                />
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={replyAndResolve}
                      onChange={(e) => setReplyAndResolve(e.target.checked)}
                      className="h-3.5 w-3.5"
                    />
                    Mark resolved after sending
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSendReply(m)}
                      disabled={pending || !replyBody.trim()}
                      className="bg-brand-navy text-white text-sm font-semibold rounded px-4 py-1.5 hover:bg-brand-navy-dark disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      <Send className="h-3 w-3" />
                      {pending ? "Sending..." : "Send reply"}
                    </button>
                    <button
                      onClick={() => {
                        setReplyingId(null);
                        setReplyBody("");
                      }}
                      className="text-xs text-slate-600 hover:text-slate-900 px-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">
                  💡 Plain text only — paragraphs split by blank lines. Customer
                  sees a clean email with your reply, your sign-off, and the
                  original message collapsed at the bottom.
                </p>
              </div>
            )}

            {/* Delivery audit */}
            <div className="flex flex-wrap gap-2 text-[10px] mb-3">
              <span
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
                  m.emailed_to_admin_at
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
                title={m.emailed_to_admin_at || m.email_send_error || "Not sent — no error logged"}
              >
                {m.emailed_to_admin_at ? "✓" : "✗"} Email
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
                  m.ghl_webhook_fired_at
                    ? "bg-green-100 text-green-800"
                    : m.ghl_webhook_error
                      ? "bg-red-100 text-red-800"
                      : "bg-slate-100 text-slate-600"
                }`}
                title={m.ghl_webhook_error || m.ghl_webhook_fired_at || "Not sent"}
              >
                {m.ghl_webhook_fired_at ? "✓" : m.ghl_webhook_error ? "✗" : "—"} GHL
              </span>
              {hasIssue && (
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <AlertTriangle className="h-3 w-3" /> Delivery issue — message is safe in DB
                </span>
              )}
            </div>

            {/* Show the actual email error in a banner so admin can diagnose */}
            {(m.email_send_error || m.ghl_webhook_error) && (
              <div className="text-[10px] text-red-700 bg-red-50 border border-red-200 rounded p-2 mb-3 font-mono break-all">
                {m.email_send_error && (
                  <div>
                    <strong>Email error:</strong> {m.email_send_error}
                  </div>
                )}
                {m.ghl_webhook_error && (
                  <div>
                    <strong>GHL error:</strong> {m.ghl_webhook_error}
                  </div>
                )}
              </div>
            )}

            {m.admin_notes && (
              <div className="text-xs text-slate-600 bg-blue-50 border border-blue-200 rounded p-2 mb-3">
                <strong>Notes:</strong> {m.admin_notes}
                {m.resolved_by && (
                  <span className="block text-[10px] text-slate-500 mt-1">
                    Resolved by {m.resolved_by} on{" "}
                    {m.resolved_at && new Date(m.resolved_at).toLocaleString()}
                  </span>
                )}
              </div>
            )}

            {/* Resolve inline form */}
            {isResolving && (
              <div className="bg-white border border-green-200 rounded p-3 mb-3 space-y-2">
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Resolution note (optional — e.g. 'called back, booked')"
                  className="input text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleResolve(m)}
                    disabled={pending}
                    className="bg-green-600 text-white text-sm font-semibold rounded px-3 py-1.5 hover:bg-green-700"
                  >
                    {pending ? "Saving..." : "Confirm resolved"}
                  </button>
                  <button
                    onClick={() => {
                      setResolvingId(null);
                      setNote("");
                    }}
                    className="text-xs text-slate-600 hover:text-slate-900 px-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {!m.is_resolved && !isResolving && (
                <button
                  onClick={() => {
                    setResolvingId(m.id);
                    setNote("");
                  }}
                  disabled={pending}
                  className="inline-flex items-center gap-1 border border-green-300 text-green-700 text-xs font-semibold rounded px-3 py-1.5 hover:bg-green-50"
                >
                  <Check className="h-3 w-3" /> Mark resolved
                </button>
              )}
              {m.is_resolved && isAdmin && (
                <button
                  onClick={() => handleReopen(m)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 border border-slate-300 text-slate-700 text-xs rounded px-3 py-1.5 hover:bg-slate-50"
                >
                  <RotateCcw className="h-3 w-3" /> Reopen
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => handleDelete(m)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 border border-red-300 text-red-700 text-xs rounded px-3 py-1.5 hover:bg-red-50 ml-auto"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
