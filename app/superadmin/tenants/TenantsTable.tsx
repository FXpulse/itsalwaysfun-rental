"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Crown, CheckCircle2, AlertTriangle, XCircle, Pause, ExternalLink,
  Mail, Download, Play, X, ClipboardList,
} from "lucide-react";
import { bulkSendEmail, bulkPause, bulkUnpause, bulkExportCsv } from "./bulk-actions";

const QUICK_TEMPLATES = [
  {
    label: "Check-in",
    subject: "Quick check-in from RentalFlow",
    body: "Hi {first_name},\n\nJust checking in to see how things are going with RentalFlow. Anything we can help with this week?\n\nReply directly to this email and I'll get back to you.\n\nBest,\nLudmila",
  },
  {
    label: "New feature",
    subject: "Something new in RentalFlow",
    body: "Hi {first_name},\n\nWe just shipped a new feature you might find useful:\n\n[describe feature here]\n\nLogin at https://getrentalflow.com/admin to try it.\n\nLet me know what you think!\n\nLudmila",
  },
  {
    label: "Payment reminder",
    subject: "Your RentalFlow payment",
    body: "Hi {first_name},\n\nQuick reminder: your subscription payment for {business_name} is past due. To keep your account active, please update your payment method at https://getrentalflow.com/admin/settings/billing\n\nIf you're having trouble, reply to this email and I'll help personally.\n\nLudmila",
  },
  {
    label: "Cancellation save",
    subject: "Before you go — can we help?",
    body: "Hi {first_name},\n\nI noticed {business_name} is considering cancelling. Before you do, I'd love to understand what's not working.\n\nWould a 15-minute call help? Or if there's a specific feature gap, let me know — I can prioritize it.\n\nReply with what's on your mind.\n\nLudmila",
  },
];

interface Tenant {
  id: string;
  slug: string;
  business_name: string;
  owner_email: string;
  plan: string;
  subscription_status: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  custom_domain: string | null;
  suspended_at: string | null;
  created_at: string;
}

interface ChecklistProgress {
  tenant_id: string;
  pct: number;
  completed: number;
  total: number;
  required_pending: number;
}

export function TenantsTable({
  tenants,
  checklists = {},
}: {
  tenants: Tenant[];
  checklists?: Record<string, ChecklistProgress>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showEmail, setShowEmail] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  }
  function selectAll(on: boolean) {
    setSelected(on ? new Set(tenants.map((t) => t.id)) : new Set());
  }

  function handlePause() {
    if (!confirm(`Pause ${selected.size} tenants? Their /admin will show suspended notice.`)) return;
    startTransition(async () => {
      const r = await bulkPause(Array.from(selected));
      if ("error" in r) toast.error(r.error);
      else { toast.success(`Paused ${r.count} tenants`); setSelected(new Set()); }
    });
  }
  function handleUnpause() {
    startTransition(async () => {
      const r = await bulkUnpause(Array.from(selected));
      if ("error" in r) toast.error(r.error);
      else { toast.success(`Resumed ${r.count} tenants`); setSelected(new Set()); }
    });
  }
  function handleExport() {
    startTransition(async () => {
      const r = await bulkExportCsv(Array.from(selected));
      if (typeof r !== "string") { toast.error("error" in r ? r.error : "Failed"); return; }
      const blob = new Blob([r], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tenants_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${selected.size} tenants`);
    });
  }
  function handleSendEmail(formData: FormData) {
    const subject = (formData.get("subject") || "").toString();
    const body = (formData.get("body") || "").toString();
    startTransition(async () => {
      const r = await bulkSendEmail(Array.from(selected), subject, body);
      if ("error" in r) toast.error(r.error);
      else {
        toast.success(`Sent ${r.sent} · failed ${r.failed}`);
        setSelected(new Set());
        setShowEmail(false);
      }
    });
  }

  const allSelected = selected.size === tenants.length && tenants.length > 0;

  return (
    <>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => selectAll(e.target.checked)}
                  aria-label="Select all"
                />
              </th>
              <th className="px-3 py-2 text-left">Tenant</th>
              <th className="px-3 py-2 text-left">Plan</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Checklist</th>
              <th className="px-3 py-2 text-left">Owner</th>
              <th className="px-3 py-2 text-left">Created</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tenants.map((t) => {
              const url = t.custom_domain
                ? `https://${t.custom_domain}`
                : `https://${t.slug}.getrentalflow.com`;
              const isSel = selected.has(t.id);
              return (
                <tr key={t.id} className={
                  t.suspended_at ? "bg-red-50" : isSel ? "bg-indigo-50" : ""
                }>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggle(t.id)}
                      aria-label={`Select ${t.business_name}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/superadmin/tenants/${t.id}`}
                      className="font-medium text-brand-navy hover:underline"
                    >
                      {t.business_name}
                    </Link>
                    <div className="text-[11px] text-slate-500 font-mono">{t.slug}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {t.plan === "founder" ? (
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                        <Crown className="h-3 w-3" /> Founder
                      </span>
                    ) : (
                      <span className="capitalize bg-slate-100 px-2 py-0.5 rounded">
                        {t.plan}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={t.subscription_status} suspended={!!t.suspended_at} />
                  </td>
                  <td className="px-3 py-2">
                    <ChecklistCell progress={checklists[t.id]} tenantId={t.id} />
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    <a href={`mailto:${t.owner_email}`} className="hover:text-brand-navy hover:underline">
                      {t.owner_email}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-navy hover:underline inline-flex items-center gap-1">
                      Visit <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              );
            })}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                  No tenants yet. The first signup will appear here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Floating bulk action bar */}
      {selected.size > 0 && !showEmail && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold">{selected.size} selected</span>
          <button
            onClick={() => setShowEmail(true)}
            disabled={pending}
            className="bg-violet-600 hover:bg-violet-700 disabled:bg-slate-600 px-3 py-1.5 rounded text-xs font-semibold inline-flex items-center gap-1"
          >
            <Mail className="h-3.5 w-3.5" /> Email
          </button>
          <button
            onClick={handlePause}
            disabled={pending}
            className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-600 px-3 py-1.5 rounded text-xs font-semibold inline-flex items-center gap-1"
          >
            <Pause className="h-3.5 w-3.5" /> Pause
          </button>
          <button
            onClick={handleUnpause}
            disabled={pending}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 px-3 py-1.5 rounded text-xs font-semibold inline-flex items-center gap-1"
          >
            <Play className="h-3.5 w-3.5" /> Resume
          </button>
          <button
            onClick={handleExport}
            disabled={pending}
            className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 px-3 py-1.5 rounded text-xs font-semibold inline-flex items-center gap-1"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button
            onClick={() => setSelected(new Set())}
            disabled={pending}
            className="text-slate-400 hover:text-white"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Email modal with recipient preview */}
      {showEmail && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            action={handleSendEmail}
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4"
          >
            <h2 className="font-bold text-brand-navy text-lg flex items-center gap-2">
              <Mail className="h-5 w-5" /> Email {selected.size} tenants
            </h2>

            {/* Recipient preview */}
            <details className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                Recipients ({selected.size}) — click to preview
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                {tenants.filter((t) => selected.has(t.id)).map((t) => (
                  <div key={t.id} className="text-xs text-slate-700 flex items-center justify-between">
                    <span className="truncate">{t.business_name}</span>
                    <span className="text-slate-500 font-mono">{t.owner_email}</span>
                  </div>
                ))}
              </div>
            </details>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Subject</label>
              <input name="subject" required className="input" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                Body — use {`{business_name}`} or {`{first_name}`} for personalization
              </label>
              <textarea name="body" required rows={10} className="input font-mono text-sm" />
            </div>

            {/* Template shortcuts */}
            <div className="bg-violet-50 border border-violet-200 rounded-lg p-3">
              <div className="text-[10px] uppercase font-bold tracking-wider text-violet-700 mb-2">Quick templates</div>
              <div className="flex flex-wrap gap-1">
                {QUICK_TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={(e) => {
                      const form = (e.target as HTMLElement).closest("form")!;
                      (form.querySelector('[name="subject"]') as HTMLInputElement).value = t.subject;
                      (form.querySelector('[name="body"]') as HTMLTextAreaElement).value = t.body;
                    }}
                    className="text-[10px] bg-white hover:bg-violet-100 text-violet-700 ring-1 ring-violet-200 rounded-full px-2 py-0.5"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Sent from your configured EMAIL_FROM. Each tenant gets a personalized copy.
            </p>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white font-semibold rounded-lg px-4 py-2 text-sm"
              >
                {pending ? "Sending…" : `Send to ${selected.size}`}
              </button>
              <button
                type="button"
                onClick={() => setShowEmail(false)}
                className="text-slate-500 hover:text-slate-700 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function ChecklistCell({ progress, tenantId }: { progress?: ChecklistProgress; tenantId: string }) {
  if (!progress || progress.total === 0) {
    return (
      <Link
        href={`/superadmin/tenants/${tenantId}/checklist`}
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-navy hover:underline"
      >
        <ClipboardList className="h-3 w-3" /> Open
      </Link>
    );
  }
  const pct = progress.pct;
  const cls = pct >= 90 ? "bg-emerald-100 text-emerald-800 border-emerald-300"
    : pct >= 60 ? "bg-blue-100 text-blue-800 border-blue-300"
    : pct >= 30 ? "bg-amber-100 text-amber-800 border-amber-300"
    : "bg-rose-100 text-rose-800 border-rose-300";
  return (
    <Link
      href={`/superadmin/tenants/${tenantId}/checklist`}
      title={`${progress.completed} of ${progress.total} items complete${progress.required_pending > 0 ? ` · ${progress.required_pending} required pending` : ""}`}
      className={`inline-flex items-center gap-1.5 text-xs font-bold border rounded-full px-2 py-0.5 hover:shadow ${cls}`}
    >
      <ClipboardList className="h-3 w-3" />
      <span>{pct}%</span>
      <span className="text-[10px] opacity-70 font-mono">{progress.completed}/{progress.total}</span>
      {progress.required_pending > 0 && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-600 ml-0.5" title="Required items pending" />
      )}
    </Link>
  );
}

function StatusBadge({ status, suspended }: { status: string | null; suspended: boolean }) {
  if (suspended) {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
        <Pause className="h-3 w-3" /> Suspended
      </span>
    );
  }
  if (!status) return <span className="text-xs text-slate-400">No sub</span>;
  const map: Record<string, { cls: string; icon: any }> = {
    active: { cls: "bg-emerald-100 text-emerald-800", icon: <CheckCircle2 className="h-3 w-3" /> },
    trialing: { cls: "bg-blue-100 text-blue-800", icon: <CheckCircle2 className="h-3 w-3" /> },
    past_due: { cls: "bg-amber-100 text-amber-800", icon: <AlertTriangle className="h-3 w-3" /> },
    canceled: { cls: "bg-slate-200 text-slate-700", icon: <XCircle className="h-3 w-3" /> },
  };
  const v = map[status] || { cls: "bg-slate-100 text-slate-600", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${v.cls}`}>
      {v.icon} {status.replace(/_/g, " ")}
    </span>
  );
}
