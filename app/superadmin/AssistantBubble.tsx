"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, Send, X, Loader2 } from "lucide-react";

interface Msg { role: "user" | "assistant"; content: string; }

export function AssistantBubble() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/superadmin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history: messages }),
      });
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.answer || data.error || "(empty)" }]);
    } catch (e: any) {
      setMessages([...next, { role: "assistant", content: `Error: ${e?.message || "unknown"}` }]);
    } finally {
      setBusy(false);
    }
  }

  // Hide on login page — no auth context there.
  if (pathname?.endsWith("/superadmin/login")) return null;

  const examples = [
    "How many tenants are past_due?",
    "What's the most urgent ticket right now?",
    "Resumen del estado del SaaS",
    "Who signed up this week?",
  ];

  return (
    <>
      {/* Bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open AI Assistant"
          className="fixed bottom-6 right-6 z-50 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500 text-white rounded-full p-4 shadow-2xl hover:scale-110 transition-transform group"
        >
          <Sparkles className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 h-3 w-3 bg-emerald-400 rounded-full ring-2 ring-white animate-pulse" />
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 whitespace-nowrap transition">
            Ask AI
          </span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-24px)] h-[560px] max-h-[calc(100vh-48px)] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-slate-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-600 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <div>
                <div className="font-bold text-sm">AI Operator</div>
                <div className="text-[10px] text-fuchsia-100">Knows your live platform state</div>
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
            {messages.length === 0 && (
              <div className="text-center pt-6">
                <div className="text-xs text-slate-500 mb-3">Try asking…</div>
                <div className="space-y-2">
                  {examples.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setInput(ex)}
                      className="block w-full text-left text-xs bg-white hover:bg-violet-50 border border-slate-200 hover:border-violet-300 rounded-lg px-3 py-2 text-slate-700 transition"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-violet-600 text-white rounded-br-sm"
                      : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
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
              placeholder="Ask anything about the platform…"
              className="flex-1 text-sm border border-slate-200 rounded-full px-3 py-2 focus:outline-none focus:border-violet-400"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white rounded-full p-2"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
