"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Edit, X } from "lucide-react";
import {
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponActive,
} from "./actions";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed" | "overnight_free";
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  expires_at: string | null;
  is_active: boolean;
}

export function CouponsManager({ coupons }: { coupons: Coupon[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);

  function handleSubmit(
    e: React.FormEvent<HTMLFormElement>,
    action: (formData: FormData) => Promise<any>,
    label: string,
  ) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) toast.error(result.error);
      else {
        toast.success(`${label} successfully`);
        setShowAdd(false);
        setEditing(null);
        router.refresh();
      }
    });
  }

  function handleToggle(c: Coupon) {
    startTransition(async () => {
      const result = await toggleCouponActive(c.id, c.is_active);
      if (result?.error) toast.error(result.error);
      else router.refresh();
    });
  }

  function handleDelete(c: Coupon) {
    if (!confirm(`Delete coupon "${c.code}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteCoupon(c.id);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Coupon deleted");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => {
            setShowAdd(true);
            setEditing(null);
          }}
          className="btn-accent inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Add coupon
        </button>
      </div>

      {showAdd && (
        <CouponFormCard
          title="Add new coupon"
          onClose={() => setShowAdd(false)}
          onSubmit={(e) => handleSubmit(e, createCoupon, "Created")}
          submitLabel="Create"
          pending={pending}
        />
      )}

      {coupons.length === 0 ? (
        <div className="card text-center text-slate-400 py-8">
          No coupons yet. Click "Add coupon" to create your first one.
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Code</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Discount</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Uses</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Expires</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-mono font-bold text-brand-navy">{c.code}</div>
                    {c.description && (
                      <div className="text-xs text-slate-500">{c.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.discount_type === "percent"
                      ? `${c.discount_value}% off`
                      : c.discount_type === "fixed"
                        ? `$${(c.discount_value / 100).toFixed(2)} off`
                        : "Overnight free (waives day-2 surcharge)"}
                  </td>
                  <td className="px-4 py-3">
                    {c.max_uses != null ? `${c.current_uses} / ${c.max_uses}` : `${c.current_uses} / ∞`}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {c.expires_at
                      ? new Date(c.expires_at).toLocaleDateString()
                      : <span className="text-slate-400">Never</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(c)}
                      disabled={pending}
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded
                        ${c.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${c.is_active ? "bg-emerald-500" : "bg-slate-400"}`}></span>
                      {c.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => {
                        setEditing(c);
                        setShowAdd(false);
                      }}
                      className="text-brand-navy hover:underline text-sm inline-flex items-center gap-1"
                    >
                      <Edit className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      disabled={pending}
                      className="text-red-600 hover:underline text-sm inline-flex items-center gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <CouponFormCard
          title={`Edit "${editing.code}"`}
          onClose={() => setEditing(null)}
          onSubmit={(e) => handleSubmit(e, updateCoupon.bind(null, editing.id), "Updated")}
          submitLabel="Save changes"
          pending={pending}
          initial={editing}
        />
      )}
    </div>
  );
}

function CouponFormCard({
  title,
  onClose,
  onSubmit,
  submitLabel,
  pending,
  initial,
}: {
  title: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
  pending: boolean;
  initial?: Coupon;
}) {
  const [type, setType] = useState<"percent" | "fixed" | "overnight_free">(
    initial?.discount_type || "percent",
  );
  const isOvernight = type === "overnight_free";
  const defaultValue = initial && !isOvernight
    ? type === "percent"
      ? initial.discount_value
      : (initial.discount_value / 100).toFixed(2)
    : "";
  return (
    <div className="card border-l-4 border-l-brand-yellow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-brand-navy">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Code <span className="text-xs text-slate-400">(uppercase, no spaces)</span>
            </label>
            <input
              name="code"
              required
              defaultValue={initial?.code || ""}
              placeholder="WELCOME10"
              pattern="^[A-Z0-9_-]+$"
              style={{ textTransform: "uppercase" }}
              className="input font-mono"
              disabled={pending}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <input
              name="description"
              defaultValue={initial?.description || ""}
              placeholder="10% off first rental"
              className="input"
              disabled={pending}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
            <select
              name="discount_type"
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="input"
              disabled={pending}
            >
              <option value="percent">Percent off (entire total)</option>
              <option value="fixed">Fixed amount off ($)</option>
              <option value="overnight_free">Overnight free (waive 2nd-day surcharge)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Value{" "}
              {isOvernight
                ? "(auto-calculated)"
                : type === "percent"
                  ? "(0-100)"
                  : "(USD, e.g. 25)"}
            </label>
            <input
              name="discount_value"
              type="number"
              required={!isOvernight}
              min={0}
              max={type === "percent" ? 100 : undefined}
              step={type === "percent" ? 1 : 0.01}
              defaultValue={isOvernight ? 0 : defaultValue}
              placeholder={isOvernight ? "Not used — discount is the day-2 surcharge" : ""}
              className="input"
              disabled={pending || isOvernight}
            />
          </div>
        </div>
        {isOvernight && (
          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-900">
            <strong>How "Overnight free" works:</strong> only valid on rentals of
            exactly <strong>2 days</strong> (overnight). The discount equals the
            30% surcharge for day 2, so the customer effectively pays only day 1's
            full price. Rejected with a clear message if applied to a 1-day or 3+
            day rental.
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Max uses <span className="text-xs text-slate-400">(blank = unlimited)</span>
            </label>
            <input
              name="max_uses"
              type="number"
              min={0}
              defaultValue={initial?.max_uses ?? ""}
              placeholder="100"
              className="input"
              disabled={pending}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Expires at <span className="text-xs text-slate-400">(blank = never)</span>
            </label>
            <input
              name="expires_at"
              type="datetime-local"
              defaultValue={initial?.expires_at ? new Date(initial.expires_at).toISOString().slice(0, 16) : ""}
              className="input"
              disabled={pending}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            name="is_active"
            type="checkbox"
            defaultChecked={initial?.is_active ?? true}
            className="w-4 h-4 rounded text-brand-navy"
            disabled={pending}
          />
          Active (customers can apply this code)
        </label>

        <div className="flex gap-2 pt-2">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Saving..." : submitLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-900"
            disabled={pending}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
