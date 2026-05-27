"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Trash2, DollarSign, Receipt, Settings2 } from "lucide-react";
import { addBookingExpense, deleteBookingExpense } from "./expense-actions";
import { formatCurrency } from "@/lib/utils";
import { ExpenseCategoryManager } from "./ExpenseCategoryManager";

export interface ExpenseRow {
  id: string;
  category: string;
  description: string | null;
  amount_cents: number;
  driver_hours: number | null;
  driver_email: string | null;
  recorded_by: string;
  recorded_at: string;
  notes: string | null;
}

export interface ExpenseCategoryRow {
  key: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  supports_payroll_hours: boolean;
}

export function ExpensesSection({
  bookingId,
  expenses,
  categories,
  defaultDriverRateCents,
  bookingTotalAmount,
}: {
  bookingId: string;
  expenses: ExpenseRow[];
  categories: ExpenseCategoryRow[];
  defaultDriverRateCents: number;
  bookingTotalAmount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [showCategoryMgr, setShowCategoryMgr] = useState(false);

  const activeCategories = categories.filter((c) => c.is_active);
  const categoriesByKey = new Map(categories.map((c) => [c.key, c]));
  const defaultCategoryKey = activeCategories[0]?.key || "other";
  const [category, setCategory] = useState(defaultCategoryKey);
  const [hours, setHours] = useState("");
  const selectedCategory = categoriesByKey.get(category);
  const showHoursUI = selectedCategory?.supports_payroll_hours || false;

  const totalExpenses = expenses.reduce((s, e) => s + e.amount_cents, 0);
  const grossProfit = (bookingTotalAmount || 0) - totalExpenses;
  const marginPct = bookingTotalAmount > 0 ? (grossProfit / bookingTotalAmount) * 100 : 0;

  function handleSubmit(formData: FormData) {
    formData.append("booking_id", bookingId);
    startTransition(async () => {
      const r = await addBookingExpense(formData);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Expense recorded");
      setAdding(false);
      setHours("");
      setCategory(defaultCategoryKey);
      router.refresh();
    });
  }

  function handleDelete(e: ExpenseRow) {
    if (!confirm(`Delete this expense (${formatCurrency(e.amount_cents)})?`)) return;
    startTransition(async () => {
      const r = await deleteBookingExpense(e.id, bookingId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Deleted");
      router.refresh();
    });
  }

  // Auto-compute payroll amount when hours change (any category with the
  // supports_payroll_hours flag — e.g. payroll, setup_labor, teardown_labor)
  const autoPayrollAmount =
    showHoursUI && hours
      ? ((parseFloat(hours) || 0) * defaultDriverRateCents) / 100
      : "";

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Costs for this booking
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track gas, payroll, tolls etc. for true margin reporting.
          </p>
        </div>
        {!adding && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCategoryMgr(true)}
              className="text-xs text-slate-500 hover:text-brand-navy inline-flex items-center gap-1"
              title="Manage expense categories"
            >
              <Settings2 className="h-3 w-3" /> Categories
            </button>
            <button
              onClick={() => setAdding(true)}
              className="btn-primary text-sm inline-flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Add expense
            </button>
          </div>
        )}
      </div>

      <ExpenseCategoryManager
        open={showCategoryMgr}
        onClose={() => setShowCategoryMgr(false)}
        categories={categories}
      />

      {/* Margin summary */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
        <div className="bg-green-50 border border-green-200 rounded p-2">
          <div className="text-slate-500 uppercase text-[10px]">Revenue</div>
          <div className="font-mono font-bold text-green-800 text-sm">
            {formatCurrency(bookingTotalAmount || 0)}
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded p-2">
          <div className="text-slate-500 uppercase text-[10px]">Direct costs</div>
          <div className="font-mono font-bold text-red-800 text-sm">
            -{formatCurrency(totalExpenses)}
          </div>
        </div>
        <div
          className={`rounded p-2 border ${
            grossProfit > 0
              ? "bg-emerald-50 border-emerald-200"
              : "bg-amber-50 border-amber-200"
          }`}
        >
          <div className="text-slate-500 uppercase text-[10px]">Gross margin</div>
          <div
            className={`font-mono font-bold text-sm ${
              grossProfit > 0 ? "text-emerald-800" : "text-amber-800"
            }`}
          >
            {formatCurrency(grossProfit)}{" "}
            <span className="text-[10px]">({marginPct.toFixed(0)}%)</span>
          </div>
        </div>
      </div>

      {adding && (
        <form
          action={handleSubmit}
          className="bg-slate-50 border border-slate-200 rounded p-3 mb-4 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-slate-600 mb-1">Category *</label>
              <select
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input"
              >
                {activeCategories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {showHoursUI && (
              <>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">
                    Driver hours *
                  </label>
                  <input
                    name="driver_hours"
                    type="number"
                    step="0.25"
                    min={0}
                    max={48}
                    required
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="e.g. 2.5"
                    className="input"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    @ ${(defaultDriverRateCents / 100).toFixed(2)}/hr default
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">
                    Driver email (optional, for payroll attribution)
                  </label>
                  <input
                    name="driver_email"
                    type="email"
                    placeholder="driver@example.com"
                    className="input"
                  />
                </div>
              </>
            )}

            <div className={showHoursUI ? "col-span-2" : ""}>
              <label className="block text-xs text-slate-600 mb-1">
                Amount (USD) *
                {showHoursUI && autoPayrollAmount && (
                  <span className="text-[10px] text-slate-400 ml-1">
                    (suggested ${typeof autoPayrollAmount === "number" ? autoPayrollAmount.toFixed(2) : autoPayrollAmount})
                  </span>
                )}
              </label>
              <div className="relative">
                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  name="amount_dollars"
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  defaultValue={autoPayrollAmount}
                  key={`amount-${category}-${hours}`}
                  placeholder="0.00"
                  className="input pl-7"
                />
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-600 mb-1">
                Description / notes
              </label>
              <input
                name="description"
                placeholder="e.g. Round trip 18mi @ $0.60/mi"
                className="input"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary text-sm">
              {pending ? "Saving..." : "Record expense"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setHours("");
                setCategory(defaultCategoryKey);
              }}
              className="text-xs text-slate-600 hover:text-slate-900 px-3 py-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {expenses.length === 0 ? (
        <div className="text-center text-slate-400 py-6 text-xs border-2 border-dashed border-slate-200 rounded">
          No expenses recorded yet for this booking.
        </div>
      ) : (
        <div className="border border-slate-200 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-left">Recorded by</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((e) => {
                const cat = categoriesByKey.get(e.category);
                return (
                  <tr key={e.id}>
                    <td className="px-3 py-2 text-xs">
                      <span className="inline-flex items-center gap-1">
                        {cat?.label || e.category}
                        {cat && !cat.is_active && (
                          <span className="text-[10px] text-amber-600">(inactive)</span>
                        )}
                      </span>
                      {e.driver_hours != null && (
                        <div className="text-[10px] text-slate-400">
                          {e.driver_hours}h
                          {e.driver_email && ` · ${e.driver_email}`}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 max-w-[200px]">
                      {e.description || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-red-700">
                      -{formatCurrency(e.amount_cents)}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      <div>{e.recorded_by}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(e.recorded_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => handleDelete(e)}
                        disabled={pending}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-slate-50 font-bold">
                <td colSpan={2} className="px-3 py-2 text-xs text-slate-700">
                  Total expenses
                </td>
                <td className="px-3 py-2 text-right font-mono text-red-700">
                  -{formatCurrency(totalExpenses)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
