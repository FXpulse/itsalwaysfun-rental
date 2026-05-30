"use client";

// Tenant-side AI assistant — same UX as superadmin bubble but hits
// /api/admin/assistant which is scoped to the calling tenant.

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, Send, X, Loader2, Mic, MicOff } from "lucide-react";

interface Msg { role: "user" | "assistant"; content: string; tools_called?: any[] }

export function AdminAssistantBubble() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  // Hide on login, public site, driver views — only show in /admin (not nested superadmin)
  if (!pathname?.startsWith("/admin") || pathname?.endsWith("/admin/login")) return null;

  function toggleVoice() {
    if (listening) { recognitionRef.current?.stop(); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return alert("Tu navegador no soporta voice input. Usá Chrome/Edge.");
    const rec = new SR();
    rec.lang = navigator.language?.startsWith("es") ? "es-ES" : "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onstart = () => setListening(true);
    rec.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join("");
      setInput(t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
  }

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history: messages }),
      });
      const data = await res.json();
      setMessages([...next, {
        role: "assistant",
        content: data.answer || data.error || "(empty)",
        tools_called: data.tools_called,
      }]);
    } catch (e: any) {
      setMessages([...next, { role: "assistant", content: `Error: ${e?.message || "unknown"}` }]);
    } finally {
      setBusy(false);
    }
  }

  const examples = [
    "¿Cuántas reservas tengo este mes?",
    "What's my busiest day in the last 90 days?",
    "Top 3 products by bookings",
    "¿Cuánto facturé en los últimos 30 días?",
  ];

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white rounded-full p-4 shadow-2xl hover:scale-110 transition-transform group"
          aria-label="Open business assistant"
        >
          <Sparkles className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 h-3 w-3 bg-amber-400 rounded-full ring-2 ring-white animate-pulse" />
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 whitespace-nowrap transition">
            Ask your business
          </span>
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-24px)] h-[560px] max-h-[calc(100vh-48px)] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-slate-200">
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <div>
                <div className="font-bold text-sm">Business assistant</div>
                <div className="text-[10px] text-emerald-100">Knows your live business data</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="hover:bg-white/20 rounded p-1"><X className="h-4 w-4" /></button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
            {messages.length === 0 && (
              <div className="text-center pt-6">
                <div className="text-xs text-slate-500 mb-3">Probá preguntando…</div>
                <div className="space-y-2">
                  {examples.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setInput(ex)}
                      className="block w-full text-left text-xs bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-lg px-3 py-2 text-slate-700 transition"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-emerald-600 text-white rounded-br-sm"
                    : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm"
                }`}>
                  {m.content}
                </div>
                {m.tools_called && m.tools_called.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1 max-w-[85%]">
                    {m.tools_called.map((tc, j) => (
                      <span key={j} className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">
                        🔍 {tc.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                </div>
              </div>
            )}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="border-t border-slate-200 bg-white p-2 flex items-center gap-2">
            <button
              type="button"
              onClick={toggleVoice}
              disabled={busy}
              className={`rounded-full p-2 transition ${listening ? "bg-rose-500 text-white animate-pulse" : "bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"}`}
              aria-label="Speak"
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={listening ? "Listening…" : "Pregúntale sobre tu negocio…"}
              className="flex-1 text-sm border border-slate-200 rounded-full px-3 py-2 focus:outline-none focus:border-emerald-400"
              disabled={busy}
            />
            <button type="submit" disabled={busy || !input.trim()} className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-full p-2">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
