"use client";

// Lightweight customer search/select. Used in the coupon form to assign a
// referrer. Search-as-you-type calls the searchCustomers server action.

import { useState, useEffect, useRef } from "react";
import { Search, X, Loader2, UserPlus } from "lucide-react";
import { searchCustomers, findOrCreateCustomerByEmail } from "./actions";
import { toast } from "sonner";

interface Selected {
  user_id: string;
  email: string;
  referral_code: string | null;
}

export function ReferrerPicker({
  initialUserId, initialEmail, disabled,
}: {
  initialUserId: string | null;
  initialEmail: string | null;
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState<Selected | null>(
    initialUserId && initialEmail
      ? { user_id: initialUserId, email: initialEmail, referral_code: null }
      : null,
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Selected[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [creating, setCreating] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const trimmedQuery = query.trim();
  const looksLikeEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedQuery);

  async function handleCreateAndUse() {
    if (!looksLikeEmail || creating) return;
    setCreating(true);
    const res = await findOrCreateCustomerByEmail(trimmedQuery);
    setCreating(false);
    if (res.error || !res.user_id || !res.email) {
      toast.error(res.error || "Failed to add customer");
      return;
    }
    setSelected({ user_id: res.user_id, email: res.email, referral_code: null });
    setQuery("");
    setShowResults(false);
    toast.success("Customer ready — will receive coupon when you save");
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2 || selected) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const res = await searchCustomers(query);
      setResults(res);
      setSearching(false);
      setShowResults(true);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selected]);

  if (selected) {
    return (
      <div className="flex items-center gap-2">
        <input type="hidden" name="referrer_user_id" value={selected.user_id} />
        <div className="flex-1 bg-white border border-violet-300 rounded-md px-3 py-2 flex items-center gap-2">
          <div className="bg-violet-100 text-violet-700 font-bold rounded-full h-6 w-6 flex items-center justify-center text-xs">
            👤
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-800 truncate">{selected.email}</div>
            {selected.referral_code && (
              <div className="text-[10px] text-slate-500 font-mono">ref: {selected.referral_code}</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setSelected(null); setQuery(""); }}
            disabled={disabled}
            className="text-slate-400 hover:text-rose-600"
            title="Remove assignment"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <input type="hidden" name="referrer_user_id" value="" />
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          placeholder="Search by customer email…"
          className="input pl-10"
          disabled={disabled}
          autoComplete="off"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-500 animate-spin" />
        )}
      </div>
      {showResults && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.user_id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}     // prevent blur
              onClick={() => {
                setSelected(r);
                setQuery("");
                setShowResults(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-violet-50 flex items-center gap-2"
            >
              <div className="bg-violet-100 text-violet-700 font-bold rounded-full h-6 w-6 flex items-center justify-center text-xs">
                👤
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{r.email}</div>
                {r.referral_code && (
                  <div className="text-[10px] text-slate-500 font-mono">ref: {r.referral_code}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      {showResults && query.length >= 2 && !searching && results.length === 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-md shadow p-3">
          <p className="text-xs text-slate-600 mb-2">No matching customer found.</p>
          {looksLikeEmail ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCreateAndUse}
              disabled={creating || disabled}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded px-3 py-2 inline-flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <UserPlus className="h-3 w-3" />
              {creating ? "Adding..." : `Add "${trimmedQuery}" and use for this coupon`}
            </button>
          ) : (
            <p className="text-[11px] text-slate-400">
              Type a full email address to add a new customer.
            </p>
          )}
        </div>
      )}
      <p className="text-[10px] text-slate-500 mt-1">
        Leave empty for a regular admin coupon (no commission attribution). New customers will receive the coupon by email and can claim it any time.
      </p>
    </div>
  );
}
