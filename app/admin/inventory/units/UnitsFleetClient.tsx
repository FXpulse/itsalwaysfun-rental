"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { moveUnit, type UnitState } from "../unit-movement-actions";

const STATE_COLORS: Record<UnitState, string> = {
  warehouse:   "bg-emerald-100 text-emerald-800",
  loading:     "bg-blue-100 text-blue-800",
  on_truck:    "bg-indigo-100 text-indigo-800",
  at_customer: "bg-amber-100 text-amber-800",
  returning:   "bg-purple-100 text-purple-800",
  maintenance: "bg-orange-100 text-orange-800",
  retired:     "bg-slate-200 text-slate-600",
};

const VALID_TRANSITIONS: Record<UnitState, UnitState[]> = {
  warehouse:   ["loading", "on_truck", "at_customer", "maintenance", "retired"],
  loading:     ["on_truck", "warehouse", "maintenance"],
  on_truck:    ["at_customer", "warehouse", "returning", "maintenance"],
  at_customer: ["returning", "warehouse"],
  returning:   ["warehouse", "maintenance"],
  maintenance: ["warehouse", "retired"],
  retired:     [],
};

interface UnitRow {
  id: string;
  tag: string;
  serial_number: string | null;
  condition: string;
  current_state: UnitState;
  current_booking_id: string | null;
  state_changed_at: string;
  inventory_item: { id: string; name: string } | null;
}

export function UnitsFleetClient({ units }: { units: UnitRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [moving, setMoving] = useState<{ unit: UnitRow; targetState: UnitState } | null>(null);
  const [notes, setNotes] = useState("");
  const [inspectorName, setInspectorName] = useState("");

  function openTransition(unit: UnitRow, targetState: UnitState) {
    setMoving({ unit, targetState });
    setNotes("");
    setInspectorName("");
  }

  function confirmTransition() {
    if (!moving) return;
    startTransition(async () => {
      const r = await moveUnit({
        unit_id: moving.unit.id,
        to_state: moving.targetState,
        booking_id: moving.unit.current_booking_id ?? null,
        notes: notes.trim() || null,
        performed_by_name: inspectorName.trim() || null,
      });
      if ((r as any).error) {
        toast.error((r as any).error);
        return;
      }
      toast.success(`${moving.unit.tag}: ${moving.unit.current_state} → ${moving.targetState}`);
      setMoving(null);
      router.refresh();
    });
  }

  if (units.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-12 text-center text-slate-500">
        No units in this filter.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Condition</th>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3">Since</th>
              <th className="px-4 py-3 text-right">Move to →</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {units.map((u) => {
              const allowed = VALID_TRANSITIONS[u.current_state] || [];
              return (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-mono font-medium">{u.tag}</td>
                  <td className="px-4 py-3 text-slate-700">{u.inventory_item?.name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${conditionPillClass(u.condition)}`}>
                      {u.condition.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded font-medium capitalize ${STATE_COLORS[u.current_state]}`}>
                      {u.current_state.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {timeAgo(u.state_changed_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1 flex-wrap justify-end">
                      {allowed.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">terminal</span>
                      ) : (
                        allowed.map((s) => (
                          <button
                            key={s}
                            onClick={() => openTransition(u, s)}
                            className={`text-xs px-2 py-1 rounded ${STATE_COLORS[s]} hover:ring-2 hover:ring-offset-1`}
                            title={`Move to ${s}`}
                          >
                            {s.replace("_", " ")}
                          </button>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {moving && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="font-bold text-lg text-slate-800 mb-1">
              Move {moving.unit.tag}
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              <span className={`text-xs px-2 py-0.5 rounded ${STATE_COLORS[moving.unit.current_state]}`}>
                {moving.unit.current_state.replace("_", " ")}
              </span>{" "}
              →{" "}
              <span className={`text-xs px-2 py-0.5 rounded ${STATE_COLORS[moving.targetState]}`}>
                {moving.targetState.replace("_", " ")}
              </span>
            </p>

            <input
              type="text"
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              placeholder="Performed by (driver/admin)"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm mb-3"
              maxLength={120}
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional) — e.g. 'cleaning after spilled drink'"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              rows={3}
              maxLength={500}
            />

            <div className="flex gap-2 justify-end mt-4">
              <button
                onClick={() => setMoving(null)}
                disabled={pending}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmTransition}
                disabled={pending}
                className="rounded-md bg-brand-navy text-white px-4 py-2 text-sm font-medium hover:bg-brand-navy-dark disabled:opacity-50"
              >
                {pending ? "Moving..." : "Confirm move"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function conditionPillClass(c: string): string {
  return (
    {
      good: "bg-green-100 text-green-800",
      needs_repair: "bg-amber-100 text-amber-800",
      broken: "bg-red-100 text-red-800",
      retired: "bg-slate-200 text-slate-600",
    } as Record<string, string>
  )[c] || "bg-slate-100 text-slate-600";
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
