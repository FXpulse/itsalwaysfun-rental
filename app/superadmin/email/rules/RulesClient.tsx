// app/superadmin/email/rules/RulesClient.tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import { createRule, toggleRule, deleteRule } from "./actions";
import type {
  EmailAccount, EmailLabel, EmailRule,
  RuleConditionLeaf, RuleAction, RuleConditionField, RuleConditionOp, RuleActionType,
} from "@/lib/email/types";

const FIELDS: RuleConditionField[] = ["from", "to", "subject", "body", "has_attachment"];
const OPS: RuleConditionOp[] = ["contains", "equals", "starts_with", "matches_regex", "is_true", "is_false"];
const ACTION_TYPES: RuleActionType[] = ["apply_label", "mark_read", "mark_unread", "archive"];

export function RulesClient({ accounts, labels, rules }: {
  accounts: EmailAccount[]; labels: EmailLabel[]; rules: EmailRule[];
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [name, setName] = useState("");
  const [priority, setPriority] = useState(100);
  const [conditions, setConditions] = useState<RuleConditionLeaf[]>([
    { field: "from", op: "contains", value: "" },
  ]);
  const [conditionOp, setConditionOp] = useState<"AND" | "OR">("AND");
  const [actions, setActions] = useState<RuleAction[]>([{ type: "apply_label" }]);
  const [pending, startTransition] = useTransition();

  function addCondition() {
    setConditions([...conditions, { field: "from", op: "contains", value: "" }]);
  }
  function removeCondition(i: number) {
    setConditions(conditions.filter((_, idx) => idx !== i));
  }
  function setCondition(i: number, patch: Partial<RuleConditionLeaf>) {
    setConditions(conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  }
  function addAction() { setActions([...actions, { type: "mark_read" }]); }
  function setAction(i: number, patch: Partial<RuleAction>) {
    setActions(actions.map((a, idx) => idx === i ? { ...a, ...patch } : a));
  }
  function removeAction(i: number) { setActions(actions.filter((_, idx) => idx !== i)); }

  function save() {
    if (!name.trim() || !accountId || conditions.length === 0 || actions.length === 0) {
      toast.error("Fill name + at least one condition + one action");
      return;
    }
    startTransition(async () => {
      const r = await createRule(
        accountId, name.trim(), priority,
        { operator: conditionOp, conditions },
        { actions, stop_processing: false },
      );
      if (r?.error) toast.error(r.error);
      else { setName(""); toast.success("Rule created"); }
    });
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="font-bold mb-2">New rule</h2>
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name" />
        </div>

        <div className="mt-3">
          <h3 className="text-xs font-bold uppercase text-slate-500 mb-1">
            WHEN <select className="ml-2" value={conditionOp} onChange={(e) => setConditionOp(e.target.value as "AND" | "OR")}>
              <option>AND</option><option>OR</option>
            </select>
          </h3>
          {conditions.map((c, i) => (
            <div key={i} className="flex gap-1 mb-1">
              <select className="input text-sm" value={c.field} onChange={(e) => setCondition(i, { field: e.target.value as RuleConditionField })}>
                {FIELDS.map((f) => <option key={f}>{f}</option>)}
              </select>
              <select className="input text-sm" value={c.op} onChange={(e) => setCondition(i, { op: e.target.value as RuleConditionOp })}>
                {OPS.map((o) => <option key={o}>{o}</option>)}
              </select>
              {c.op !== "is_true" && c.op !== "is_false" && (
                <input className="input flex-1 text-sm" value={c.value || ""} onChange={(e) => setCondition(i, { value: e.target.value })} placeholder="value" />
              )}
              <button onClick={() => removeCondition(i)} className="text-slate-400 hover:text-red-600"><X className="h-4 w-4" /></button>
            </div>
          ))}
          <button onClick={addCondition} className="text-xs text-brand-navy underline inline-flex items-center gap-1"><Plus className="h-3 w-3" /> Add condition</button>
        </div>

        <div className="mt-3">
          <h3 className="text-xs font-bold uppercase text-slate-500 mb-1">THEN</h3>
          {actions.map((a, i) => (
            <div key={i} className="flex gap-1 mb-1">
              <select className="input text-sm" value={a.type} onChange={(e) => setAction(i, { type: e.target.value as RuleActionType })}>
                {ACTION_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              {a.type === "apply_label" && (
                <select className="input flex-1 text-sm" value={a.label_id || ""} onChange={(e) => setAction(i, { label_id: e.target.value })}>
                  <option value="">— pick label —</option>
                  {labels.filter((l) => l.account_id === accountId).map((l) =>
                    <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              )}
              <button onClick={() => removeAction(i)} className="text-slate-400 hover:text-red-600"><X className="h-4 w-4" /></button>
            </div>
          ))}
          <button onClick={addAction} className="text-xs text-brand-navy underline inline-flex items-center gap-1"><Plus className="h-3 w-3" /> Add action</button>
        </div>

        <div className="mt-3 text-right">
          <button onClick={save} disabled={pending} className="btn-primary">{pending ? "Saving..." : "Save rule"}</button>
        </div>
      </div>

      <div>
        <h2 className="font-bold mb-2">Active rules</h2>
        {rules.map((r) => (
          <div key={r.id} className="card flex items-center gap-2">
            <label className="text-xs">
              <input type="checkbox" checked={r.is_active} onChange={() => startTransition(async () => await toggleRule(r.id, !r.is_active))} /> Active
            </label>
            <span className="flex-1 text-sm">{r.name} (prio {r.priority}, matched {r.match_count}x)</span>
            <button onClick={() => startTransition(async () => { if (confirm("Delete rule?")) await deleteRule(r.id); })} className="text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
