"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save, X, Sparkles } from "lucide-react";
import { saveDriverScheduleProfile } from "./actions";

export interface DriverProfileRow {
  email: string;
  name: string;
  skills: string[];
  home_zip: string;
  weekly_max_hours: number;
  available_days: number[];
  notes: string;
}

const SKILL_SUGGESTIONS = [
  "small_inflatables",
  "large_slides",
  "trailer_pull",
  "solo_setup",
  "two_person_setup",
  "concession",
  "tables_chairs",
  "tents",
];

const DAYS = [
  { v: 0, label: "Sun" },
  { v: 1, label: "Mon" },
  { v: 2, label: "Tue" },
  { v: 3, label: "Wed" },
  { v: 4, label: "Thu" },
  { v: 5, label: "Fri" },
  { v: 6, label: "Sat" },
];

export function DriverScheduleClient({
  initialRows,
}: {
  initialRows: DriverProfileRow[];
}) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {initialRows.map((row) => (
        <DriverRow
          key={row.email}
          row={row}
          editing={editing === row.email}
          onEdit={() => setEditing(row.email)}
          onCancel={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      ))}
    </div>
  );
}

function DriverRow({
  row,
  editing,
  onEdit,
  onCancel,
  onSaved,
}: {
  row: DriverProfileRow;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [skills, setSkills] = useState<string[]>(row.skills);
  const [homeZip, setHomeZip] = useState(row.home_zip);
  const [weeklyMax, setWeeklyMax] = useState(row.weekly_max_hours);
  const [availableDays, setAvailableDays] = useState<number[]>(row.available_days);
  const [notes, setNotes] = useState(row.notes);
  const [pending, startTransition] = useTransition();

  function toggleSkill(s: string) {
    setSkills((cur) =>
      cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s],
    );
  }

  function toggleDay(d: number) {
    setAvailableDays((cur) =>
      cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort(),
    );
  }

  function save() {
    startTransition(async () => {
      const r = await saveDriverScheduleProfile({
        driver_email: row.email,
        skills,
        home_zip: homeZip.trim() || null,
        weekly_max_hours: weeklyMax,
        available_days: availableDays,
        notes: notes.trim() || null,
      });
      if ((r as any).error) {
        toast.error((r as any).error);
        return;
      }
      toast.success(`Saved profile for ${row.name}`);
      onSaved();
    });
  }

  if (!editing) {
    return (
      <div className="border border-slate-200 rounded p-3 bg-white flex flex-wrap items-center gap-3 justify-between">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800">{row.name}</div>
          <div className="text-xs text-slate-500">{row.email}</div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {row.skills.length > 0 ? (
              row.skills.map((s) => (
                <span
                  key={s}
                  className="text-[10px] bg-violet-100 text-violet-800 px-1.5 py-0.5 rounded"
                >
                  {s}
                </span>
              ))
            ) : (
              <span className="text-[10px] text-slate-400 italic">No skills set</span>
            )}
            {row.home_zip && (
              <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                ZIP {row.home_zip}
              </span>
            )}
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
              {row.weekly_max_hours}h/wk
            </span>
            {row.available_days.length > 0 && row.available_days.length < 7 && (
              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                {row.available_days.map((d) => DAYS[d].label).join(",")}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onEdit}
          className="text-sm text-violet-700 hover:text-violet-900 underline"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="border-2 border-violet-300 rounded p-4 bg-violet-50/50 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold text-slate-800">{row.name}</div>
          <div className="text-xs text-slate-500">{row.email}</div>
        </div>
        <button
          onClick={onCancel}
          disabled={pending}
          className="text-slate-500 hover:text-slate-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Skills */}
      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
          Skills <span className="font-normal normal-case text-slate-400">(what they can deliver)</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {SKILL_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSkill(s)}
              className={`text-xs px-2 py-1 rounded border ${
                skills.includes(s)
                  ? "bg-violet-600 border-violet-600 text-white"
                  : "bg-white border-slate-300 text-slate-700 hover:border-violet-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Home ZIP + weekly max */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
            Home ZIP
          </label>
          <input
            type="text"
            value={homeZip}
            onChange={(e) => setHomeZip(e.target.value)}
            maxLength={10}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:border-violet-500 outline-none"
            placeholder="32256"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
            Weekly max hours
          </label>
          <input
            type="number"
            value={weeklyMax}
            onChange={(e) => setWeeklyMax(parseInt(e.target.value) || 40)}
            min={1}
            max={168}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:border-violet-500 outline-none"
          />
        </div>
      </div>

      {/* Available days */}
      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
          Available days
        </label>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d) => (
            <button
              key={d.v}
              type="button"
              onClick={() => toggleDay(d.v)}
              className={`text-xs px-3 py-1 rounded border ${
                availableDays.includes(d.v)
                  ? "bg-amber-500 border-amber-500 text-white"
                  : "bg-white border-slate-300 text-slate-700"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 mt-1">
          Empty = available every day. Pick specific days to restrict.
        </p>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="prefers morning deliveries, don't pair with John, etc."
          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:border-violet-500 outline-none"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          disabled={pending}
          className="text-sm text-slate-600 px-3 py-1.5 hover:bg-slate-100 rounded"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={pending}
          className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded text-sm inline-flex items-center gap-1"
        >
          <Save className="h-3.5 w-3.5" />
          {pending ? "Saving…" : "Save profile"}
        </button>
      </div>

      <p className="text-[10px] text-slate-500 italic flex items-center gap-1">
        <Sparkles className="h-3 w-3" />
        Used by the AI route optimizer.
      </p>
    </div>
  );
}
