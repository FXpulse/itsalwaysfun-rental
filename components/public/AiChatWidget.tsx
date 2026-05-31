"use client";

// Floating AI chat widget for the public site. Replaces the GHL chat.
// Pulls answers from products + FAQs + business info + policies via the
// /api/chat/public endpoint. Tenants can opt out via site_settings if needed.

import { useState, useRef, useEffect } from "react";
import { MessageCircle, Send, X, Loader2, Sparkles } from "lucide-react";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  businessName: string;
  brandColor?: string;       // hex for header (defaults to brand navy via Tailwind class)
}

export function AiChatWidget({ businessName, brandColor }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [unread, setUnread] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  async function send(textOverride?: string) {
    const q = (textOverride ?? input).trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history: messages }),
      });
      const data = await res.json();
      const answer = data.answer || data.error || "Sorry, something went wrong.";
      setMessages([...next, { role: "assistant", content: answer }]);
      if (!open) setUnread(true);
    } catch {
      setMessages([...next, { role: "assistant", content: "Connection error. Try again in a moment." }]);
    } finally {
      setBusy(false);
    }
  }

  function openPanel() {
    setOpen(true);
    setUnread(false);
    // Seed a greeting on first open
    if (messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: `Hi! I'm ${businessName}'s booking assistant. Looking for a specific rental, a date, or have a question? I'll find it for you.`,
      }]);
    }
  }

  const headerStyle: React.CSSProperties = brandColor
    ? { background: brandColor }
    : {};

  // Quick reply suggestions for empty state
  const suggestions = [
    "What's available this Saturday?",
    "Show me bounce houses",
    "What's your cancellation policy?",
    "How do I book?",
  ];

  return (
    <>
      {/* Bubble */}
      {!open && (
        <button
          onClick={openPanel}
          className="fixed bottom-5 right-5 z-50 bg-brand-navy hover:bg-brand-navy-dark text-white rounded-full p-4 shadow-2xl hover:scale-105 transition-transform group"
          style={headerStyle}
          aria-label="Open chat"
        >
          <MessageCircle className="h-6 w-6" />
          {unread && (
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-rose-500 rounded-full ring-2 ring-white animate-pulse" />
          )}
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-md opacity-0 group-hover:opacity-100 whitespace-nowrap transition shadow-lg">
            Chat with us
          </span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[400px] max-w-[calc(100vw-24px)] h-[600px] max-h-[calc(100vh-48px)] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-slate-200">
          {/* Header */}
          <div
            className="bg-brand-navy text-white px-4 py-3 flex items-center justify-between"
            style={headerStyle}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="bg-white/20 rounded-full p-1.5 shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm truncate">{businessName}</div>
                <div className="text-[10px] opacity-80 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Online — instant answers
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="hover:bg-white/20 rounded p-1"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === "user"
                      ? "bg-brand-navy text-white rounded-br-sm"
                      : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm"
                  }`}
                  style={m.role === "user" && brandColor ? { background: brandColor } : undefined}
                >
                  {m.content.split("\n").map((line, j) => (
                    <span key={j}>
                      {linkifyText(line)}
                      <br />
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {messages.length === 1 && (
              <div className="space-y-2 pt-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 px-1">
                  Try asking
                </div>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="block w-full text-left text-xs bg-white hover:bg-brand-navy hover:text-white border border-slate-200 hover:border-brand-navy rounded-lg px-3 py-2 text-slate-700 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="border-t border-slate-200 bg-white p-2 flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question…"
              className="flex-1 text-sm border border-slate-200 rounded-full px-4 py-2 focus:outline-none focus:border-brand-navy"
              disabled={busy}
              autoFocus
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="bg-brand-navy hover:bg-brand-navy-dark disabled:bg-slate-300 text-white rounded-full p-2"
              style={input.trim() && !busy && brandColor ? { background: brandColor } : undefined}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

          {/* Powered-by line */}
          <div className="bg-slate-50 border-t border-slate-200 px-3 py-1.5 text-[10px] text-slate-400 text-center">
            AI assistant · For complex questions, <a href="/contact" className="underline">contact us</a>
          </div>
        </div>
      )}
    </>
  );
}

// Auto-linkify URLs and /paths so customers can tap to navigate
function linkifyText(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Match /admin-style paths and full URLs
  const regex = /((?:https?:\/\/[^\s)]+)|(?:\/[a-z][a-z0-9/_-]*(?:\?[^\s)]*)?))/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }
    const url = match[0];
    parts.push(
      <a
        key={key++}
        href={url}
        target={url.startsWith("http") ? "_blank" : undefined}
        rel="noopener noreferrer"
        className="underline font-semibold hover:opacity-80"
      >
        {url}
      </a>,
    );
    lastIndex = match.index + url.length;
  }
  if (lastIndex < text.length) parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  return parts.length > 0 ? <>{parts}</> : text;
}
