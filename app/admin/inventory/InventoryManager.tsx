"use client";

import Link from "next/link";
import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  X,
  Minus,
  Wrench,
  Trash2,
  Pencil,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import {
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  adjustInUse,
  updateCondition,
} from "./actions";
import type { InventoryItem } from "./page";

const CONDITION_STYLES: Record<string, string> = {
  good: "bg-green-100 text-green-800",
  needs_repair: "bg-amber-100 text-amber-800",
  broken: "bg-red-100 text-red-800",
  retired: "bg-slate-200 text-slate-600",
};

const CONDITION_LABEL: Record<string, string> = {
  good: "Good",
  needs_repair: "Needs repair",
  broken: "Broken",
  retired: "Retired",
};

export function InventoryManager({
  items,
  categories,
  isAdmin,
}: {
  items: InventoryItem[];
  categories: string[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterCondition, setFilterCondition] = useState<string>("all");
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [conditionFor, setConditionFor] = useState<InventoryItem | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((i) => {
      if (!i.is_active) return false;
      if (filterCategory !== "all" && i.category !== filterCategory) return false;
      if (filterCondition !== "all" && i.condition !== filterCondition) return false;
      if (q) {
        const hay = `${i.name} ${i.category} ${i.location || ""} ${i.notes || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, filterCategory, filterCondition]);

  // Group by category for display
  const grouped = useMemo(() => {
    const m = new Map<string, InventoryItem[]>();
    filtered.forEach((i) => {
      if (!m.has(i.category)) m.set(i.category, []);
      m.get(i.category)!.push(i);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  function refresh() {
    router.refresh();
  }

  function handleAdjust(item: InventoryItem, delta: number) {
    startTransition(async () => {
      const r = await adjustInUse(item.id, delta);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      refresh();
    });
  }

  function handleDelete(item: InventoryItem) {
    if (!confirm(`Permanently delete "${item.name}"?`)) return;
    startTransition(async () => {
      const r = await deleteInventoryItem(item.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Deleted");
      refresh();
    });
  }

  function handleSave(formData: FormData, editingItem: InventoryItem | null) {
    startTransition(async () => {
      const r = editingItem
        ? await updateInventoryItem(editingItem.id, formData)
        : await createInventoryItem(formData);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(editingItem ? "Updated" : "Created");
      setEditing(null);
      setCreating(false);
      refresh();
    });
  }

  function handleConditionSave(formData: FormData) {
    const item = conditionFor;
    if (!item) return;
    const condition = String(formData.get("condition") || "good");
    const note = String(formData.get("note") || "");
    startTransition(async () => {
      const r = await updateCondition(item.id, condition, note);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Condition updated");
      setConditionFor(null);
      refresh();
    });
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, location, notes..."
            className="input pl-9"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="input max-w-[200px]"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filterCondition}
          onChange={(e) => setFilterCondition(e.target.value)}
          className="input max-w-[180px]"
        >
          <option value="all">All conditions</option>
          <option value="good">Good</option>
          <option value="needs_repair">Needs repair</option>
          <option value="broken">Broken</option>
          <option value="retired">Retired</option>
        </select>
        {isAdmin && (
          <button onClick={() => setCreating(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> New item
          </button>
        )}
      </div>

      {/* Items grouped by category */}
      {grouped.length === 0 ? (
        <div className="card text-center text-slate-400 py-12">
          No inventory items match the filters.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([cat, list]) => (
            <div key={cat}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                {cat} <span className="text-slate-400 font-normal">({list.length})</span>
              </h2>
              <div className="card overflow-hidden p-0">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">Item</th>
                      <th className="px-4 py-3 text-center">Available / Owned</th>
                      <th className="px-4 py-3 text-center">In use</th>
                      <th className="px-4 py-3 text-left">Condition</th>
                      <th className="px-4 py-3 text-left">Location</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {list.map((item) => {
                      const available = item.quantity_owned - item.quantity_in_use;
                      const lowStock = available === 0 && item.quantity_owned > 0;
                      return (
                        <tr key={item.id}>
                          <td className="px-4 py-3">
                            <div className="font-medium">{item.name}</div>
                            {item.notes && (
                              <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                                {item.notes}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`font-mono font-semibold ${lowStock ? "text-red-600" : "text-brand-navy"}`}
                            >
                              {available}
                            </span>
                            <span className="text-slate-400"> / {item.quantity_owned}</span>
                            {lowStock && (
                              <div className="text-[10px] text-red-600 inline-flex items-center gap-0.5 ml-1">
                                <AlertTriangle className="h-3 w-3" />
                                all out
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => handleAdjust(item, -1)}
                                disabled={pending || item.quantity_in_use <= 0}
                                className="h-6 w-6 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-30 inline-flex items-center justify-center"
                                title="Return one"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="font-mono w-6 text-center">{item.quantity_in_use}</span>
                              <button
                                onClick={() => handleAdjust(item, +1)}
                                disabled={pending || item.quantity_in_use >= item.quantity_owned}
                                className="h-6 w-6 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-30 inline-flex items-center justify-center"
                                title="Send one out"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs rounded px-2 py-0.5 ${CONDITION_STYLES[item.condition]}`}
                            >
                              {CONDITION_LABEL[item.condition]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{item.location || "—"}</td>
                          <td className="px-4 py-3 text-right space-x-2">
                            <Link
                              href={`/admin/inventory/${item.id}`}
                              className="text-xs text-slate-600 hover:text-brand-navy inline-flex items-center gap-1"
                              title="Maintenance log + history"
                            >
                              <ClipboardList className="h-3 w-3" /> Log
                            </Link>
                            <button
                              onClick={() => setConditionFor(item)}
                              className="text-xs text-slate-600 hover:text-brand-navy inline-flex items-center gap-1"
                              title="Update condition"
                            >
                              <Wrench className="h-3 w-3" /> Condition
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => setEditing(item)}
                                  className="text-xs text-slate-600 hover:text-brand-navy inline-flex items-center gap-1"
                                >
                                  <Pencil className="h-3 w-3" /> Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(item)}
                                  className="text-xs text-red-600 hover:text-red-800 inline-flex items-center gap-1"
                                >
                                  <Trash2 className="h-3 w-3" /> Delete
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      {(creating || editing) && (
        <ItemFormModal
          item={editing}
          categories={categories}
          pending={pending}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={(fd) => handleSave(fd, editing)}
        />
      )}

      {/* Condition modal */}
      {conditionFor && (
        <Modal
          title={`Update condition — ${conditionFor.name}`}
          onClose={() => setConditionFor(null)}
        >
          <form action={handleConditionSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Condition</label>
              <select name="condition" defaultValue={conditionFor.condition} className="input">
                <option value="good">Good</option>
                <option value="needs_repair">Needs repair</option>
                <option value="broken">Broken</option>
                <option value="retired">Retired</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Maintenance note (optional)
              </label>
              <textarea
                name="note"
                rows={3}
                placeholder="What needs to be fixed, what was done, etc."
                className="input"
              />
              <p className="text-xs text-slate-400 mt-1">
                Appended to history with today's date.
              </p>
            </div>
            {conditionFor.maintenance_notes && (
              <div className="text-xs bg-slate-50 rounded p-2 max-h-40 overflow-y-auto">
                <div className="font-semibold mb-1 text-slate-600">History:</div>
                <pre className="whitespace-pre-wrap font-sans text-slate-500">
                  {conditionFor.maintenance_notes}
                </pre>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={pending} className="btn-primary flex-1">
                {pending ? "Saving..." : "Update condition"}
              </button>
              <button
                type="button"
                onClick={() => setConditionFor(null)}
                className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function ItemFormModal({
  item,
  categories,
  pending,
  onClose,
  onSave,
}: {
  item: InventoryItem | null;
  categories: string[];
  pending: boolean;
  onClose: () => void;
  onSave: (fd: FormData) => void;
}) {
  return (
    <Modal title={item ? `Edit — ${item.name}` : "New inventory item"} onClose={onClose}>
      <form action={onSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input name="name" required defaultValue={item?.name || ""} className="input" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select
              name="category"
              required
              defaultValue={item?.category || (categories[0] ?? "Other")}
              className="input"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              {/* Safety net: if editing an item whose category is no longer in the
                  active list (deleted/hidden), surface it so the value stays valid. */}
              {item?.category && !categories.includes(item.category) && (
                <option value={item.category}>{item.category} (legacy)</option>
              )}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              Need a new category? Add it in the "Manage inventory categories" panel
              at the top of the page.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
            <input
              name="location"
              defaultValue={item?.location || ""}
              className="input"
              placeholder="Warehouse, Truck 1, etc."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Quantity owned
            </label>
            <input
              name="quantity_owned"
              type="number"
              min={0}
              required
              defaultValue={item?.quantity_owned ?? 1}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">In use</label>
            <input
              name="quantity_in_use"
              type="number"
              min={0}
              defaultValue={item?.quantity_in_use ?? 0}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Condition</label>
            <select name="condition" defaultValue={item?.condition || "good"} className="input">
              <option value="good">Good</option>
              <option value="needs_repair">Needs repair</option>
              <option value="broken">Broken</option>
              <option value="retired">Retired</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Purchase cost (USD)
            </label>
            <input
              name="purchase_cost_dollars"
              type="number"
              step="0.01"
              min={0}
              defaultValue={item ? (item.purchase_cost_cents / 100).toFixed(2) : "0"}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Purchase date</label>
            <input
              name="purchase_date"
              type="date"
              defaultValue={item?.purchase_date || ""}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Last maintenance
            </label>
            <input
              name="last_maintenance_date"
              type="date"
              defaultValue={item?.last_maintenance_date || ""}
              className="input"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <input
              name="description"
              defaultValue={item?.description || ""}
              className="input"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              name="notes"
              rows={2}
              defaultValue={item?.notes || ""}
              className="input"
            />
          </div>
          <div className="col-span-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                name="is_active"
                type="checkbox"
                defaultChecked={item ? item.is_active : true}
                className="h-4 w-4"
              />
              Active (uncheck to archive without deleting)
            </label>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={pending} className="btn-primary flex-1">
            {pending ? "Saving..." : item ? "Save changes" : "Create item"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-brand-navy">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
