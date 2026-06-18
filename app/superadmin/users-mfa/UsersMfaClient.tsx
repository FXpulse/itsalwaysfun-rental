"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ShieldOff, Check, AlertCircle } from "lucide-react";
import { resetUserMfaAction } from "./actions";

export interface UserMfaRow {
  userId: string;
  email: string;
  roles: { role: string; tenantName: string; isSuperadmin: boolean }[];
  verifiedFactors: number;
  totalFactors: number;
  isSelf: boolean;
}

export function UsersMfaClient({ rows }: { rows: UserMfaRow[] }) {
  const [filter, setFilter] = useState("");
  const [pending, startTransition] = useTransition();
  const [recentlyReset, setRecentlyReset] = useState<Set<string>>(new Set());

  function resetUser(row: UserMfaRow) {
    if (
      !confirm(
        `Reset MFA for ${row.email}?\n\nThis deletes all their TOTP factors.\nThey can log in with password + will be forced to enroll a new device on next /admin visit.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const r = await resetUserMfaAction({ userId: row.userId });
      if ((r as any).error) {
        toast.error((r as any).error);
        return;
      }
      toast.success(`MFA reset for ${row.email}`);
      setRecentlyReset((s) => new Set(s).add(row.userId));
    });
  }

  const filtered = rows.filter((r) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      r.email.toLowerCase().includes(q) ||
      r.roles.some((ro) => ro.tenantName.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by email or tenant…"
        className="w-full border border-slate-300 rounded px-3 py-2 text-sm mb-4 focus:border-brand-navy outline-none"
      />

      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-6">No users match.</p>
        )}
        {filtered.map((row) => {
          const isReset = recentlyReset.has(row.userId);
          const hasMfa = row.verifiedFactors > 0;
          return (
            <div
              key={row.userId}
              className={`border border-slate-200 rounded p-3 flex items-start justify-between gap-3 ${
                isReset ? "bg-emerald-50 border-emerald-200" : "bg-white"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800 text-sm">
                    {row.email}
                  </span>
                  {row.isSelf && (
                    <span className="text-[10px] uppercase tracking-wider bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-bold">
                      You
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {row.roles.map((ro, i) => (
                    <span
                      key={i}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        ro.isSuperadmin
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {ro.role}
                      {ro.isSuperadmin ? " · superadmin" : ` · ${ro.tenantName}`}
                    </span>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-xs">
                  {hasMfa ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                      <Check className="h-3 w-3" />
                      {row.verifiedFactors} verified factor
                      {row.verifiedFactors !== 1 && "s"}
                      {row.totalFactors > row.verifiedFactors &&
                        ` (${row.totalFactors - row.verifiedFactors} unverified)`}
                    </span>
                  ) : isReset ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                      <Check className="h-3 w-3" /> Reset — user must re-enroll
                    </span>
                  ) : row.totalFactors > 0 ? (
                    <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                      <AlertCircle className="h-3 w-3" />
                      {row.totalFactors} unverified factor
                      {row.totalFactors !== 1 && "s"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      No MFA enrolled
                    </span>
                  )}
                </div>
              </div>
              {(hasMfa || row.totalFactors > 0) && !isReset && (
                <button
                  onClick={() => resetUser(row)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded shrink-0"
                >
                  <ShieldOff className="h-3 w-3" />
                  Reset MFA
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
