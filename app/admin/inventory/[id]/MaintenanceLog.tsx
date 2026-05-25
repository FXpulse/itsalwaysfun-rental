"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Wrench, DollarSign } from "lucide-react";
import { logMaintenance, deleteMaintenance } from "../actions";
import { formatCurrency } from "@/lib/utils";

interface Entry {
  id: string;
  type: string;
  description: string;
  cost_cents: number;
  performed_by: string | null;
  performed_at: string;
  notes: string | null;
}

export function MaintenanceLog({
  itemId,
  itemName,
  entries,
  typeStyles,
}: {
  itemId: string;
  itemName: string;
  entries: Entry[];
  typeStyles: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);

  const [type, setType] = useState("cleaning");
  const [description, setDescription] = useState("");
  const [costDollars, setCostDollars] = useState("0");
  const [performedAt, setPerformedAt] = useState(new Date().toISOString().split("T")[0]);
  const [performedBy, setPerformedBy] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setType("cleaning");
    setDescription("");
    setCostDollars("0");
    setPerformedAt(new Date().toISOString().split("T")[0]);
    setPerformedBy("");
    setNotes("");
    setAdding(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("Describe what was done");
      return;
    }
    const fd = new FormData();
    fd.append("inventory_item_id", itemId);
    fd.append("type", type);
    fd.append("description", description);
    fd.append("cost_dollars", costDollars || "0");
    fd.append("performed_at", performedAt);
    if (performedBy) fd.append("performed_by", performedBy);
    if (notes) fd.append("notes", notes);

    startTransition(async () => {
      const r = await logMaintenance(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Maintenance logged");
      reset();
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this maintenance entry?")) return;
    startTransition(async () => {
      const r = await deleteMaintenance(id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Deleted");
      router.refresh();
    });
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <h2 className="font-bold text-brand-navy flex items-center gap-2">
          <Wrench className="h-4 w-4" /> Maintenance history
        </h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="btn-primary text-sm inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Log entry
          </button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <form
          onSubmit={handleSubmit}
          className="bg-slate-50 rounded p-3 mb-4 space-y-3 border border-slate-200"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Type *</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="input">
                <option value="cleaning">Cleaning</option>
                <option value="repair">Repair</option>
                <option value="inspection">Inspection</option>
                <option value="replacement">Replacement</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Date *</label>
              <input
                type="date"
                required
                value={performedAt}
                onChange={(e) => setPerformedAt(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">What was done? *</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Replaced motor bearings, patched 6-inch tear"
              className="input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Cost (USD)</label>
              <div className="relative">
                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={costDollars}
                  onChange={(e) => setCostDollars(e.target.value)}
                  className="input pl-7"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Performed by</label>
              <input
                type="text"
                value={performedBy}
                onChange={(e) => setPerformedBy(e.target.value)}
                placeholder="Tech name or company"
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input"
            />
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary text-sm">
              {pending ? "Saving..." : "Save entry"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="text-sm text-slate-600 hover:text-slate-900 px-3 py-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* History */}
      {entries.length === 0 ? (
        <div className="text-center text-slate-400 py-6 text-sm border-2 border-dashed border-slate-200 rounded">
          No maintenance entries yet.
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div
              key={e.id}
              className="border border-slate-200 rounded p-3 flex items-start gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-xs rounded px-2 py-0.5 ${typeStyles[e.type] || ""}`}
                  >
                    {e.type}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(e.performed_at + "T00:00:00").toLocaleDateString()}
                  </span>
                  {e.performed_by && (
                    <span className="text-xs text-slate-500">· by {e.performed_by}</span>
                  )}
                </div>
                <p className="text-sm mt-1">{e.description}</p>
                {e.notes && (
                  <p className="text-xs text-slate-500 italic mt-1">{e.notes}</p>
                )}
              </div>
              <div className="text-right">
                {e.cost_cents > 0 && (
                  <div className="font-mono font-semibold text-slate-700">
                    {formatCurrency(e.cost_cents)}
                  </div>
                )}
                <button
                  onClick={() => handleDelete(e.id)}
                  disabled={pending}
                  className="text-red-500 hover:text-red-700 mt-1"
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
