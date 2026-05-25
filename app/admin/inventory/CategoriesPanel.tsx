"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Tag,
  Check,
  X,
  EyeOff,
  Eye,
} from "lucide-react";
import {
  createInventoryCategory,
  renameInventoryCategory,
  deleteInventoryCategory,
  setInventoryCategoryActive,
} from "./actions";
import type { InventoryCategory } from "./page";

export function CategoriesPanel({
  categories,
  itemCounts,
}: {
  categories: InventoryCategory[];
  itemCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  function refresh() {
    router.refresh();
  }

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      const r = await createInventoryCategory(formData);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Category added");
      setAdding(false);
      refresh();
    });
  }

  function handleRename(id: string) {
    if (!editValue.trim()) {
      toast.error("Name can't be empty");
      return;
    }
    startTransition(async () => {
      const r = await renameInventoryCategory(id, editValue);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Renamed — items updated");
      setEditingId(null);
      refresh();
    });
  }

  function handleToggleActive(c: InventoryCategory) {
    startTransition(async () => {
      const r = await setInventoryCategoryActive(c.id, !c.is_active);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(c.is_active ? "Hidden from form" : "Available in form");
      refresh();
    });
  }

  function handleDelete(c: InventoryCategory) {
    const count = itemCounts[c.name] || 0;
    let force = false;
    if (count > 0) {
      const ok = confirm(
        `${count} item${count === 1 ? "" : "s"} still use "${c.name}". Delete category and reassign those items to "Other"?`,
      );
      if (!ok) return;
      force = true;
    } else {
      if (!confirm(`Delete "${c.name}"?`)) return;
    }
    startTransition(async () => {
      const r = await deleteInventoryCategory(c.id, force);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Deleted");
      refresh();
    });
  }

  return (
    <div className="card mb-6 p-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 transition"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
        <Tag className="h-4 w-4 text-brand-navy" />
        <span className="font-semibold text-brand-navy flex-1 text-left">
          Manage inventory categories
        </span>
        <span className="text-xs text-slate-500">
          {categories.filter((c) => c.is_active).length} active · {categories.length} total
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-4 space-y-3">
          <p className="text-xs text-slate-500">
            Categories show up in the dropdown when creating/editing items. Renaming
            cascades to all items that use the category. Hiding keeps the category
            available on existing items but removes it from the dropdown.
          </p>

          {/* Add row */}
          {adding ? (
            <form
              action={handleCreate}
              className="flex flex-wrap items-end gap-2 bg-slate-50 border border-slate-200 rounded p-3"
            >
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs text-slate-600 mb-1">Category name *</label>
                <input
                  name="name"
                  required
                  autoFocus
                  placeholder="e.g. Safety Gear"
                  className="input"
                />
              </div>
              <div className="w-24">
                <label className="block text-xs text-slate-600 mb-1">Sort order</label>
                <input
                  name="sort_order"
                  type="number"
                  defaultValue={100}
                  className="input"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-slate-600 mb-1">Description (optional)</label>
                <input
                  name="description"
                  placeholder="What goes in this category"
                  className="input"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={pending} className="btn-primary">
                  {pending ? "Saving..." : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-2 text-sm text-brand-navy font-semibold hover:text-brand-navy-dark"
            >
              <Plus className="h-4 w-4" /> Add category
            </button>
          )}

          {/* List */}
          {categories.length === 0 ? (
            <div className="text-center text-slate-400 text-sm py-6">
              No categories yet — add one above.
            </div>
          ) : (
            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-center">Items using</th>
                    <th className="px-3 py-2 text-center">Sort</th>
                    <th className="px-3 py-2 text-center">Status</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categories.map((c) => {
                    const count = itemCounts[c.name] || 0;
                    const isEditing = editingId === c.id;
                    return (
                      <tr key={c.id} className={c.is_active ? "" : "bg-slate-50"}>
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleRename(c.id);
                                  if (e.key === "Escape") setEditingId(null);
                                }}
                                className="input text-sm"
                              />
                              <button
                                onClick={() => handleRename(c.id)}
                                disabled={pending}
                                className="h-7 w-7 inline-flex items-center justify-center text-green-700 hover:bg-green-50 rounded"
                                title="Save"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="h-7 w-7 inline-flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded"
                                title="Cancel"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div>
                              <div className="font-medium">{c.name}</div>
                              {c.description && (
                                <div className="text-xs text-slate-500">{c.description}</div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center text-xs text-slate-600">{count}</td>
                        <td className="px-3 py-2 text-center text-xs font-mono text-slate-500">
                          {c.sort_order}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {c.is_active ? (
                            <span className="text-xs bg-green-100 text-green-800 rounded px-2 py-0.5">
                              active
                            </span>
                          ) : (
                            <span className="text-xs bg-slate-200 text-slate-600 rounded px-2 py-0.5">
                              hidden
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right space-x-2">
                          {!isEditing && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingId(c.id);
                                  setEditValue(c.name);
                                }}
                                className="text-xs text-slate-600 hover:text-brand-navy inline-flex items-center gap-1"
                                title="Rename"
                              >
                                <Pencil className="h-3 w-3" /> Rename
                              </button>
                              <button
                                onClick={() => handleToggleActive(c)}
                                disabled={pending}
                                className="text-xs text-slate-600 hover:text-brand-navy inline-flex items-center gap-1"
                                title={c.is_active ? "Hide from dropdown" : "Show in dropdown"}
                              >
                                {c.is_active ? (
                                  <>
                                    <EyeOff className="h-3 w-3" /> Hide
                                  </>
                                ) : (
                                  <>
                                    <Eye className="h-3 w-3" /> Show
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleDelete(c)}
                                disabled={pending}
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
          )}
        </div>
      )}
    </div>
  );
}
