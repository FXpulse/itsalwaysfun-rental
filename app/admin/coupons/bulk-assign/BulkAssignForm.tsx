"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, X, Plus, Send, Loader2, Users } from "lucide-react";
import { searchCustomers } from "../actions";
import { bulkAssignCoupons } from "./actions";

interface Picked {
  user_id: string;
  email: string;
  referral_code: string | null;
}

export function BulkAssignForm() {
  const router = useRouter();
  const [picked, setPicked] = useState<Picked[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Picked[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Form state
  const [prefix, setPrefix] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("10");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const res = await searchCustomers(query);
      const filtered = res.filter((r) => !picked.find((p) => p.user_id === r.user_id));
      setResults(filtered);
      setSearching(false);
      setShowResults(true);
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, picked]);

  function addCustomer(c: Picked) {
    if (picked.find((p) => p.user_id === c.user_id)) return;
    setPicked([...picked, c]);
    setQuery("");
    setResults([]);
    setShowResults(false);
  }

  function removeCustomer(userId: string) {
    setPicked(picked.filter((p) => p.user_id !== userId));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (picked.length === 0) {
      toast.error("Pick at least one customer");
      return;
    }
    const value = parseFloat(discountValue);
    if (isNaN(value) || value <= 0) {
      toast.error("Discount must be > 0");
      return;
    }
    if (!confirm(`Create ${picked.length} coupon${picked.length === 1 ? "" : "s"} + email each customer?`)) return;
    startTransition(async () => {
      const r = await bulkAssignCoupons({
        customer_user_ids: picked.map((p) => p.user_id),
        prefix: prefix.trim(),
        discount_type: discountType,
        discount_value: value,
        max_uses: maxUses ? parseInt(maxUses, 10) : null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        description: description.trim() || null,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(`Created ${r.created} coupons · ${r.failed} failed`);
      router.push("/admin/coupons");
    });
  }

  const exampleCode = prefix
    ? `${prefix.toUpperCase()}-ABC123`
    : "ABC123";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Customer picker */}
      <div className="card p-5">
        <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" /> 1. Pick customers ({picked.length})
        </h2>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            placeholder="Search customer by email…"
            className="input pl-10"
            autoComplete="off"
          />
          {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-500 animate-spin" />}
          {showResults && results.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.user_id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addCustomer(r)}
                  className="w-full text-left px-3 py-2 hover:bg-violet-50 flex items-center gap-2"
                >
                  <Plus className="h-3.5 w-3.5 text-violet-600" />
                  <span className="text-sm">{r.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {picked.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {picked.map((p) => (
              <span
                key={p.user_id}
                className="inline-flex items-center gap-1 bg-violet-100 text-violet-800 rounded-full pl-2 pr-1 py-0.5 text-xs"
              >
                {p.email}
                <button
                  type="button"
                  onClick={() => removeCustomer(p.user_id)}
                  className="bg-violet-200 hover:bg-violet-300 rounded-full p-0.5"
                  aria-label={`Remove ${p.email}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Discount config */}
      <div className="card p-5">
        <h2 className="font-bold text-slate-800 mb-3">2. Coupon settings</h2>

        <div>
          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
            Code prefix (optional)
          </label>
          <input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            placeholder="SUMMER"
            className="input font-mono"
            maxLength={20}
          />
          <p className="text-xs text-slate-500 mt-1">
            Each customer gets a unique code like <code className="bg-slate-100 px-1 rounded">{exampleCode}</code>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Type</label>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as any)}
              className="input"
            >
              <option value="percent">% off</option>
              <option value="fixed">$ off</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
              Value {discountType === "percent" ? "(1-100)" : "(USD)"}
            </label>
            <input
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              min={1}
              max={discountType === "percent" ? 100 : undefined}
              step={discountType === "percent" ? 1 : 0.01}
              className="input"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
              Max uses each (blank = unlimited)
            </label>
            <input
              type="number"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              min={1}
              className="input"
              placeholder="—"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
              Expires (blank = never)
            </label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Description (optional)</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Summer campaign for top customers"
            className="input"
          />
        </div>
      </div>

      {/* Submit */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex items-start justify-between gap-3 flex-wrap">
        <div className="text-sm text-slate-700">
          <strong>Ready:</strong> {picked.length} customer{picked.length === 1 ? "" : "s"} will get a unique coupon emailed.
        </div>
        <button
          type="submit"
          disabled={pending || picked.length === 0}
          className="bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white font-semibold rounded-lg px-5 py-2 inline-flex items-center gap-1 shadow-sm"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {pending ? "Creating…" : `Create + email ${picked.length}`}
        </button>
      </div>
    </form>
  );
}
