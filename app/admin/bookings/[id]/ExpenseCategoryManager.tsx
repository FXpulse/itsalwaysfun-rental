"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, Eye, EyeOff, Clock } from "lucide-react";
import {
  createExpenseCategory,
  updateExpenseCategory,
  toggleExpenseCategoryActive,
  deleteExpenseCategory,
} from "./expense-category-actions";
import type { ExpenseCategoryRow } from "./ExpensesSection";

export function ExpenseCategoryManager({
  open,
  onClose,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  categories: ExpenseCategoryRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<ExpenseCategoryRow | null>(null);
  const [creating, setCreating] = useState(false);

  if (!open) return null;

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const r = editing
        ? await updateExpenseCategory(editing.key, formData)
        : await createExpenseCategory(formData);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(editing ? "Updated" : "Created");
      setEditing(null);
      setCreating(false);
      router.refresh();
    });
  }

  function handleToggle(c: ExpenseCategoryRow) {
    startTransition(async () => {
      const r = await toggleExpenseCategoryActive(c.key, !c.is_active);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(c.is_active ? "Deactivated" : "Activated");
      router.refresh();
    });
  }

  function handleDelete(c: ExpenseCategoryRow) {
    if (
      !confirm(
        `PERMANENTLY delete "${c.label}"? Only works if no booking expense uses it.`,
      )
    )
      return;
    startTransition(async () => {
      const r = await deleteExpenseCategory(c.key);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Deleted");
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold text-brand-navy">
            Manage booking expense categories
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          These categories appear in the "Add expense" dropdown on every booking
          detail. Categories with the <Clock className="inline h-3 w-3" /> flag
          show driver hours + email inputs and auto-suggest the amount from the
          default driver hourly rate.
        </p>

        {(creating || editing) && (
          <form
            action={handleSubmit}
            className="bg-slate-50 border border-slate-300 rounded p-3 mb-4 space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-slate-600 mb-1">
                  Label (shown in dropdown) *
                </label>
                <input
                  name="label"
                  required
                  defaultValue={editing?.label || ""}
                  placeholder="e.g. 🚐 Vehicle rental (for far trips)"
                  className="input"
                  autoFocus
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Lead with an emoji so it's scannable.
                </p>
              </div>
              {creating && (
                <div className="col-span-2">
                  <label className="block text-xs text-slate-600 mb-1">
                    Key (stable internal id) — blank to auto-slug
                  </label>
                  <input
                    name="key"
                    placeholder="e.g. vehicle_rental"
                    pattern="[a-z0-9_]+"
                    className="input font-mono text-xs"
                  />
                </div>
              )}
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
              <div className="flex items-end gap-2">
                <input
                  id="supports_payroll_hours"
                  name="supports_payroll_hours"
                  type="checkbox"
                  value="true"
                  defaultChecked={editing?.supports_payroll_hours || false}
                />
                <label
                  htmlFor="supports_payroll_hours"
                  className="text-xs text-slate-600 flex items-center gap-1"
                >
                  <Clock className="h-3 w-3" /> Driver hours UI (labor category)
                </label>
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
                    Active (uncheck to hide from dropdown)
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

        <ul className="border border-slate-200 rounded divide-y divide-slate-100 max-h-[55vh] overflow-y-auto">
          {categories.map((c) => (
            <li
              key={c.key}
              className={`flex items-center justify-between px-3 py-2 text-sm ${
                !c.is_active ? "bg-slate-50 text-slate-400" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="truncate">
                  {c.label}
                  {c.supports_payroll_hours && (
                    <Clock
                      className="inline h-3 w-3 ml-1 text-amber-600"
                      aria-label="Labor category"
                    />
                  )}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {c.key} · sort {c.sort_order}
                  {!c.is_active && " · inactive"}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setEditing(c)}
                  disabled={pending}
                  className="text-xs text-slate-600 hover:text-brand-navy"
                  title="Edit"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleToggle(c)}
                  disabled={pending}
                  className={`text-xs ${
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
                  title="Delete (only if unused)"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
