"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { createGoal } from "./actions";

export function GoalForm() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const r = await createGoal(formData);
      if ("error" in r) toast.error(r.error);
      else {
        toast.success("Goal created");
        setOpen(false);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg px-4 py-2 text-sm inline-flex items-center gap-1 shadow-sm"
      >
        <Plus className="h-4 w-4" /> Set new goal
      </button>
    );
  }

  return (
    <form action={submit} className="card border-2 border-amber-300 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800">New goal</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Metric</label>
        <select name="metric" className="input" defaultValue="paying_tenants">
          <option value="mrr">MRR (monthly recurring revenue $)</option>
          <option value="active_tenants">Active tenants (total)</option>
          <option value="paying_tenants">Paying tenants (excludes founder)</option>
          <option value="signups_30d">Signups in last 30 days</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Target value</label>
          <input
            name="target"
            type="number"
            min="1"
            step="any"
            required
            placeholder="100"
            className="input"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Target date</label>
          <input name="target_date" type="date" required className="input" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Label (optional)</label>
        <input name="label" placeholder="e.g. Q3 push" className="input" />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white font-semibold rounded-lg px-4 py-2 text-sm"
        >
          {pending ? "Saving…" : "Create goal"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-slate-500 hover:text-slate-700 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
