"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Check,
  X,
  FileText,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  upsertDriverTaxProfile,
  markW9Received,
  markYearFiled,
  unmarkYearFiled,
} from "./actions";
import type { NinetyNineRow, NinetyNineSummary } from "@/lib/reports-1099";
import { formatDateInTz } from "@/lib/tenant/timezone";

export function NinetyNineNECManager({ summary, tz = "America/New_York" }: { summary: NinetyNineSummary; tz?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<NinetyNineRow | null>(null);

  function handleProfileSubmit(formData: FormData) {
    if (!editing) return;
    startTransition(async () => {
      const r = await upsertDriverTaxProfile(editing.driver_email, formData);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Profile saved");
      setEditing(null);
      router.refresh();
    });
  }

  function handleMarkW9(row: NinetyNineRow) {
    const path = prompt(
      `Mark W9 as received for ${row.driver_email}?\n\nOptional: paste the storage path of the uploaded W9 file (or leave blank to mark received only).`,
      "",
    );
    if (path === null) return; // cancelled
    startTransition(async () => {
      const r = await markW9Received(row.driver_email, path.trim() || null);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("W9 marked received");
      router.refresh();
    });
  }

  function handleToggleFiled(row: NinetyNineRow) {
    const isFiled = !!row.filed_at;
    if (isFiled) {
      if (!confirm(`Unmark ${row.driver_email} 1099 as filed for ${summary.year}?`))
        return;
      startTransition(async () => {
        const r = await unmarkYearFiled(row.driver_email, summary.year);
        if (r.error) {
          toast.error(r.error);
          return;
        }
        toast.success("Unmarked");
        router.refresh();
      });
    } else {
      if (!confirm(`Mark 1099-NEC as filed for ${row.driver_email} (year ${summary.year})?`))
        return;
      startTransition(async () => {
        const r = await markYearFiled(row.driver_email, summary.year);
        if (r.error) {
          toast.error(r.error);
          return;
        }
        toast.success(`Marked filed for ${summary.year}`);
        router.refresh();
      });
    }
  }

  if (summary.drivers.length === 0) {
    return (
      <div className="card text-center py-12 text-slate-400 text-sm">
        No labor expenses with a driver_email tagged in {summary.year}.
        <br />
        When recording payroll on a booking, make sure to fill in the driver
        email so 1099 totals roll up here.
      </div>
    );
  }

  return (
    <>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Driver</th>
              <th className="px-3 py-2 text-right">Paid {summary.year}</th>
              <th className="px-3 py-2 text-right">Hours</th>
              <th className="px-3 py-2 text-right">Bookings</th>
              <th className="px-3 py-2 text-left">W9</th>
              <th className="px-3 py-2 text-left">TIN</th>
              <th className="px-3 py-2 text-left">Address</th>
              <th className="px-3 py-2 text-left">Filed</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {summary.drivers.map((r) => {
              const isReadyToFile =
                r.qualifies && !!r.w9_received_at && r.address_complete && !!r.tin_last4;
              return (
                <tr
                  key={r.driver_email}
                  className={r.qualifies ? "" : "opacity-60"}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-xs">
                      {r.full_name || (
                        <span className="text-slate-400 italic">no name</span>
                      )}
                      {r.business_name && (
                        <span className="text-slate-500 text-[10px]">
                          {" "}
                          / {r.business_name}
                        </span>
                      )}
                    </div>
                    <a
                      href={`mailto:${r.driver_email}`}
                      className="text-[11px] text-slate-500 hover:text-brand-navy hover:underline"
                    >
                      {r.driver_email}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-brand-navy">
                    ${(r.total_paid_cents / 100).toFixed(2)}
                    {r.qualifies && (
                      <div className="text-[10px] text-emerald-700 font-normal">
                        ≥ ${(summary.threshold_cents / 100).toFixed(0)} threshold
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-600">
                    {r.total_hours.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-600">
                    {r.bookings_count}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.w9_received_at ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />{" "}
                        {formatDateInTz(r.w9_received_at, tz)}
                      </span>
                    ) : r.qualifies ? (
                      <span className="inline-flex items-center gap-1 text-red-600">
                        <AlertTriangle className="h-3 w-3" /> missing
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs font-mono">
                    {r.tin_last4 ? (
                      <span className="text-slate-700">···{r.tin_last4}</span>
                    ) : r.qualifies ? (
                      <span className="text-red-600">—</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.address_complete ? (
                      <span className="text-emerald-700">✓ complete</span>
                    ) : r.qualifies ? (
                      <span className="text-red-600">incomplete</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.filed_at ? (
                      <span
                        className="inline-flex items-center gap-1 text-emerald-700 cursor-pointer hover:text-emerald-900"
                        onClick={() => handleToggleFiled(r)}
                        title="Click to unmark"
                      >
                        <CheckCircle2 className="h-3 w-3" />{" "}
                        {formatDateInTz(r.filed_at, tz)}
                      </span>
                    ) : r.qualifies ? (
                      <button
                        onClick={() => handleToggleFiled(r)}
                        disabled={pending || !isReadyToFile}
                        className="text-xs text-slate-600 hover:text-emerald-700 disabled:opacity-30"
                        title={
                          isReadyToFile
                            ? "Mark filed for this year"
                            : "Complete W9, TIN, and address first"
                        }
                      >
                        Mark filed
                      </button>
                    ) : (
                      <span className="text-slate-400">N/A</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <button
                      onClick={() => setEditing(r)}
                      className="text-xs text-slate-600 hover:text-brand-navy inline-flex items-center gap-0.5"
                      title="Edit tax profile"
                    >
                      <Pencil className="h-3 w-3" /> Profile
                    </button>
                    {!r.w9_received_at && r.qualifies && (
                      <button
                        onClick={() => handleMarkW9(r)}
                        disabled={pending}
                        className="text-xs text-amber-700 hover:text-amber-900 inline-flex items-center gap-0.5"
                        title="Mark W9 as received"
                      >
                        <FileText className="h-3 w-3" /> W9
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-900 space-y-1">
        <p>
          💡 <strong>Workflow at year end (January):</strong>
        </p>
        <ol className="list-decimal pl-5 space-y-0.5">
          <li>Switch year to the closing tax year (e.g. {summary.year - 1})</li>
          <li>For every QUALIFYING driver missing W9 or TIN/address: request the missing info, then fill in via Profile + Mark W9</li>
          <li>Download CSV → upload to your 1099-NEC filing service (Track1099, eFile4Biz, your accountant)</li>
          <li>After filing each one, click "Mark filed" so you know what's done</li>
          <li>IRS deadline: <strong>January 31</strong> for recipient copy + IRS filing</li>
        </ol>
      </div>

      {editing && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-semibold text-brand-navy">
                  Tax profile
                </h2>
                <p className="text-xs text-slate-500">{editing.driver_email}</p>
              </div>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form action={handleProfileSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">
                    Full legal name (as on W9) *
                  </label>
                  <input
                    name="full_name"
                    defaultValue={editing.full_name || ""}
                    placeholder="John Q. Smith"
                    className="input"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">
                    Business name / DBA (if any)
                  </label>
                  <input
                    name="business_name"
                    defaultValue={editing.business_name || ""}
                    placeholder="Smith Party Rentals LLC"
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">
                    TIN last 4 (SSN or EIN)
                  </label>
                  <input
                    name="tin_last4"
                    defaultValue={editing.tin_last4 || ""}
                    placeholder="1234"
                    pattern="\d{4}"
                    maxLength={4}
                    className="input font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Don't store the full SSN/EIN here — just the last 4 for verification.
                    The full TIN lives on the W9 PDF in private storage.
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">
                    State
                  </label>
                  <input
                    name="state"
                    defaultValue={editing.state || ""}
                    placeholder="FL"
                    maxLength={2}
                    className="input font-mono uppercase"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-600 mb-1">
                    Address line 1
                  </label>
                  <input
                    name="address_line1"
                    defaultValue={editing.address_line1 || ""}
                    placeholder="123 Main St"
                    className="input"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-600 mb-1">
                    Address line 2 (optional)
                  </label>
                  <input
                    name="address_line2"
                    defaultValue={editing.address_line2 || ""}
                    placeholder="Apt 4B"
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">
                    City
                  </label>
                  <input
                    name="city"
                    defaultValue={editing.city || ""}
                    placeholder="Jacksonville"
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">ZIP</label>
                  <input
                    name="zip"
                    defaultValue={editing.zip || ""}
                    placeholder="32256"
                    className="input"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-600 mb-1">
                    Notes (private)
                  </label>
                  <textarea
                    name="notes"
                    rows={2}
                    defaultValue={editing.notes || ""}
                    className="input"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <button type="submit" disabled={pending} className="btn-primary">
                  <Check className="h-4 w-4 inline mr-1" />{" "}
                  {pending ? "Saving..." : "Save profile"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="text-sm text-slate-600 hover:text-slate-900 px-3 py-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
