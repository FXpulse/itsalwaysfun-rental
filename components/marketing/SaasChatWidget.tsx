"use client";

// AI chat widget for getrentalflow.com (the marketing site).
// Goal: convert visitor → free trial signup. Different audience + knowledge
// from the tenant public chat (which sells bouncy houses to event customers).

import { useState, useRef, useEffect } from "react";
import { MessageCircle, Send, X, Loader2, Sparkles } from "lucide-react";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export function SaasChatWidget() {
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
      const res = await fetch("/api/chat/saas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history: messages }),
      });
      const data = await res.json();
      const answer = data.answer || data.error || "Sorry, something went wrong.";
      setMessages([...next, { role: "assistant", content: answer }]);
      if (!open) setUnread(true);
    } catch {
      setMessages([...next, { role: "assistant", content: "Connection issue. Try again in a moment, or hit /contact." }]);
    } finally {
      setBusy(false);
    }
  }

  function openPanel() {
    setOpen(true);
    setUnread(false);
    if (messages.length === 0) {
      setMessages([{
        role: "assistant",
        content:
          "Hey! 👋 I'm RentalFlow's AI assistant. I can answer anything about how the platform works — pricing, features, comparison vs Goodshuffle/Booqable, who it's for, how to get started. What kind of rental business do you run?",
      }]);
    }
  }

  const suggestions = [
    "How much does it cost?",
    "How does it compare to Goodshuffle?",
    "Is it good for bouncy house rentals?",
    "How do I sign up?",
  ];

  return (
    <>
      {/* Bubble */}
      {!open && (
        <button
          onClick={openPanel}
          className="fixed bottom-5 right-5 z-50 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-600 hover:scale-105 text-white rounded-full p-4 shadow-2xl transition-transform group"
          aria-label="Open chat"
        >
          <MessageCircle className="h-6 w-6" />
          {unread && (
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-amber-400 rounded-full ring-2 ring-white animate-pulse" />
          )}
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-md opacity-0 group-hover:opacity-100 whitespace-nowrap transition shadow-lg">
            Chat with RentalFlow
          </span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[420px] max-w-[calc(100vw-24px)] h-[620px] max-h-[calc(100vh-48px)] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-slate-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="bg-white/20 rounded-full p-1.5 shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm">RentalFlow Assistant</div>
                <div className="text-[10px] opacity-90 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300 animate-pulse"></span>
                  Online · pricing, features, demos
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
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-gradient-to-b from-slate-50 to-white">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === "user"
                      ? "bg-violet-600 text-white rounded-br-sm"
                      : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm"
                  }`}
                >
                  {m.content.split("\n").map((line, j) => (
                    <span key={j}>
                      {linkifyText(line)}
                      {j < m.content.split("\n").length - 1 && <br />}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {messages.length === 1 && (
              <div className="space-y-2 pt-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 px-1">
                  Common questions
                </div>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="block w-full text-left text-xs bg-white hover:bg-violet-50 border border-slate-200 hover:border-violet-300 rounded-lg px-3 py-2 text-slate-700 hover:text-violet-800 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
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
              placeholder="Ask anything about RentalFlow…"
              className="flex-1 text-sm border border-slate-200 rounded-full px-4 py-2 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200"
              disabled={busy}
              autoFocus
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 disabled:from-slate-300 disabled:to-slate-300 text-white rounded-full p-2 shadow"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

          {/* Footer */}
          <div className="bg-slate-50 border-t border-slate-200 px-3 py-1.5 text-[10px] text-slate-400 text-center">
            For demos or detailed questions, <a href="/contact" className="underline hover:text-violet-700">talk to the founder →</a>
          </div>
        </div>
      )}
    </>
  );
}

function linkifyText(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
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
