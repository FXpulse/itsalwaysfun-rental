"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { addInventoryRequirement, deleteInventoryRequirement } from "./inventory-actions";

export interface InventoryOption {
  id: string;
  name: string;
  category: string;
}

export interface RequirementRow {
  id: string;
  inventory_item_id: string;
  inventory_name: string;
  inventory_category: string;
  quantity: number;
  surface_types: string[] | null;
  only_when_needs_power: boolean;
  notes: string | null;
}

const SURFACE_OPTIONS = [
  { value: "grass", label: "Grass" },
  { value: "dirt", label: "Dirt" },
  { value: "concrete", label: "Concrete" },
  { value: "paver", label: "Paver" },
  { value: "asphalt", label: "Asphalt" },
  { value: "other", label: "Other" },
];

export function InventoryRequirements({
  productId,
  inventory,
  requirements,
}: {
  productId: string;
  inventory: InventoryOption[];
  requirements: RequirementRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);

  // Form state
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [surfaces, setSurfaces] = useState<string[]>([]);
  const [onlyWithPower, setOnlyWithPower] = useState(false);
  const [notes, setNotes] = useState("");

  function reset() {
    setItemId("");
    setQuantity("1");
    setSurfaces([]);
    setOnlyWithPower(false);
    setNotes("");
    setAdding(false);
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!itemId) {
      toast.error("Pick an inventory item");
      return;
    }
    const fd = new FormData();
    fd.append("product_id", productId);
    fd.append("inventory_item_id", itemId);
    fd.append("quantity", quantity);
    surfaces.forEach((s) => fd.append("surface_types", s));
    if (onlyWithPower) fd.append("only_when_needs_power", "on");
    if (notes.trim()) fd.append("notes", notes.trim());

    startTransition(async () => {
      const r = await addInventoryRequirement(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Requirement added");
      reset();
      router.refresh();
    });
  }

  function handleDelete(reqId: string, itemName: string) {
    if (!confirm(`Remove "${itemName}" from this product's checklist?`)) return;
    startTransition(async () => {
      const r = await deleteInventoryRequirement(reqId, productId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Removed");
      router.refresh();
    });
  }

  function toggleSurface(s: string) {
    setSurfaces((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  return (
    <div className="card mt-6">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h2 className="text-lg font-semibold text-brand-navy">Inventory checklist</h2>
          <p className="text-xs text-slate-500">
            Internal use — what to load on the truck for each delivery. Customer doesn't see this.
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="btn-primary text-sm inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Add item
          </button>
        )}
      </div>

      {inventory.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <span>
            No inventory items yet. Add some in{" "}
            <a href="/admin/inventory" className="font-semibold underline">
              /admin/inventory
            </a>{" "}
            first.
          </span>
        </div>
      )}

      {/* Add form */}
      {adding && (
        <form onSubmit={handleAdd} className="bg-slate-50 rounded p-3 mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-600 mb-1">Inventory item *</label>
              <select
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                required
                className="input"
                disabled={pending}
              >
                <option value="">Select…</option>
                {inventory.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.category} — {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Quantity *</label>
              <input
                type="number"
                min={1}
                max={999}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="input"
                disabled={pending}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">
              Surface conditions <span className="text-slate-400">(empty = always needed)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {SURFACE_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => toggleSurface(s.value)}
                  className={`text-xs py-1 px-3 rounded border transition ${
                    surfaces.includes(s.value)
                      ? "bg-brand-navy text-white border-brand-navy"
                      : "bg-white text-slate-700 border-slate-300 hover:border-brand-navy"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Select which surfaces need this. E.g. sandbags only for concrete/paver/asphalt.
            </p>
          </div>

          <div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyWithPower}
                onChange={(e) => setOnlyWithPower(e.target.checked)}
                className="h-4 w-4"
              />
              Only when customer needs Power Supply
            </label>
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. heavy-duty extension"
              className="input text-sm"
            />
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary text-sm">
              {pending ? "Adding..." : "Add to checklist"}
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

      {/* Current requirements */}
      {requirements.length === 0 ? (
        <div className="text-center text-slate-400 py-6 text-sm border-2 border-dashed border-slate-200 rounded">
          No checklist items yet. Click "Add item" to start.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="text-left py-2">Item</th>
              <th className="text-center py-2 w-16">Qty</th>
              <th className="text-left py-2">Condition</th>
              <th className="text-left py-2">Notes</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requirements.map((r) => (
              <tr key={r.id}>
                <td className="py-2">
                  <div className="font-medium">{r.inventory_name}</div>
                  <div className="text-xs text-slate-400">{r.inventory_category}</div>
                </td>
                <td className="py-2 text-center font-mono">{r.quantity}</td>
                <td className="py-2 text-xs">
                  {r.surface_types && r.surface_types.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {r.surface_types.map((s) => (
                        <span
                          key={s}
                          className="bg-slate-100 text-slate-700 rounded px-2 py-0.5"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400">Always</span>
                  )}
                  {r.only_when_needs_power && (
                    <span className="block mt-1 text-purple-700 text-[10px]">
                      ⚡ only with Power Supply
                    </span>
                  )}
                </td>
                <td className="py-2 text-xs text-slate-600">{r.notes || "—"}</td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => handleDelete(r.id, r.inventory_name)}
                    className="text-red-500 hover:text-red-700"
                    disabled={pending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
