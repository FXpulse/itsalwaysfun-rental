"use client";

import { useState, useTransition } from "react";
import { MessageSquare, Plus, CheckCircle2, Trash2, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { addOperatorNote, resolveOperatorNote, deleteOperatorNote } from "./actions";

type Note = {
  id: string;
  note_type: string;
  subject?: string | null;
  body: string;
  follow_up_date?: string | null;
  is_resolved: boolean;
  resolved_at?: string | null;
  created_at: string;
  created_by_email?: string | null;
};

const NOTE_TYPES = [
  { key: "call", label: "📞 Call", color: "indigo" },
  { key: "email", label: "📧 Email", color: "sky" },
  { key: "issue", label: "⚠️ Issue", color: "amber" },
  { key: "win", label: "🎉 Win", color: "emerald" },
  { key: "todo", label: "📝 To-do", color: "violet" },
  { key: "internal", label: "💭 Internal", color: "slate" },
];

export function NotesTimeline({ tenantId, notes }: { tenantId: string; notes: Note[] }) {
  const [open, setOpen] = useState(notes.length > 0);
  const [showForm, setShowForm] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const unresolved = notes.filter((n) => !n.is_resolved);
  const resolved = notes.filter((n) => n.is_resolved);

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-violet-600" />
          <div className="text-left">
            <div className="font-bold text-brand-navy">Notes & Activity Timeline</div>
            <div className="text-xs text-slate-500">
              {unresolved.length} open · {resolved.length} resolved · {notes.length} total
            </div>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 p-4 space-y-3">
          {showForm ? (
            <AddNoteForm
              tenantId={tenantId}
              onDone={() => setShowForm(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="text-sm bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-lg px-3 py-2 inline-flex items-center gap-1"
            >
              <Plus className="h-4 w-4" /> Add note
            </button>
          )}

          {unresolved.length === 0 && resolved.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-6">
              No notes yet. Add the first one above to track calls, issues, follow-ups…
            </p>
          ) : (
            <>
              {/* Open notes */}
              <div className="space-y-2">
                {unresolved.map((n) => (
                  <NoteCard key={n.id} note={n} tenantId={tenantId} />
                ))}
              </div>

              {/* Resolved */}
              {resolved.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowResolved(!showResolved)}
                    className="text-xs text-slate-500 hover:text-slate-700 font-semibold"
                  >
                    {showResolved ? "Hide" : "Show"} {resolved.length} resolved
                  </button>
                  {showResolved && (
                    <div className="space-y-2 mt-2 opacity-60">
                      {resolved.map((n) => (
                        <NoteCard key={n.id} note={n} tenantId={tenantId} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function NoteCard({ note, tenantId }: { note: Note; tenantId: string }) {
  const [isPending, startTransition] = useTransition();
  const typeMeta = NOTE_TYPES.find((t) => t.key === note.note_type) || NOTE_TYPES[5];
  const overdue = note.follow_up_date && !note.is_resolved && new Date(note.follow_up_date) < new Date();

  return (
    <div className={`border rounded-lg p-3 text-sm ${
      note.is_resolved ? "border-slate-200 bg-slate-50"
        : overdue ? "border-rose-300 bg-rose-50"
        : "border-slate-200 bg-white"
    }`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs">
          <span className={`font-bold bg-${typeMeta.color}-100 text-${typeMeta.color}-700 px-2 py-0.5 rounded`}>
            {typeMeta.label}
          </span>
          {note.subject && <span className="font-semibold text-slate-800">{note.subject}</span>}
          {overdue && <span className="text-rose-700 font-bold">OVERDUE</span>}
        </div>
        <div className="flex items-center gap-1">
          {!note.is_resolved && (
            <button
              type="button"
              onClick={() => startTransition(() => resolveOperatorNote(note.id, tenantId).then())}
              disabled={isPending}
              className="text-emerald-600 hover:text-emerald-800 p-1"
              title="Mark resolved"
            >
              <CheckCircle2 className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (confirm("Delete this note?")) {
                startTransition(() => deleteOperatorNote(note.id, tenantId).then());
              }
            }}
            disabled={isPending}
            className="text-rose-500 hover:text-rose-700 p-1"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p className="text-sm text-slate-700 whitespace-pre-wrap mt-1">{note.body}</p>
      <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
        <span>{new Date(note.created_at).toLocaleString()}</span>
        {note.created_by_email && <span>· {note.created_by_email}</span>}
        {note.follow_up_date && (
          <span className={`inline-flex items-center gap-1 ${overdue ? "text-rose-700 font-bold" : ""}`}>
            <Calendar className="h-3 w-3" /> Follow-up {new Date(note.follow_up_date).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

function AddNoteForm({ tenantId, onDone }: { tenantId: string; onDone: () => void }) {
  const [type, setType] = useState("call");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function submit() {
    if (!body.trim()) {
      setError("Body is required");
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await addOperatorNote(tenantId, {
        note_type: type,
        subject,
        body,
        follow_up_date: followUp || undefined,
      });
      if ((res as any).error) {
        setError((res as any).error);
        return;
      }
      setSubject(""); setBody(""); setFollowUp(""); setType("call");
      onDone();
    });
  }

  return (
    <div className="border-2 border-violet-300 rounded-lg p-3 bg-violet-50 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 w-full border border-slate-200 rounded p-2 text-sm bg-white"
          >
            {NOTE_TYPES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Follow-up (optional)</span>
          <input
            type="date"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            className="mt-1 w-full border border-slate-200 rounded p-2 text-sm"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Subject (optional)</span>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Onboarding call #2"
          className="mt-1 w-full border border-slate-200 rounded p-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Note *</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="What happened? What's next?"
          className="mt-1 w-full border border-slate-200 rounded p-2 text-sm"
        />
      </label>
      {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded px-4 py-2 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save note"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-sm text-slate-600 hover:text-slate-800 px-3"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
