"use client";

// Lightweight customer search/select. Used in the coupon form to assign a
// referrer. Search-as-you-type calls the searchCustomers server action.

import { useState, useEffect, useRef } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { searchCustomers } from "./actions";

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
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

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
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-md shadow p-3 text-xs text-slate-500">
          No customers found. They need to have logged into the portal at least once.
        </div>
      )}
      <p className="text-[10px] text-slate-500 mt-1">
        Leave empty for a regular admin coupon (no commission attribution).
      </p>
    </div>
  );
}
