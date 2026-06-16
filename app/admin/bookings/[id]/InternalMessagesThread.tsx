"use client";

// Thread interno por booking — admin/staff/driver pueden postear.
// Realtime via Supabase channel (postgres_changes en booking_internal_messages).
// @mention picker desde teammates activos.

import { useEffect, useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageSquare, Send, AtSign, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { postInternalMessage, softDeleteInternalMessage } from "./internal-messages-actions";

export interface MessageRow {
  id: string;
  body: string;
  author_user_id: string | null;
  author_name: string;
  author_role: "admin" | "staff" | "driver" | "system";
  mention_user_ids: string[];
  created_at: string;
  deleted_at: string | null;
  edited_at: string | null;
}

export interface MentionableUser {
  user_id: string;
  name: string;
  role: string;
}

const ROLE_STYLES: Record<string, string> = {
  admin:  "bg-purple-100 text-purple-800",
  staff:  "bg-blue-100 text-blue-800",
  driver: "bg-emerald-100 text-emerald-800",
  system: "bg-slate-100 text-slate-600",
};

export function InternalMessagesThread({
  bookingId,
  currentUserId,
  initialMessages,
  mentionableUsers,
}: {
  bookingId: string;
  currentUserId: string;
  initialMessages: MessageRow[];
  mentionableUsers: MentionableUser[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<MentionableUser[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerFilter, setPickerFilter] = useState("");
  const composeRef = useRef<HTMLTextAreaElement>(null);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`booking_messages:${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booking_internal_messages",
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const m = payload.new as any as MessageRow;
            setMessages((prev) => {
              if (prev.find((p) => p.id === m.id)) return prev;
              return [...prev, m];
            });
          } else if (payload.eventType === "UPDATE") {
            const m = payload.new as any as MessageRow;
            setMessages((prev) => prev.map((p) => (p.id === m.id ? m : p)));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId]);

  function addMention(user: MentionableUser) {
    if (mentions.find((m) => m.user_id === user.user_id)) return;
    setMentions((prev) => [...prev, user]);
    // Insertar @name en el body
    const insertion = `@${user.name} `;
    setBody((prev) => (prev.endsWith(" ") || prev === "" ? prev + insertion : prev + " " + insertion));
    setShowPicker(false);
    setPickerFilter("");
    composeRef.current?.focus();
  }

  function removeMention(userId: string) {
    setMentions((prev) => prev.filter((m) => m.user_id !== userId));
  }

  function submit() {
    const trimmed = body.trim();
    if (trimmed.length === 0) return;
    startTransition(async () => {
      const r = await postInternalMessage({
        booking_id: bookingId,
        body: trimmed,
        mention_user_ids: mentions.map((m) => m.user_id),
      });
      if ((r as any).error) {
        toast.error((r as any).error);
        return;
      }
      setBody("");
      setMentions([]);
      // No router.refresh — realtime trae el INSERT
    });
  }

  function softDelete(messageId: string) {
    if (!confirm("Borrar este mensaje? Queda registro pero ya no se muestra.")) return;
    startTransition(async () => {
      const r = await softDeleteInternalMessage({
        message_id: messageId,
        booking_id: bookingId,
      });
      if ((r as any).error) {
        toast.error((r as any).error);
        return;
      }
      // Realtime UPDATE va a actualizar la lista
    });
  }

  const filteredPicker = mentionableUsers.filter(
    (u) =>
      u.user_id !== currentUserId &&
      (pickerFilter === "" || u.name.toLowerCase().includes(pickerFilter.toLowerCase())),
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-slate-500" />
        <h2 className="font-bold text-slate-800">Internal team chat</h2>
        <span className="text-xs text-slate-500 ml-2">
          Visible to admin / staff / drivers assigned to this booking. Not visible to customer.
        </span>
      </div>

      {/* Thread */}
      <div className="max-h-96 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">
            No internal messages yet. Start the thread to coordinate with your team about this booking.
          </p>
        ) : (
          messages.map((m) => {
            const isDeleted = !!m.deleted_at;
            const isOwn = m.author_user_id === currentUserId;
            return (
              <div
                key={m.id}
                className={`group rounded-lg p-3 ${isOwn ? "bg-slate-50 ml-8" : "bg-white border border-slate-100 mr-8"}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-800">{m.author_name}</span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${ROLE_STYLES[m.author_role] || "bg-slate-100"}`}
                  >
                    {m.author_role}
                  </span>
                  <span className="text-xs text-slate-400">{timeAgo(m.created_at)}</span>
                  {isOwn && !isDeleted && (
                    <button
                      onClick={() => softDelete(m.id)}
                      className="ml-auto opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {isDeleted ? (
                  <p className="text-sm text-slate-400 italic">— message deleted —</p>
                ) : (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{m.body}</p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Compose */}
      <div className="border-t border-slate-100 p-3 space-y-2">
        {mentions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {mentions.map((m) => (
              <span
                key={m.user_id}
                className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-800 rounded px-2 py-1"
              >
                @{m.name}
                <button
                  onClick={() => removeMention(m.user_id)}
                  className="text-blue-600 hover:text-blue-900"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={composeRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type a message. Use @ to mention a teammate."
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm resize-none"
              rows={2}
              maxLength={4000}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            {showPicker && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                <input
                  type="text"
                  value={pickerFilter}
                  onChange={(e) => setPickerFilter(e.target.value)}
                  placeholder="Filter teammates..."
                  className="w-full border-b border-slate-100 px-3 py-2 text-sm focus:outline-none"
                  autoFocus
                />
                {filteredPicker.length === 0 ? (
                  <p className="text-xs text-slate-400 p-3 text-center">No matches</p>
                ) : (
                  filteredPicker.map((u) => (
                    <button
                      key={u.user_id}
                      type="button"
                      onClick={() => addMention(u)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between"
                    >
                      <span>{u.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${ROLE_STYLES[u.role] || "bg-slate-100"}`}>
                        {u.role}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setShowPicker((v) => !v)}
              className="rounded p-2 hover:bg-slate-100"
              title="Mention teammate"
            >
              <AtSign className="h-4 w-4 text-slate-500" />
            </button>
            <button
              onClick={submit}
              disabled={pending || body.trim().length === 0}
              className="rounded-md bg-brand-navy text-white px-3 py-2 hover:bg-brand-navy-dark disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-400">Cmd+Enter / Ctrl+Enter para enviar</p>
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
