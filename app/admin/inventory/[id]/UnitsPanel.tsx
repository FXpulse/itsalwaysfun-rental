"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Hash,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Truck,
} from "lucide-react";
import {
  bulkGenerateUnits,
  createUnit,
  updateUnit,
  deleteUnit,
  setTracksUnits,
} from "./units-actions";

export interface UnitRow {
  id: string;
  tag: string;
  serial_number: string | null;
  condition: "good" | "needs_repair" | "broken" | "retired";
  notes: string | null;
  acquired_date: string | null;
  retired_at: string | null;
  is_active: boolean;
  // Joined: current active assignment, if any
  current_route_id: string | null;
  current_route_date: string | null;
}

const COND_STYLES: Record<string, string> = {
  good: "bg-green-100 text-green-800",
  needs_repair: "bg-amber-100 text-amber-800",
  broken: "bg-red-100 text-red-800",
  retired: "bg-slate-200 text-slate-600",
};

export function UnitsPanel({
  itemId,
  itemName,
  tracksUnits,
  prefixSuggestion,
  units,
}: {
  itemId: string;
  itemName: string;
  tracksUnits: boolean;
  prefixSuggestion: string;
  units: UnitRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<UnitRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [bulkPrefix, setBulkPrefix] = useState(prefixSuggestion);
  const [bulkCount, setBulkCount] = useState("");

  function refresh() {
    router.refresh();
  }

  function handleToggleTracking() {
    startTransition(async () => {
      const r = await setTracksUnits(itemId, !tracksUnits);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(tracksUnits ? "Unit tracking disabled" : "Unit tracking enabled");
      refresh();
    });
  }

  function handleBulkGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!bulkPrefix.trim() || !bulkCount) return;
    const fd = new FormData();
    fd.append("item_id", itemId);
    fd.append("prefix", bulkPrefix.trim());
    fd.append("count", bulkCount);
    startTransition(async () => {
      const r = await bulkGenerateUnits(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Created ${r.inserted} units (${bulkPrefix.toUpperCase()}-...)`);
      setBulk(false);
      setBulkCount("");
      refresh();
    });
  }

  function handleSave(formData: FormData) {
    startTransition(async () => {
      const r = editing
        ? await updateUnit(editing.id, itemId, formData)
        : await createUnit(itemId, formData);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(editing ? "Unit updated" : "Unit created");
      setEditing(null);
      setCreating(false);
      refresh();
    });
  }

  function handleDelete(u: UnitRow) {
    if (!confirm(`Delete ${u.tag}? Cannot undo. (Use "Retire" instead to keep history.)`)) return;
    startTransition(async () => {
      const r = await deleteUnit(u.id, itemId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Deleted");
      refresh();
    });
  }

  if (!tracksUnits && units.length === 0) {
    return (
      <div className="card mb-6 bg-slate-50">
        <h2 className="font-bold text-brand-navy mb-2 flex items-center gap-2">
          <Hash className="h-4 w-4" /> Individual unit tracking
        </h2>
        <p className="text-sm text-slate-600 mb-3">
          Right now this item is tracked as a single bucket count. If you want
          to track each physical unit separately (so you know which one was on
          which truck, which one has the cracked housing, etc.), enable
          per-unit tracking.
        </p>
        <p className="text-xs text-slate-500 mb-3">
          💡 Worth doing for: blowers, generators, large bouncers, tools. Not
          worth doing for: sandbags, cables, consumables.
        </p>
        <button
          onClick={handleToggleTracking}
          disabled={pending}
          className="btn-primary inline-flex items-center gap-2"
        >
          <ToggleRight className="h-4 w-4" /> Enable unit tracking
        </button>
      </div>
    );
  }

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-bold text-brand-navy flex items-center gap-2">
            <Hash className="h-4 w-4" /> Individual units ({units.length})
          </h2>
          <p className="text-xs text-slate-500">
            Each physical unit has a tag so you can track which one went where.
          </p>
        </div>
        <button
          onClick={handleToggleTracking}
          disabled={pending}
          className="text-xs text-slate-500 hover:text-brand-navy inline-flex items-center gap-1"
          title="Disable per-unit tracking (units remain in DB)"
        >
          <ToggleLeft className="h-3 w-3" /> Disable tracking
        </button>
      </div>

      {/* Add / bulk add buttons */}
      {!creating && !editing && !bulk && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setCreating(true)}
            className="btn-primary inline-flex items-center gap-1 text-sm"
          >
            <Plus className="h-3 w-3" /> Add one unit
          </button>
          <button
            onClick={() => setBulk(true)}
            className="inline-flex items-center gap-1 border border-slate-300 rounded px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            <Sparkles className="h-3 w-3" /> Bulk add (auto-tag)
          </button>
        </div>
      )}

      {/* Bulk add form */}
      {bulk && (
        <form
          onSubmit={handleBulkGenerate}
          className="bg-blue-50 border border-blue-200 rounded p-3 mb-4 space-y-2"
        >
          <p className="text-xs text-blue-900">
            Creates units numbered <code>PREFIX-01</code>, <code>PREFIX-02</code>, ...
            up to the count. Useful for first-time setup of "14 blowers".
          </p>
          <div className="flex gap-2 items-end">
            <div className="w-28">
              <label className="block text-xs text-slate-600 mb-1">Prefix</label>
              <input
                type="text"
                value={bulkPrefix}
                onChange={(e) => setBulkPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                placeholder="BLW"
                maxLength={10}
                className="input font-mono uppercase"
                required
              />
            </div>
            <div className="w-24">
              <label className="block text-xs text-slate-600 mb-1">How many?</label>
              <input
                type="number"
                value={bulkCount}
                onChange={(e) => setBulkCount(e.target.value)}
                min={1}
                max={200}
                placeholder="14"
                className="input"
                required
              />
            </div>
            <div className="flex-1 text-xs text-slate-500 pb-2">
              Will create{" "}
              {bulkPrefix && bulkCount ? (
                <strong>
                  {bulkPrefix.toUpperCase()}-01 …{" "}
                  {bulkPrefix.toUpperCase()}-{String(parseInt(bulkCount, 10) || 0).padStart(2, "0")}
                </strong>
              ) : (
                "..."
              )}
            </div>
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setBulk(false)}
              className="text-xs text-slate-600 hover:text-slate-900 px-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Single create / edit form */}
      {(creating || editing) && (
        <form
          action={handleSave}
          className="bg-slate-50 border border-slate-200 rounded p-3 mb-4 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Tag *</label>
              <input
                name="tag"
                required
                defaultValue={editing?.tag || ""}
                className="input font-mono uppercase"
                placeholder={`${prefixSuggestion}-15`}
                maxLength={50}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Serial number</label>
              <input
                name="serial_number"
                defaultValue={editing?.serial_number || ""}
                className="input font-mono"
                placeholder="(optional, from manufacturer)"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Condition</label>
              <select
                name="condition"
                defaultValue={editing?.condition || "good"}
                className="input"
              >
                <option value="good">Good</option>
                <option value="needs_repair">Needs repair</option>
                <option value="broken">Broken</option>
                <option value="retired">Retired</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Acquired date</label>
              <input
                name="acquired_date"
                type="date"
                defaultValue={editing?.acquired_date || ""}
                className="input"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-600 mb-1">Notes</label>
              <textarea
                name="notes"
                rows={2}
                defaultValue={editing?.notes || ""}
                className="input"
                placeholder="Anything specific about this unit (cracked housing, custom mod, etc.)"
              />
            </div>
            <div className="col-span-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  name="is_active"
                  type="checkbox"
                  defaultChecked={editing ? editing.is_active : true}
                  className="h-4 w-4"
                />
                Active (available for dispatch)
              </label>
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t">
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? "Saving..." : editing ? "Save changes" : "Create unit"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
              className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Units list */}
      {units.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-6">
          No units yet — add one or use "Bulk add" to create several at once.
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">Tag</th>
                <th className="px-3 py-2 text-left">Serial</th>
                <th className="px-3 py-2 text-left">Condition</th>
                <th className="px-3 py-2 text-left">Notes</th>
                <th className="px-3 py-2 text-left">On route</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {units.map((u) => (
                <tr key={u.id} className={!u.is_active ? "bg-slate-50 opacity-60" : ""}>
                  <td className="px-3 py-2 font-mono font-bold text-brand-navy">{u.tag}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">
                    {u.serial_number || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs rounded px-2 py-0.5 ${COND_STYLES[u.condition]}`}>
                      {u.condition.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500 max-w-[200px] truncate" title={u.notes || ""}>
                    {u.notes || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {u.current_route_id ? (
                      <a
                        href={`/admin/dispatch/${u.current_route_date}`}
                        className="inline-flex items-center gap-1 text-amber-700 font-semibold hover:underline"
                      >
                        <Truck className="h-3 w-3" /> {u.current_route_date}
                      </a>
                    ) : (
                      <span className="text-slate-300">available</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right space-x-1">
                    <button
                      onClick={() => {
                        setEditing(u);
                        setCreating(false);
                      }}
                      className="p-1 text-slate-600 hover:text-brand-navy"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      className="p-1 text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
