"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Copy, X, Trash2, ShieldAlert, CheckCircle2, Clock } from "lucide-react";
import { createApiKey, revokeApiKey } from "./actions";
import { formatDateInTz } from "@/lib/tenant/timezone";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  last_used_ip: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  created_by_email: string | null;
}

const SCOPE_OPTIONS = [
  { value: "bookings:read", label: "Read bookings" },
  { value: "bookings:write", label: "Create bookings (POST /v1/bookings)" },
  { value: "customers:read", label: "Read customers" },
  { value: "products:read", label: "Read products" },
  { value: "*", label: "All scopes (current + future)" },
];

export function ApiKeysClient({ keys, tz = "America/New_York" }: { keys: ApiKey[]; tz?: string }) {
  const [showForm, setShowForm] = useState(false);
  const [createdKey, setCreatedKey] = useState<{ full_key: string; key_prefix: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createApiKey(formData);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setCreatedKey({ full_key: result.full_key, key_prefix: result.key_prefix });
      setShowForm(false);
      toast.success("API key created");
    });
  }

  function handleRevoke(id: string, name: string) {
    if (!confirm(`Revoke "${name}"? Integrations using this key will stop working immediately.`)) return;
    startTransition(async () => {
      const r = await revokeApiKey(id);
      if (r.error) toast.error(r.error);
      else toast.success("Key revoked");
    });
  }

  const active = keys.filter((k) => !k.revoked_at);
  const revoked = keys.filter((k) => k.revoked_at);

  return (
    <>
      {/* Just-created key reveal */}
      {createdKey && (
        <div className="card bg-gradient-to-br from-emerald-50 to-teal-50 ring-2 ring-emerald-300 p-5">
          <div className="flex items-center gap-2 text-emerald-700 font-bold mb-2">
            <CheckCircle2 className="h-5 w-5" /> Your new key — copy it now
          </div>
          <p className="text-xs text-slate-600 mb-3">
            This is the ONLY time you'll see the full key. Store it somewhere safe.
            We only keep a hash on our side.
          </p>
          <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-3">
            <code className="text-emerald-300 text-xs font-mono flex-1 break-all">
              {createdKey.full_key}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(createdKey.full_key);
                toast.success("Copied to clipboard");
              }}
              className="bg-emerald-500 hover:bg-emerald-600 text-white rounded px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>
          <button
            onClick={() => setCreatedKey(null)}
            className="mt-3 text-xs text-slate-500 hover:text-slate-700 underline"
          >
            I've copied it — dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      {showForm ? (
        <form
          action={handleSubmit}
          className="card border-2 border-violet-300 p-5 space-y-4"
        >
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Name</label>
            <input
              name="name"
              required
              placeholder="e.g. Zapier integration, My back-office, QuickBooks sync"
              className="input"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Scopes</label>
            <div className="space-y-1">
              {SCOPE_OPTIONS.map((s) => (
                <label key={s.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="scope"
                    value={s.value}
                    defaultChecked={s.value === "bookings:read"}
                  />
                  <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{s.value}</code>
                  <span className="text-slate-600">— {s.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Expires</label>
            <select name="expires_in" className="input" defaultValue="never">
              <option value="never">Never</option>
              <option value="30d">30 days</option>
              <option value="90d">90 days</option>
              <option value="1y">1 year</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white font-semibold rounded-lg px-4 py-2 text-sm inline-flex items-center gap-1"
            >
              <Plus className="h-4 w-4" /> Create key
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-slate-500 hover:text-slate-700 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-lg px-4 py-2 text-sm inline-flex items-center gap-1 shadow"
        >
          <Plus className="h-4 w-4" /> Create new API key
        </button>
      )}

      {/* Active keys */}
      <div className="card p-0 overflow-hidden">
        <div className="bg-slate-50 px-4 py-2 border-b text-xs uppercase tracking-wider font-bold text-slate-600">
          Active keys ({active.length})
        </div>
        {active.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 text-center">
            No API keys yet. Create one to get started.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {active.map((k) => (
              <KeyRow key={k.id} k={k} onRevoke={() => handleRevoke(k.id, k.name)} tz={tz} />
            ))}
          </div>
        )}
      </div>

      {/* Revoked */}
      {revoked.length > 0 && (
        <details className="card p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-500">
            Revoked keys ({revoked.length})
          </summary>
          <div className="mt-3 divide-y divide-slate-100">
            {revoked.map((k) => (
              <KeyRow key={k.id} k={k} onRevoke={null} tz={tz} />
            ))}
          </div>
        </details>
      )}
    </>
  );
}

function KeyRow({
  k, onRevoke, tz,
}: { k: ApiKey; onRevoke: (() => void) | null; tz: string }) {
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-800 text-sm truncate">{k.name}</div>
        <div className="flex items-center gap-2 mt-0.5 text-xs">
          <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono">{k.key_prefix}…</code>
          {k.scopes.map((s) => (
            <span key={s} className="text-[10px] bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded-full">
              {s}
            </span>
          ))}
        </div>
        <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
          {k.last_used_at ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> Last used {formatDateInTz(k.last_used_at, tz)}
            </span>
          ) : (
            <span>Never used</span>
          )}
          {k.expires_at && (
            <span>· Expires {formatDateInTz(k.expires_at, tz)}</span>
          )}
          <span>· Created {formatDateInTz(k.created_at, tz)}</span>
          {k.revoked_at && (
            <span className="text-rose-600 inline-flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" /> Revoked {formatDateInTz(k.revoked_at, tz)}
            </span>
          )}
        </div>
      </div>
      {onRevoke && (
        <button
          onClick={onRevoke}
          className="text-slate-400 hover:text-rose-600 transition"
          title="Revoke this key"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
