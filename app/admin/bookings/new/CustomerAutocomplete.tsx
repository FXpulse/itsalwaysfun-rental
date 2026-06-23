"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, Loader2, UserCheck, UserPlus } from "lucide-react";
import { searchBookingCustomers, type CustomerMatch } from "../actions";

/** Autocomplete that surfaces existing customers from the bookings table.
 *  Sits ABOVE the customer fields in the manual-booking form. When the
 *  operator picks an existing customer, the parent form's customer fields
 *  are auto-filled via the onPick callback. The fields remain editable —
 *  the autocomplete is a shortcut, not a lock. */
export function CustomerAutocomplete({
  onPick,
  onClear,
  pickedEmail,
}: {
  onPick: (c: CustomerMatch) => void;
  onClear: () => void;
  pickedEmail: string | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const res = await searchBookingCustomers(query);
      setResults(res);
      setSearching(false);
      setShowResults(true);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  if (pickedEmail) {
    return (
      <div className="rounded-md border-2 border-emerald-300 bg-emerald-50 px-3 py-2 flex items-center gap-2">
        <UserCheck className="h-5 w-5 text-emerald-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider font-bold text-emerald-700">
            Reusing existing customer
          </div>
          <div className="text-sm font-mono text-slate-700 truncate">{pickedEmail}</div>
        </div>
        <button
          type="button"
          onClick={() => { onClear(); setQuery(""); setResults([]); }}
          className="text-emerald-700 hover:text-red-600 text-xs font-semibold inline-flex items-center gap-1"
          title="Detach and edit fields manually"
        >
          <X className="h-3 w-3" /> New customer
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <label className="block text-xs uppercase tracking-wider font-bold text-amber-700 mb-1">
        Returning customer?
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          placeholder="Search by name, email or phone — e.g. Rebecca"
          className="input pl-10 border-amber-300 focus:border-amber-500"
          autoComplete="off"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500 animate-spin" />
        )}
      </div>
      <p className="text-[11px] text-slate-500 mt-1">
        Pick from the list to avoid duplicates. Leave empty to enter a brand-new customer below.
      </p>

      {showResults && results.length > 0 && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-80 overflow-y-auto">
          {results.map((r) => {
            const fullName = `${r.first_name} ${r.last_name}`.trim();
            return (
              <button
                key={r.email}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(r);
                  setQuery("");
                  setShowResults(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-amber-50 border-b last:border-b-0 border-slate-100"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-800 truncate">
                      {fullName}
                      {r.bookings_count > 1 && (
                        <span className="ml-2 inline-block bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          {r.bookings_count} bookings
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {r.email}{r.phone ? ` · ${r.phone}` : ""}
                    </div>
                  </div>
                  {r.last_event_date && (
                    <div className="text-[10px] text-slate-400 font-mono">
                      last: {r.last_event_date}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
      {showResults && query.length >= 2 && !searching && results.length === 0 && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-md shadow p-3 inline-flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-slate-400" />
          <p className="text-xs text-slate-600">
            No matching customer — looks new. Fill the form below.
          </p>
        </div>
      )}
    </div>
  );
}
