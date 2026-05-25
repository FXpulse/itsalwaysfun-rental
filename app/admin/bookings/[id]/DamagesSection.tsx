"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Plus,
  AlertTriangle,
  Trash2,
  DollarSign,
  X,
  CheckCircle2,
  Wrench,
  Shield,
} from "lucide-react";
import {
  recordDamage,
  toggleDamageCharged,
  toggleDamageCovered,
  toggleDamageResolved,
  deleteDamage,
} from "./proof-actions";
import { formatCurrency } from "@/lib/utils";

interface InventoryOption {
  id: string;
  name: string;
  category: string;
}

export interface DamageRow {
  id: string;
  inventory_item_id: string | null;
  inventory_name: string | null;
  description: string;
  severity: "minor" | "moderate" | "major";
  cost_cents: number;
  customer_responsible: boolean;
  charged_to_customer: boolean;
  covered_by_protection: boolean;
  resolved: boolean;
  photo_url: string | null;
  recorded_at: string;
  recorded_by: string | null;
  notes: string | null;
}

const SEVERITY_STYLES: Record<string, string> = {
  minor: "bg-yellow-100 text-yellow-800",
  moderate: "bg-orange-100 text-orange-800",
  major: "bg-red-100 text-red-800",
};

export function DamagesSection({
  bookingId,
  damages,
  inventory,
  hasProtection = false,
  protectionCoverageCents = 0,
}: {
  bookingId: string;
  damages: DamageRow[];
  inventory: InventoryOption[];
  hasProtection?: boolean;
  protectionCoverageCents?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [recording, setRecording] = useState(false);

  // Form state
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"minor" | "moderate" | "major">("minor");
  const [costDollars, setCostDollars] = useState("0");
  const [customerResponsible, setCustomerResponsible] = useState(false);
  // Default to true when booking has protection AND customer is marked responsible
  const [coveredByProtection, setCoveredByProtection] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [notes, setNotes] = useState("");

  function reset() {
    setInventoryItemId("");
    setDescription("");
    setSeverity("minor");
    setCostDollars("0");
    setCustomerResponsible(false);
    setCoveredByProtection(false);
    setPhoto(null);
    setNotes("");
    setRecording(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("Describe the damage");
      return;
    }
    const fd = new FormData();
    fd.append("booking_id", bookingId);
    if (inventoryItemId) fd.append("inventory_item_id", inventoryItemId);
    fd.append("description", description);
    fd.append("severity", severity);
    fd.append("cost_dollars", costDollars || "0");
    if (customerResponsible) fd.append("customer_responsible", "on");
    if (coveredByProtection) fd.append("covered_by_protection", "on");
    if (notes) fd.append("notes", notes);
    if (photo) fd.append("photo", photo);

    startTransition(async () => {
      const r = await recordDamage(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Damage recorded");
      reset();
      router.refresh();
    });
  }

  function handleToggleCharged(d: DamageRow) {
    startTransition(async () => {
      const r = await toggleDamageCharged(d.id, bookingId, d.charged_to_customer);
      if (r.error) toast.error(r.error);
      router.refresh();
    });
  }

  function handleToggleCovered(d: DamageRow) {
    startTransition(async () => {
      const r = await toggleDamageCovered(d.id, bookingId, d.covered_by_protection);
      if (r.error) toast.error(r.error);
      router.refresh();
    });
  }

  function handleToggleResolved(d: DamageRow) {
    startTransition(async () => {
      const r = await toggleDamageResolved(d.id, bookingId, d.resolved);
      if (r.error) toast.error(r.error);
      router.refresh();
    });
  }

  function handleDelete(d: DamageRow) {
    if (!confirm("Delete this damage record?")) return;
    startTransition(async () => {
      const r = await deleteDamage(d.id, bookingId);
      if (r.error) toast.error(r.error);
      router.refresh();
    });
  }

  const totalCost = damages.reduce((s, d) => s + d.cost_cents, 0);
  const coveredCost = damages
    .filter((d) => d.covered_by_protection)
    .reduce((s, d) => s + d.cost_cents, 0);
  const chargeable = damages
    .filter(
      (d) =>
        d.customer_responsible && !d.charged_to_customer && !d.covered_by_protection,
    )
    .reduce((s, d) => s + d.cost_cents, 0);

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-brand-navy flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Damages
            {damages.length > 0 && (
              <span className="text-xs bg-red-100 text-red-800 rounded px-2 py-0.5 font-normal">
                {damages.length} recorded · {formatCurrency(totalCost)}
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Record damages after pickup. Mark customer-responsible to track chargeable amounts.
          </p>
        </div>
        {!recording && (
          <button
            onClick={() => setRecording(true)}
            className="btn-primary text-sm inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Record damage
          </button>
        )}
      </div>

      {/* Record form */}
      {recording && (
        <form
          onSubmit={handleSubmit}
          className="bg-red-50 border border-red-200 rounded p-3 mb-4 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Damaged item (optional)
              </label>
              <select
                value={inventoryItemId}
                onChange={(e) => setInventoryItemId(e.target.value)}
                className="input"
              >
                <option value="">— Product or unknown —</option>
                {inventory.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.category} — {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Severity *</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className="input"
              >
                <option value="minor">Minor (cosmetic)</option>
                <option value="moderate">Moderate (needs repair)</option>
                <option value="major">Major (replacement)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Description *</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 6-inch tear on left wall, spillage damage"
              className="input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Repair / replacement cost (USD)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={costDollars}
                  onChange={(e) => setCostDollars(e.target.value)}
                  className="input pl-7"
                />
              </div>
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={customerResponsible}
                  onChange={(e) => setCustomerResponsible(e.target.checked)}
                  className="h-4 w-4"
                />
                Customer responsible (chargeable)
              </label>
            </div>
          </div>

          {/* Protection coverage — only relevant if booking has protection */}
          {hasProtection && (
            <div className="bg-green-50 border border-green-200 rounded p-2">
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={coveredByProtection}
                  onChange={(e) => setCoveredByProtection(e.target.checked)}
                  className="h-4 w-4 text-green-600 focus:ring-green-600"
                />
                <Shield className="h-4 w-4 text-green-700" />
                <span className="text-green-900">
                  <strong>Covered by protection</strong> — customer purchased damage
                  protection at checkout ({protectionCoverageCents > 0
                    ? `up to ${formatCurrency(protectionCoverageCents)}`
                    : "coverage limit"}
                  ). Marking this excludes the damage from chargeable amount.
                </span>
              </label>
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-600 mb-1">Photo (optional)</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setPhoto(e.target.files?.[0] || null)}
              className="input"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Customer admitted fault / asked to delay charge / etc."
              className="input"
            />
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary text-sm">
              {pending ? "Saving..." : "Record damage"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="text-sm text-slate-600 hover:text-slate-900 px-3 py-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {damages.length === 0 ? (
        <div className="text-center text-slate-400 py-6 text-sm border-2 border-dashed border-slate-200 rounded">
          No damages recorded — good return! 🎉
        </div>
      ) : (
        <div className="space-y-2">
          {damages.map((d) => (
            <div
              key={d.id}
              className={`border rounded p-3 ${d.resolved ? "bg-slate-50 opacity-70" : "bg-white"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs rounded px-2 py-0.5 ${SEVERITY_STYLES[d.severity]}`}
                    >
                      {d.severity}
                    </span>
                    {d.inventory_name && (
                      <span className="text-xs bg-slate-100 text-slate-700 rounded px-2 py-0.5">
                        {d.inventory_name}
                      </span>
                    )}
                    {d.customer_responsible && (
                      <span className="text-xs bg-amber-100 text-amber-800 rounded px-2 py-0.5">
                        Customer
                      </span>
                    )}
                    {d.charged_to_customer && (
                      <span className="text-xs bg-green-100 text-green-800 rounded px-2 py-0.5">
                        ✓ Charged
                      </span>
                    )}
                    {d.covered_by_protection && (
                      <span className="text-xs bg-green-100 text-green-800 rounded px-2 py-0.5 inline-flex items-center gap-1">
                        <Shield className="h-3 w-3" /> Covered
                      </span>
                    )}
                    {d.resolved && (
                      <span className="text-xs bg-blue-100 text-blue-800 rounded px-2 py-0.5">
                        ✓ Resolved
                      </span>
                    )}
                  </div>
                  <p className="text-sm mt-1">{d.description}</p>
                  {d.notes && (
                    <p className="text-xs text-slate-500 mt-1 italic">{d.notes}</p>
                  )}
                  <div className="text-[10px] text-slate-400 mt-1">
                    Recorded {new Date(d.recorded_at).toLocaleString()}
                    {d.recorded_by && ` by ${d.recorded_by}`}
                  </div>
                  {d.photo_url && (
                    <a
                      href={d.photo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-20 h-20 mt-2 relative bg-slate-100 rounded overflow-hidden"
                    >
                      <Image
                        src={d.photo_url}
                        alt="Damage"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </a>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-bold text-red-700">{formatCurrency(d.cost_cents)}</div>
                  <div className="flex gap-1 mt-2 justify-end">
                    {hasProtection && (
                      <button
                        onClick={() => handleToggleCovered(d)}
                        disabled={pending}
                        className="text-xs text-slate-600 hover:text-green-700 p-1"
                        title={
                          d.covered_by_protection
                            ? "Remove protection coverage"
                            : "Mark covered by protection"
                        }
                      >
                        <Shield className="h-3 w-3" />
                      </button>
                    )}
                    {d.customer_responsible && (
                      <button
                        onClick={() => handleToggleCharged(d)}
                        disabled={pending}
                        className="text-xs text-slate-600 hover:text-green-700 p-1"
                        title={d.charged_to_customer ? "Mark unfocused" : "Mark charged"}
                      >
                        <DollarSign className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleResolved(d)}
                      disabled={pending}
                      className="text-xs text-slate-600 hover:text-blue-700 p-1"
                      title={d.resolved ? "Mark unresolved" : "Mark resolved"}
                    >
                      {d.resolved ? (
                        <Wrench className="h-3 w-3" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(d)}
                      disabled={pending}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {coveredCost > 0 && (
        <div className="mt-3 bg-green-50 border border-green-200 rounded p-2 text-sm flex items-center gap-2">
          <Shield className="h-4 w-4 text-green-700" />
          <span className="text-green-900">
            <strong>{formatCurrency(coveredCost)}</strong> covered by protection
            plan (no charge to customer)
          </span>
        </div>
      )}

      {chargeable > 0 && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-2 text-sm">
          <strong className="text-amber-900">
            {formatCurrency(chargeable)}
          </strong>{" "}
          <span className="text-amber-800">
            chargeable to customer (not yet marked charged)
          </span>
        </div>
      )}
    </div>
  );
}
