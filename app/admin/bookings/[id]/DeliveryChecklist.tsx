"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CheckCircle2, RotateCcw, Truck, Package } from "lucide-react";
import { markDeliveryChecked, clearDeliveryCheck } from "@/app/admin/products/[id]/inventory-actions";
import type { ChecklistItem } from "@/lib/delivery-checklist";

interface Props {
  bookingId: string;
  items: ChecklistItem[];
  surfaceType: string | null;
  needsPowerSupply: boolean;
  deliveryCheckedAt: string | null;
  deliveryCheckedBy: string | null;
}

export function DeliveryChecklist({
  bookingId,
  items,
  surfaceType,
  needsPowerSupply,
  deliveryCheckedAt,
  deliveryCheckedBy,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Local checkbox state — purely for visual aid, not persisted
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleMarkAll() {
    if (items.length === 0) {
      toast.error("Nothing to check — define inventory requirements on the product first");
      return;
    }
    if (checkedItems.size !== items.length) {
      if (!confirm("Not all items checked. Mark delivery as ready anyway?")) return;
    }
    startTransition(async () => {
      const r = await markDeliveryChecked(bookingId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Delivery marked as ready");
      router.refresh();
    });
  }

  function handleReset() {
    if (!confirm("Reset delivery check? You'll need to re-verify items.")) return;
    startTransition(async () => {
      const r = await clearDeliveryCheck(bookingId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      setCheckedItems(new Set());
      toast.success("Delivery check reset");
      router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <div className="card mb-6">
        <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-2 flex items-center gap-2">
          <Truck className="h-4 w-4" /> Delivery checklist
        </h2>
        <p className="text-sm text-slate-500 text-center py-4">
          No inventory requirements set for this product.{" "}
          <a
            href={`/admin/products`}
            className="text-brand-navy hover:underline font-semibold"
          >
            Edit the product
          </a>{" "}
          to define what to bring.
        </p>
      </div>
    );
  }

  const allChecked = checkedItems.size === items.length;

  return (
    <div className="card mb-6">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-2">
            <Truck className="h-4 w-4" /> Delivery checklist
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Load on the truck before going out.
            {surfaceType && (
              <>
                {" "}Surface: <span className="font-semibold capitalize">{surfaceType}</span>.
              </>
            )}
            {needsPowerSupply && (
              <span className="text-purple-700 font-semibold"> · ⚡ Power Supply included</span>
            )}
          </p>
        </div>
        {deliveryCheckedAt ? (
          <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
            <CheckCircle2 className="h-3 w-3" /> Loaded ✓
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
            <Package className="h-3 w-3" /> Pending
          </span>
        )}
      </div>

      {/* Items list */}
      <div className="divide-y divide-slate-100 border border-slate-200 rounded overflow-hidden">
        {items.map((it) => (
          <label
            key={it.requirement_id}
            className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer transition"
          >
            <input
              type="checkbox"
              checked={checkedItems.has(it.requirement_id) || !!deliveryCheckedAt}
              onChange={() => toggle(it.requirement_id)}
              disabled={!!deliveryCheckedAt}
              className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-600"
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">
                <span className="font-mono font-bold mr-2">{it.quantity}×</span>
                {it.inventory_name}
              </div>
              <div className="text-xs text-slate-500">
                {it.inventory_category}
                {it.notes && <span className="ml-2 italic">— {it.notes}</span>}
              </div>
            </div>
            <span className="text-[10px] text-slate-400 italic">{it.reason}</span>
          </label>
        ))}
      </div>

      {/* Status + actions */}
      {deliveryCheckedAt ? (
        <div className="mt-3 flex items-center justify-between bg-green-50 border border-green-200 rounded p-2 text-sm">
          <div className="text-green-800">
            ✓ Marked ready by <strong>{deliveryCheckedBy || "unknown"}</strong> on{" "}
            {new Date(deliveryCheckedAt).toLocaleString()}
          </div>
          <button
            onClick={handleReset}
            disabled={pending}
            className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {checkedItems.size} / {items.length} items checked
          </span>
          <button
            onClick={handleMarkAll}
            disabled={pending}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 font-semibold text-sm transition ${
              allChecked
                ? "bg-green-600 text-white hover:bg-green-700"
                : "border border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            {pending ? "Saving..." : allChecked ? "Mark all loaded ✓" : "Mark as loaded"}
          </button>
        </div>
      )}
    </div>
  );
}
