"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Circle, AlertCircle, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import type { ChecklistItemStatus, ChecklistCategory } from "@/lib/superadmin/tenant-checklist";
import { toggleChecklistItem, updateChecklistItemNotes } from "./actions";

type Props = {
  tenantId: string;
  category: ChecklistCategory;
  categoryLabel: string;
  items: ChecklistItemStatus[];
};

export function ChecklistByCategory({ tenantId, category, categoryLabel, items }: Props) {
  const [open, setOpen] = useState(items.some((i) => !i.is_completed));
  const completed = items.filter((i) => i.is_completed).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const allDone = completed === total;

  return (
    <div className={`card overflow-hidden ${allDone ? "bg-emerald-50 border-emerald-200" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          <span className="text-2xl">{categoryIcon(category)}</span>
          <div className="text-left">
            <div className="font-bold text-brand-navy">{categoryLabel}</div>
            <div className="text-xs text-slate-500">{completed} of {total} done</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${allDone ? "bg-emerald-500" : "bg-brand-navy"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={`text-sm font-bold ${allDone ? "text-emerald-700" : "text-slate-700"}`}>{pct}%</span>
        </div>
      </button>

      {open && (
        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {items.map((item) => (
            <ChecklistRow key={item.item.key} tenantId={tenantId} result={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChecklistRow({ tenantId, result }: { tenantId: string; result: ChecklistItemStatus }) {
  const [isPending, startTransition] = useTransition();
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(result.notes || "");
  const [savedNotes, setSavedNotes] = useState(result.notes || "");

  const item = result.item;
  const isAuto = !item.manualOnly;
  const completed = result.is_completed;

  function handleToggle() {
    if (isAuto) return; // Auto-detect items can't be manually toggled
    startTransition(async () => {
      await toggleChecklistItem(tenantId, item.key, !completed, notes);
    });
  }

  function handleNotesSave() {
    if (notes === savedNotes) return;
    startTransition(async () => {
      await updateChecklistItemNotes(tenantId, item.key, notes);
      setSavedNotes(notes);
    });
  }

  return (
    <div className={`p-4 flex items-start gap-3 ${completed ? "bg-emerald-50/40" : ""}`}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending || isAuto}
        className={`mt-0.5 shrink-0 ${isAuto ? "cursor-default" : "cursor-pointer hover:scale-110"} transition`}
        title={isAuto ? "Auto-detected from system state" : "Click to toggle"}
      >
        {completed ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        ) : item.required ? (
          <AlertCircle className="h-5 w-5 text-amber-500" />
        ) : (
          <Circle className="h-5 w-5 text-slate-300" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <div className={`font-semibold text-sm ${completed ? "text-emerald-900" : "text-slate-800"}`}>
              {item.label}
              {item.required && !completed && (
                <span className="ml-2 text-[10px] uppercase tracking-wider font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                  Required
                </span>
              )}
              {isAuto && (
                <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                  <Sparkles className="h-2.5 w-2.5" /> Auto
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowNotes(!showNotes)}
            className="text-[11px] text-indigo-600 hover:text-indigo-800 shrink-0"
          >
            {showNotes ? "Hide notes" : savedNotes ? "View/edit notes" : "+ Add notes"}
          </button>
        </div>

        {showNotes && (
          <div className="mt-2 space-y-1">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesSave}
              rows={2}
              placeholder="Operator notes for this item..."
              className="w-full text-xs border border-slate-200 rounded p-2 focus:ring-1 focus:ring-indigo-500"
            />
            {notes !== savedNotes && (
              <button
                type="button"
                onClick={handleNotesSave}
                disabled={isPending}
                className="text-[10px] text-indigo-600 font-semibold"
              >
                {isPending ? "Saving..." : "Save notes"}
              </button>
            )}
          </div>
        )}

        {completed && result.completed_at && (
          <p className="text-[10px] text-emerald-700 mt-1">
            ✓ {isAuto ? "Detected" : "Marked complete"} {new Date(result.completed_at).toLocaleDateString()}
            {result.completed_by_email && !isAuto && ` by ${result.completed_by_email}`}
          </p>
        )}
      </div>
    </div>
  );
}

function categoryIcon(c: ChecklistCategory): string {
  const map: Record<ChecklistCategory, string> = {
    account: "👤",
    catalog: "📦",
    inventory: "📊",
    fleet: "🚚",
    payments: "💳",
    public_site: "🌐",
    team: "👥",
    communication: "📧",
    legal: "⚖️",
    operations: "⚙️",
    marketing: "📣",
    operator_intel: "🎯",
  };
  return map[c] || "📋";
}
