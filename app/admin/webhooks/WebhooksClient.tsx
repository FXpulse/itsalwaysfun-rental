"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Copy, X, Trash2, Power, Send, CheckCircle2, AlertTriangle } from "lucide-react";
import { createWebhook, toggleWebhook, deleteWebhook, testWebhook } from "./actions";

interface Hook {
  id: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  last_delivery_at: string | null;
  last_delivery_status: number | null;
  total_deliveries: number;
  failed_deliveries: number;
  created_at: string;
}

const EVENT_OPTIONS = [
  "booking.created", "booking.confirmed", "booking.cancelled", "booking.paid",
  "customer.created", "quote.sent", "quote.approved", "*",
];

export function WebhooksClient({ hooks }: { hooks: Hook[] }) {
  const [showForm, setShowForm] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const r = await createWebhook(formData);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setNewSecret(r.secret);
      setShowForm(false);
      toast.success("Webhook created");
    });
  }

  return (
    <>
      {/* Just-created secret reveal */}
      {newSecret && (
        <div className="card bg-gradient-to-br from-emerald-50 to-teal-50 ring-2 ring-emerald-300 p-5">
          <div className="flex items-center gap-2 text-emerald-700 font-bold mb-2">
            <CheckCircle2 className="h-5 w-5" /> Your signing secret — copy it now
          </div>
          <p className="text-xs text-slate-600 mb-3">
            Use this to verify incoming webhooks. We'll only show it once.
          </p>
          <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-3">
            <code className="text-emerald-300 text-xs font-mono flex-1 break-all">
              {newSecret}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newSecret);
                toast.success("Copied to clipboard");
              }}
              className="bg-emerald-500 hover:bg-emerald-600 text-white rounded px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>
          <button onClick={() => setNewSecret(null)} className="mt-3 text-xs text-slate-500 hover:text-slate-700 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      {showForm ? (
        <form action={handleSubmit} className="card border-2 border-violet-300 p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Name</label>
            <input name="name" required placeholder="e.g. Zapier booking sync" className="input" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Receiver URL</label>
            <input
              name="url" type="url" required
              placeholder="https://hooks.zapier.com/hooks/catch/..."
              className="input"
            />
            <p className="text-xs text-slate-500 mt-1">Must be HTTPS.</p>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Subscribe to events</label>
            <div className="grid sm:grid-cols-2 gap-1">
              {EVENT_OPTIONS.map((e) => (
                <label key={e} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox" name="event" value={e}
                    defaultChecked={e === "booking.created"}
                  />
                  <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{e}</code>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit" disabled={pending}
              className="bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white font-semibold rounded-lg px-4 py-2 text-sm inline-flex items-center gap-1"
            >
              <Plus className="h-4 w-4" /> Create webhook
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-500 hover:text-slate-700 text-sm">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-lg px-4 py-2 text-sm inline-flex items-center gap-1 shadow"
        >
          <Plus className="h-4 w-4" /> New webhook
        </button>
      )}

      {/* List */}
      <div className="card p-0 overflow-hidden">
        <div className="bg-slate-50 px-4 py-2 border-b text-xs uppercase tracking-wider font-bold text-slate-600">
          Webhooks ({hooks.length})
        </div>
        {hooks.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 text-center">
            No webhooks yet. Create one to start receiving events.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {hooks.map((h) => (
              <HookRow key={h.id} h={h} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function HookRow({ h }: { h: Hook }) {
  const [pending, startTransition] = useTransition();
  const lastOk = h.last_delivery_status && h.last_delivery_status >= 200 && h.last_delivery_status < 300;

  function handleToggle() {
    startTransition(async () => {
      const r = await toggleWebhook(h.id, !h.is_active);
      if (r.error) toast.error(r.error);
      else toast.success(h.is_active ? "Disabled" : "Enabled");
    });
  }
  function handleDelete() {
    if (!confirm(`Delete "${h.name}"? Integrations will stop immediately.`)) return;
    startTransition(async () => {
      const r = await deleteWebhook(h.id);
      if (r.error) toast.error(r.error);
      else toast.success("Deleted");
    });
  }
  function handleTest() {
    startTransition(async () => {
      const r = await testWebhook(h.id);
      if (r.error) toast.error(r.error);
      else toast.success("Test event sent");
    });
  }

  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-slate-800 text-sm">{h.name}</span>
          {!h.is_active && <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 rounded-full">PAUSED</span>}
        </div>
        <code className="text-xs text-slate-600 truncate block">{h.url}</code>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {h.events.map((e) => (
            <span key={e} className="text-[10px] bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded-full">{e}</span>
          ))}
        </div>
        {h.last_delivery_at && (
          <div className={`text-[10px] mt-1 inline-flex items-center gap-1 ${lastOk ? "text-emerald-700" : "text-rose-700"}`}>
            {lastOk ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            Last delivery {new Date(h.last_delivery_at).toLocaleString()} · HTTP {h.last_delivery_status}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={handleTest} disabled={pending} className="text-slate-500 hover:text-violet-600 p-1.5" title="Send test event">
          <Send className="h-4 w-4" />
        </button>
        <button onClick={handleToggle} disabled={pending} className="text-slate-500 hover:text-amber-600 p-1.5" title={h.is_active ? "Pause" : "Resume"}>
          <Power className="h-4 w-4" />
        </button>
        <button onClick={handleDelete} disabled={pending} className="text-slate-400 hover:text-rose-600 p-1.5" title="Delete">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
