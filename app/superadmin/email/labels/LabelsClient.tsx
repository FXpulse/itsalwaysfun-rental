// app/superadmin/email/labels/LabelsClient.tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { createLabel, deleteLabel } from "./actions";
import type { EmailAccount, EmailLabel } from "@/lib/email/types";

export function LabelsClient({ accounts, labels }: { accounts: EmailAccount[]; labels: EmailLabel[] }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [pending, startTransition] = useTransition();

  function add() {
    if (!name.trim() || !accountId) return;
    startTransition(async () => {
      const r = await createLabel(accountId, name.trim(), color);
      if (r?.error) toast.error(r.error);
      else { setName(""); toast.success("Label created"); }
    });
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="font-bold mb-2">Create label</h2>
        <div className="flex gap-2 items-end">
          <select className="input flex-1" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
          <input className="input flex-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Hot lead" />
          <input type="color" className="h-10 w-12 border rounded" value={color} onChange={(e) => setColor(e.target.value)} />
          <button onClick={add} disabled={pending} className="btn-primary inline-flex items-center gap-1">
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      {accounts.map((a) => {
        const acctLabels = labels.filter((l) => l.account_id === a.id);
        return (
          <div key={a.id}>
            <h3 className="text-sm font-bold mb-2">{a.label}</h3>
            <div className="space-y-1">
              {acctLabels.length === 0 ? (
                <p className="text-xs text-slate-400">No labels yet for this account.</p>
              ) : acctLabels.map((l) => (
                <div key={l.id} className="card flex items-center gap-2">
                  <span className="w-4 h-4 rounded" style={{ background: l.color }} />
                  <span className="flex-1 text-sm">{l.name}</span>
                  <button
                    onClick={() => startTransition(async () => {
                      if (confirm(`Delete label "${l.name}"?`)) await deleteLabel(l.id);
                    })}
                    className="text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
