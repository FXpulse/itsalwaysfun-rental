"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Hash, X, Check } from "lucide-react";
import { assignUnitsToRoute, unassignUnitsFromRoute } from "../actions";

export interface UnitOption {
  unit_id: string;
  tag: string;
  condition: string;
  // If assigned to ANOTHER route on a different date, surfaces a warning
  blocked_on_other_route_id: string | null;
  blocked_on_other_route_date: string | null;
}

interface Props {
  routeId: string;
  inventoryItemId: string;
  inventoryItemName: string;
  quantityNeeded: number;
  assignedUnits: { unit_id: string; tag: string; condition: string }[];
  availableUnits: UnitOption[]; // includes those assigned to OTHER routes (flagged)
}

const COND_DOT: Record<string, string> = {
  good: "bg-green-500",
  needs_repair: "bg-amber-500",
  broken: "bg-red-500",
  retired: "bg-slate-400",
};

export function RouteUnitAssignment({
  routeId,
  inventoryItemId,
  inventoryItemName,
  quantityNeeded,
  assignedUnits,
  availableUnits,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(
    new Set(assignedUnits.map((u) => u.unit_id)),
  );

  const enough = selected.size >= quantityNeeded;

  function toggle(unitId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  }

  function save() {
    const currentlyAssigned = new Set(assignedUnits.map((u) => u.unit_id));
    const toAssign = Array.from(selected).filter((id) => !currentlyAssigned.has(id));
    const toUnassign = Array.from(currentlyAssigned).filter((id) => !selected.has(id));

    startTransition(async () => {
      if (toUnassign.length > 0) {
        const r = await unassignUnitsFromRoute(routeId, toUnassign);
        if (r.error) {
          toast.error(r.error);
          return;
        }
      }
      if (toAssign.length > 0) {
        const r = await assignUnitsToRoute(routeId, toAssign);
        if (r.error) {
          toast.error(r.error);
          return;
        }
      }
      toast.success(`Units updated for ${inventoryItemName}`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap mt-1">
        {assignedUnits.length === 0 ? (
          <span className="text-[10px] text-slate-400 italic">no units picked</span>
        ) : (
          assignedUnits.map((u) => (
            <span
              key={u.unit_id}
              className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 font-mono text-[10px] rounded px-1.5 py-0.5"
              title={`Condition: ${u.condition}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${COND_DOT[u.condition]}`} />
              {u.tag}
            </span>
          ))
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[10px] text-brand-navy hover:underline inline-flex items-center gap-0.5"
        >
          <Hash className="h-2.5 w-2.5" />
          {assignedUnits.length > 0 ? "Edit picks" : "Pick units"}
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-brand-navy">
                  Pick units — {inventoryItemName}
                </h3>
                <p className="text-xs text-slate-500">
                  Need <strong>{quantityNeeded}</strong> · selected{" "}
                  <strong className={enough ? "text-green-700" : "text-amber-700"}>
                    {selected.size}
                  </strong>
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-200 rounded">
              {availableUnits.length === 0 ? (
                <div className="text-center text-slate-400 text-sm py-8 px-3">
                  No units configured for this item yet. Go to{" "}
                  <a
                    href={`/admin/inventory/${inventoryItemId}`}
                    className="text-brand-navy underline"
                  >
                    Inventory → {inventoryItemName}
                  </a>{" "}
                  and bulk-add units.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {availableUnits.map((u) => {
                    const isSelected = selected.has(u.unit_id);
                    const isBlocked = u.blocked_on_other_route_id !== null;
                    return (
                      <li key={u.unit_id}>
                        <label
                          className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50 ${
                            isBlocked && !isSelected ? "opacity-50" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggle(u.unit_id)}
                            className="h-4 w-4"
                          />
                          <span className={`h-2 w-2 rounded-full ${COND_DOT[u.condition]}`} />
                          <span className="font-mono font-bold text-sm flex-1">{u.tag}</span>
                          <span className="text-[10px] text-slate-500 capitalize">
                            {u.condition.replace("_", " ")}
                          </span>
                          {isBlocked && (
                            <span
                              className="text-[10px] bg-red-100 text-red-700 rounded px-1.5 py-0.5"
                              title={`On another route on ${u.blocked_on_other_route_date}`}
                            >
                              on {u.blocked_on_other_route_date}
                            </span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex gap-2 mt-3 pt-3 border-t">
              <button
                onClick={save}
                disabled={pending}
                className="btn-primary inline-flex items-center gap-1 flex-1 justify-center"
              >
                <Check className="h-4 w-4" />
                {pending ? "Saving..." : "Save picks"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
            {!enough && availableUnits.length > 0 && (
              <p className="text-[10px] text-amber-700 text-center mt-2">
                ⚠ You haven't picked enough yet ({quantityNeeded - selected.size} more needed).
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
