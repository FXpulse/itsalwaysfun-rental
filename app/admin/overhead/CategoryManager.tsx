"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, Eye, EyeOff } from "lucide-react";
import {
  createCategory,
  updateCategory,
  toggleCategoryActive,
  deleteCategory,
} from "./category-actions";
import type { CategoryRow } from "./page";

export function CategoryManager({
  open,
  onClose,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  categories: CategoryRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [creating, setCreating] = useState(false);

  if (!open) return null;

  function refresh() {
    router.refresh();
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const r = editing
        ? await updateCategory(editing.key, formData)
        : await createCategory(formData);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(editing ? "Updated" : "Created");
      setEditing(null);
      setCreating(false);
      refresh();
    });
  }

  function handleToggle(c: CategoryRow) {
    startTransition(async () => {
      const r = await toggleCategoryActive(c.key, !c.is_active);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(c.is_active ? "Deactivated" : "Activated");
      refresh();
    });
  }

  function handleDelete(c: CategoryRow) {
    if (
      !confirm(
        `PERMANENTLY delete category "${c.label}"? This only works if NO overhead lines currently use it.`,
      )
    )
      return;
    startTransition(async () => {
      const r = await deleteCategory(c.key);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Deleted");
      refresh();
    });
  }

  // Group categories by group_name preserving sort_order
  const groups = new Map<string, CategoryRow[]>();
  for (const c of categories) {
    const g = c.group_name || "Other";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(c);
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full p-6 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold text-brand-navy">
            Manage overhead categories
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Edit labels, add new categories, deactivate ones you don't use. Deactivated
          categories disappear from the dropdown but stay attached to historical
          overhead rows (no data loss).
        </p>

        {(creating || editing) && (
          <form
            action={handleSubmit}
            className="bg-slate-50 border border-slate-300 rounded p-3 mb-4 space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-slate-600 mb-1">
                  Label (displayed in dropdown) *
                </label>
                <input
                  name="label"
                  required
                  defaultValue={editing?.label || ""}
                  placeholder="e.g. 💳 Merchant fees (Stripe %)"
                  className="input"
                  autoFocus
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Tip: lead with an emoji so it's scannable in the list.
                </p>
              </div>
              {creating && (
                <div className="col-span-2">
                  <label className="block text-xs text-slate-600 mb-1">
                    Key (stable internal id) — leave blank to auto-slug from label
                  </label>
                  <input
                    name="key"
                    placeholder="e.g. merchant_fees"
                    pattern="[a-z0-9_]+"
                    className="input font-mono text-xs"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Lowercase letters, numbers, underscores only. Cannot be changed later.
                  </p>
                </div>
              )}
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Group (optional)
                </label>
                <input
                  name="group_name"
                  defaultValue={editing?.group_name || ""}
                  placeholder="e.g. Financial"
                  list="overhead-groups"
                  className="input"
                />
                <datalist id="overhead-groups">
                  {Array.from(groups.keys()).map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Sort order</label>
                <input
                  name="sort_order"
                  type="number"
                  min={0}
                  max={9999}
                  defaultValue={editing?.sort_order ?? 100}
                  className="input"
                />
              </div>
              {editing && (
                <div className="col-span-2 flex items-center gap-2">
                  <input
                    id="is_active"
                    name="is_active"
                    type="checkbox"
                    value="true"
                    defaultChecked={editing.is_active}
                  />
                  <label htmlFor="is_active" className="text-xs text-slate-600">
                    Active (uncheck to hide from dropdowns)
                  </label>
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <button type="submit" disabled={pending} className="btn-primary text-sm">
                {pending ? "Saving..." : editing ? "Save changes" : "Create category"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setEditing(null);
                }}
                className="text-xs text-slate-600 hover:text-slate-900 px-3 py-2"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {!creating && !editing && (
          <div className="flex justify-end mb-3">
            <button
              onClick={() => setCreating(true)}
              className="btn-primary text-sm inline-flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> New category
            </button>
          </div>
        )}

        <div className="space-y-4 max-h-[55vh] overflow-y-auto">
          {Array.from(groups.entries()).map(([groupName, items]) => (
            <div key={groupName}>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 sticky top-0 bg-white py-1">
                {groupName}
              </h3>
              <ul className="border border-slate-200 rounded divide-y divide-slate-100">
                {items.map((c) => (
                  <li
                    key={c.key}
                    className={`flex items-center justify-between px-3 py-2 text-sm ${
                      !c.is_active ? "bg-slate-50 text-slate-400" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{c.label}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {c.key} · sort {c.sort_order}
                        {!c.is_active && " · inactive"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setEditing(c)}
                        disabled={pending}
                        className="text-xs text-slate-600 hover:text-brand-navy inline-flex items-center gap-0.5"
                        title="Edit label / group / sort"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleToggle(c)}
                        disabled={pending}
                        className={`text-xs inline-flex items-center gap-0.5 ${
                          c.is_active
                            ? "text-amber-700 hover:text-amber-900"
                            : "text-green-700 hover:text-green-900"
                        }`}
                        title={c.is_active ? "Deactivate" : "Activate"}
                      >
                        {c.is_active ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        disabled={pending}
                        className="text-xs text-red-600 hover:text-red-800"
                        title="Permanently delete (only if unused)"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
