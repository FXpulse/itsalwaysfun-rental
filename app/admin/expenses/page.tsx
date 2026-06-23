// /admin/expenses — business expense ledger.
//
// Reads from business_expenses (transactional) + business_expense_categories
// (per-tenant catalog). Filters are query-string driven so URLs are shareable.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant/server";
import { Receipt, Plus, Filter } from "lucide-react";
import { ExpensesClient } from "./ExpensesClient";

export const dynamic = "force-dynamic";

const ACCOUNT_LABEL: Record<string, string> = {
  credit_card: "💳 Credit card",
  bank: "🏦 Bank",
  bank_zelle: "📲 Zelle",
  cash: "💵 Cash",
  check: "🧾 Check",
  other: "❓ Other",
};

interface SearchParams {
  from?: string;
  to?: string;
  category?: string;
  account?: string;
  q?: string;
}

export default async function ExpensesPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const tenantId = getCurrentTenantId();
  if (!tenantId) redirect("/admin/login");

  const admin = createAdminClient({ unscoped: true });

  // Default to the trailing 12 months if no range chosen.
  const today = new Date().toISOString().slice(0, 10);
  const oneYearAgo = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const fromDate = searchParams.from || oneYearAgo;
  const toDate = searchParams.to || today;

  let q = admin
    .from("business_expenses")
    .select("id, expense_date, account, category, vendor_name, description, amount_cents, contractor_name, notes, recorded_by")
    .eq("tenant_id", tenantId)
    .gte("expense_date", fromDate)
    .lte("expense_date", toDate)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(2000);

  if (searchParams.category) q = q.eq("category", searchParams.category);
  if (searchParams.account) q = q.eq("account", searchParams.account);
  if (searchParams.q) {
    const s = searchParams.q.replace(/[%_]/g, " ");
    q = q.or(`vendor_name.ilike.%${s}%,description.ilike.%${s}%,contractor_name.ilike.%${s}%,notes.ilike.%${s}%`);
  }

  const { data: rowsRaw } = await q;
  const rows = (rowsRaw as any[]) || [];

  // Category catalog for the filter dropdown + form select
  const { data: cats } = await admin
    .from("business_expense_categories")
    .select("key, label, is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("sort_order")
    .order("label");
  const categories: Array<{ key: string; label: string }> = (cats as any[]) || [];

  // Aggregate totals for the period
  const totalCents = rows.reduce((s: number, r: any) => s + (r.amount_cents || 0), 0);
  const byCategory = new Map<string, { label: string; cents: number; count: number }>();
  for (const r of rows) {
    const k = r.category;
    const cat = categories.find((c) => c.key === k);
    const label = cat?.label || k;
    const entry = byCategory.get(k) || { label, cents: 0, count: 0 };
    entry.cents += r.amount_cents || 0;
    entry.count += 1;
    byCategory.set(k, entry);
  }
  const categoryTotals = [...byCategory.entries()]
    .map(([key, v]) => ({ key, label: v.label, cents: v.cents, count: v.count }))
    .sort((a, b) => b.cents - a.cents);

  const usd = (cents: number) =>
    `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="container mx-auto py-8 max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Receipt className="h-7 w-7 text-brand-navy" /> Business expenses
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            One row per transaction. Use this for taxes, contractor 1099s, and cost tracking.
          </p>
        </div>
        <Link
          href="#new-expense"
          className="bg-brand-navy text-white font-semibold px-4 py-2 rounded-md hover:bg-brand-navy/90 inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Add expense
        </Link>
      </div>

      {/* Totals strip */}
      <section className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">Range</p>
          <p className="text-sm font-mono mt-1">{fromDate} → {toDate}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">Total</p>
          <p className="text-2xl font-bold text-brand-navy mt-1">{usd(totalCents)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">Transactions</p>
          <p className="text-2xl font-bold text-slate-700 mt-1">{rows.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">Categories used</p>
          <p className="text-2xl font-bold text-slate-700 mt-1">{categoryTotals.length}</p>
        </div>
      </section>

      {/* Filters (GET form — URL-shareable) */}
      <form className="bg-white border border-slate-200 rounded-lg p-4 flex items-end gap-3 flex-wrap" method="get">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">From</label>
          <input type="date" name="from" defaultValue={fromDate} className="input" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">To</label>
          <input type="date" name="to" defaultValue={toDate} className="input" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Category</label>
          <select name="category" defaultValue={searchParams.category || ""} className="input">
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Account</label>
          <select name="account" defaultValue={searchParams.account || ""} className="input">
            <option value="">All</option>
            {Object.entries(ACCOUNT_LABEL).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-semibold text-slate-500 mb-1">Search vendor / notes</label>
          <input type="text" name="q" defaultValue={searchParams.q || ""} placeholder="Amazon, PST..." className="input w-full" />
        </div>
        <button type="submit" className="btn-primary inline-flex items-center gap-2"><Filter className="h-4 w-4" /> Apply</button>
      </form>

      {/* Category breakdown for the active filter */}
      {categoryTotals.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-lg p-4">
          <h2 className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-3">By category in range</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-sm">
            {categoryTotals.map((c) => (
              <div key={c.key} className="bg-slate-50 rounded px-3 py-2">
                <div className="text-slate-700">{c.label}</div>
                <div className="font-semibold text-brand-navy">{usd(c.cents)}</div>
                <div className="text-xs text-slate-400">{c.count} txn</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Table + Add form (client) */}
      <ExpensesClient
        rows={rows.map((r: any) => ({
          ...r,
          amount_cents: Number(r.amount_cents),
          account_label: ACCOUNT_LABEL[r.account] || r.account,
          category_label: categories.find((c) => c.key === r.category)?.label || r.category,
        }))}
        categories={categories}
        accountOptions={Object.entries(ACCOUNT_LABEL).map(([k, l]) => ({ key: k, label: l }))}
      />
    </div>
  );
}
