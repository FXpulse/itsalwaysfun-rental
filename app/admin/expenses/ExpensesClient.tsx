"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { createBusinessExpense, deleteBusinessExpense } from "./actions";

interface ExpenseRow {
  id: string;
  expense_date: string;
  account: string;
  account_label: string;
  category: string;
  category_label: string;
  vendor_name: string;
  description: string | null;
  amount_cents: number;
  contractor_name: string | null;
  notes: string | null;
  recorded_by: string;
}

interface Props {
  rows: ExpenseRow[];
  categories: Array<{ key: string; label: string }>;
  accountOptions: Array<{ key: string; label: string }>;
}

const usd = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ExpensesClient({ rows, categories, accountOptions }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const r = await createBusinessExpense(formData);
      if (r?.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Expense added");
      router.refresh();
      (document.getElementById("new-expense-form") as HTMLFormElement | null)?.reset();
    });
  }

  function handleDelete(id: string, vendor: string) {
    if (!confirm(`Delete ${vendor} expense? This can't be undone.`)) return;
    startTransition(async () => {
      const r = await deleteBusinessExpense(id);
      if (r?.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Deleted");
      router.refresh();
    });
  }

  return (
    <>
      {/* Add form */}
      <section id="new-expense" className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="text-base font-semibold text-brand-navy mb-3 flex items-center gap-2">
          <Plus className="h-5 w-5" /> Add expense
        </h2>
        <form id="new-expense-form" action={handleSubmit} className="grid grid-cols-1 sm:grid-cols-6 gap-3">
          <div className="sm:col-span-1">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Date *</label>
            <input type="date" name="expense_date" required defaultValue={today} className="input w-full" />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Account *</label>
            <select name="account" required defaultValue="credit_card" className="input w-full">
              {accountOptions.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Category *</label>
            <select name="category" required defaultValue="supplies" className="input w-full">
              {categories.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Vendor *</label>
            <input type="text" name="vendor_name" required placeholder="Amazon, Home Depot..." className="input w-full" />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Amount $ *</label>
            <input type="number" step="0.01" min="0" name="amount_dollars" required placeholder="0.00" className="input w-full" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
            <input type="text" name="description" placeholder="Marketing Supplies, Website Services..." className="input w-full" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Contractor name (for 1099)</label>
            <input type="text" name="contractor_name" placeholder="Edgar Mendoza, William Andres..." className="input w-full" />
          </div>
          <div className="sm:col-span-2 flex items-end gap-2">
            <button type="submit" className="btn-primary w-full" disabled={pending}>
              {pending ? "Saving..." : "Save expense"}
            </button>
          </div>
        </form>
      </section>

      {/* Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-12 text-center text-slate-400">No expenses match these filters.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-3 py-3">Date</th>
                <th className="text-left px-3 py-3">Account</th>
                <th className="text-left px-3 py-3">Category</th>
                <th className="text-left px-3 py-3">Vendor</th>
                <th className="text-left px-3 py-3">Description</th>
                <th className="text-left px-3 py-3">Contractor</th>
                <th className="text-right px-3 py-3">Amount</th>
                <th className="text-right px-3 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{r.expense_date}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.account_label}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.category_label}</td>
                  <td className="px-3 py-2 font-medium text-slate-700">{r.vendor_name}</td>
                  <td className="px-3 py-2 text-slate-500">{r.description || "—"}</td>
                  <td className="px-3 py-2 text-slate-700">{r.contractor_name || "—"}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{usd(r.amount_cents)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleDelete(r.id, r.vendor_name)}
                      disabled={pending}
                      className="text-slate-400 hover:text-red-600 transition disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
