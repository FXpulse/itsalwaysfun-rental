"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, Calendar } from "lucide-react";
import {
  createOverhead,
  updateOverhead,
  endOverhead,
  deleteOverhead,
} from "./actions";
import { formatCurrency } from "@/lib/utils";
import type { OverheadRow } from "./page";

const CATEGORIES = [
  { value: "rent", label: "🏢 Rent (warehouse / office)" },
  { value: "insurance", label: "🛡 Insurance (liability, vehicle, business)" },
  { value: "software", label: "💻 Software (Supabase, Vercel, Stripe fees, etc.)" },
  { value: "utilities", label: "💡 Utilities (electric, internet, phone)" },
  { value: "marketing", label: "📣 Marketing (ads, listings, SEO)" },
  { value: "vehicle", label: "🚚 Vehicle (truck/trailer payments, registration)" },
  { value: "payroll", label: "👥 Payroll (salaried staff, NOT hourly drivers)" },
  { value: "professional", label: "👔 Professional (accountant, attorney)" },
  { value: "other", label: "🗂 Other" },
];

export function OverheadManager({ rows }: { rows: OverheadRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<OverheadRow | null>(null);
  const [creating, setCreating] = useState(false);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const r = editing
        ? await updateOverhead(editing.id, formData)
        : await createOverhead(formData);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(editing ? "Updated" : "Added");
      setCreating(false);
      setEditing(null);
      router.refresh();
    });
  }

  function handleEnd(r: OverheadRow) {
    if (!confirm(`Mark "${r.name}" as ended today? You can re-add it later if needed.`)) return;
    startTransition(async () => {
      const result = await endOverhead(r.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Marked ended");
      router.refresh();
    });
  }

  function handleDelete(r: OverheadRow) {
    if (
      !confirm(
        `PERMANENTLY delete "${r.name}"? This removes it from historical reports too. Usually you want "End" instead.`,
      )
    )
      return;
    startTransition(async () => {
      const result = await deleteOverhead(r.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Deleted");
      router.refresh();
    });
  }

  const active = rows.filter((r) => !r.effective_to);
  const ended = rows.filter((r) => r.effective_to);

  return (
    <>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Add overhead
        </button>
      </div>

      {(creating || editing) && (
        <Modal
          title={editing ? `Edit "${editing.name}"` : "Add monthly overhead"}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        >
          <form action={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-slate-600 mb-1">Name *</label>
                <input
                  name="name"
                  required
                  defaultValue={editing?.name || ""}
                  placeholder="e.g. Warehouse rent (Mandarin)"
                  className="input"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Category *</label>
                <select
                  name="category"
                  defaultValue={editing?.category || "rent"}
                  className="input"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Monthly amount (USD) *
                </label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input
                    name="monthly_dollars"
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    defaultValue={editing ? (editing.monthly_cents / 100).toFixed(2) : ""}
                    placeholder="0.00"
                    className="input pl-6"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Effective from *
                </label>
                <input
                  name="effective_from"
                  type="date"
                  required
                  defaultValue={
                    editing?.effective_from || new Date().toISOString().split("T")[0]
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Effective to (blank = still active)
                </label>
                <input
                  name="effective_to"
                  type="date"
                  defaultValue={editing?.effective_to || ""}
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
                  placeholder="e.g. Includes utilities + parking; lease term ends 2027-12"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <button type="submit" disabled={pending} className="btn-primary">
                {pending ? "Saving..." : editing ? "Save changes" : "Add overhead"}
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
        </Modal>
      )}

      {rows.length === 0 ? (
        <div className="card text-center text-slate-400 py-12">
          <p>No overhead costs tracked yet.</p>
          <p className="text-xs mt-2">
            Add your monthly fixed costs (rent, insurance, software subs, etc.)
            so the P&L report computes accurate margins.
          </p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="card overflow-hidden p-0 mb-4">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  Active ({active.length})
                </h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-white text-slate-500 text-xs uppercase tracking-wide border-b">
                  <tr>
                    <th className="px-4 py-2 text-left">Item</th>
                    <th className="px-4 py-2 text-left">Category</th>
                    <th className="px-4 py-2 text-right">Monthly</th>
                    <th className="px-4 py-2 text-left">Since</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {active.map((r) => {
                    const cat = CATEGORIES.find((c) => c.value === r.category);
                    return (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2">
                          <div className="font-medium">{r.name}</div>
                          {r.notes && (
                            <div className="text-[10px] text-slate-500 max-w-md truncate">
                              {r.notes}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs">{cat?.label || r.category}</td>
                        <td className="px-4 py-2 text-right font-mono font-bold text-brand-navy">
                          {formatCurrency(r.monthly_cents)}
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-500">
                          {new Date(r.effective_from).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2 text-right space-x-2">
                          <button
                            onClick={() => setEditing(r)}
                            className="text-xs text-slate-600 hover:text-brand-navy inline-flex items-center gap-1"
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                          <button
                            onClick={() => handleEnd(r)}
                            disabled={pending}
                            className="text-xs text-amber-700 hover:text-amber-900 inline-flex items-center gap-1"
                            title="Mark as ended today (preserves history for past months)"
                          >
                            <Calendar className="h-3 w-3" /> End
                          </button>
                          <button
                            onClick={() => handleDelete(r)}
                            disabled={pending}
                            className="text-xs text-red-600 hover:text-red-800 inline-flex items-center gap-1"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {ended.length > 0 && (
            <details className="card overflow-hidden p-0 opacity-70">
              <summary className="bg-slate-50 px-4 py-2 cursor-pointer border-b border-slate-200">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  Ended ({ended.length}) — kept for historical reports
                </span>
              </summary>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {ended.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-xs">{r.name}</td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {formatCurrency(r.monthly_cents)}/mo
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {r.effective_from} → {r.effective_to}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => handleDelete(r)}
                          disabled={pending}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </>
      )}
    </>
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
