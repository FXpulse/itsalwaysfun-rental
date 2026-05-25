"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, Truck, Link as LinkIcon, X } from "lucide-react";
import {
  createVehicle,
  updateVehicle,
  deleteVehicle,
  createTrailer,
  updateTrailer,
  deleteTrailer,
} from "./actions";
import type { VehicleRow, TrailerRow, CompatibleInventoryOption } from "./page";

export function FleetManager({
  vehicles,
  trailers,
  inventoryOptions = [],
}: {
  vehicles: VehicleRow[];
  trailers: TrailerRow[];
  inventoryOptions?: CompatibleInventoryOption[];
}) {
  // Lookup map for rendering tags by id → name
  const inventoryById = new Map(inventoryOptions.map((i) => [i.id, i]));
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingVehicle, setEditingVehicle] = useState<VehicleRow | null>(null);
  const [editingTrailer, setEditingTrailer] = useState<TrailerRow | null>(null);
  const [creating, setCreating] = useState<"vehicle" | "trailer" | null>(null);

  function refresh() {
    router.refresh();
  }

  function handleVehicleSubmit(formData: FormData) {
    startTransition(async () => {
      const r = editingVehicle
        ? await updateVehicle(editingVehicle.id, formData)
        : await createVehicle(formData);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(editingVehicle ? "Vehicle updated" : "Vehicle added");
      setEditingVehicle(null);
      setCreating(null);
      refresh();
    });
  }

  function handleTrailerSubmit(formData: FormData) {
    startTransition(async () => {
      const r = editingTrailer
        ? await updateTrailer(editingTrailer.id, formData)
        : await createTrailer(formData);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(editingTrailer ? "Trailer updated" : "Trailer added");
      setEditingTrailer(null);
      setCreating(null);
      refresh();
    });
  }

  function handleDeleteVehicle(v: VehicleRow) {
    if (!confirm(`Delete vehicle "${v.name}"?`)) return;
    startTransition(async () => {
      const r = await deleteVehicle(v.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Deleted");
      refresh();
    });
  }

  function handleDeleteTrailer(t: TrailerRow) {
    if (!confirm(`Delete trailer "${t.name}"?`)) return;
    startTransition(async () => {
      const r = await deleteTrailer(t.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Deleted");
      refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* VEHICLES */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-bold text-brand-navy flex items-center gap-2">
              <Truck className="h-4 w-4" /> Vehicles ({vehicles.length})
            </h2>
            <p className="text-xs text-slate-500">Trucks, vans, pickups — what your team drives</p>
          </div>
          <button
            onClick={() => {
              setCreating("vehicle");
              setEditingVehicle(null);
            }}
            className="btn-primary text-sm inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Add vehicle
          </button>
        </div>

        {vehicles.length === 0 ? (
          <div className="card text-center text-slate-400 py-6 text-sm">No vehicles yet.</div>
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Tag</th>
                  <th className="px-4 py-2 text-left">VIN</th>
                  <th className="px-4 py-2 text-center">Needs trailer?</th>
                  <th className="px-4 py-2 text-left">Capacity</th>
                  <th className="px-4 py-2 text-left">Can carry</th>
                  <th className="px-4 py-2 text-left">Active</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehicles.map((v) => (
                  <tr key={v.id} className={!v.is_active ? "opacity-50" : ""}>
                    <td className="px-4 py-2 font-medium">{v.name}</td>
                    <td className="px-4 py-2 capitalize">{v.vehicle_type}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {v.license_tag || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-600">
                      {v.vin || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {v.requires_trailer ? (
                        <span className="text-xs bg-amber-100 text-amber-800 rounded px-2 py-0.5">
                          Yes
                        </span>
                      ) : (
                        <span className="text-xs bg-green-100 text-green-800 rounded px-2 py-0.5">
                          Standalone
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {v.capacity_notes || "—"}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <CompatibleTags
                        ids={v.compatible_inventory_item_ids || []}
                        inventoryById={inventoryById}
                      />
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {v.is_active ? "✓" : "—"}
                    </td>
                    <td className="px-4 py-2 text-right space-x-1">
                      <button
                        onClick={() => {
                          setEditingVehicle(v);
                          setCreating(null);
                        }}
                        className="p-1 text-slate-600 hover:text-brand-navy"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteVehicle(v)}
                        className="p-1 text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* TRAILERS */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-bold text-brand-navy flex items-center gap-2">
              <LinkIcon className="h-4 w-4" /> Trailers ({trailers.length})
            </h2>
            <p className="text-xs text-slate-500">Pulled by vehicles that need them</p>
          </div>
          <button
            onClick={() => {
              setCreating("trailer");
              setEditingTrailer(null);
            }}
            className="btn-primary text-sm inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Add trailer
          </button>
        </div>

        {trailers.length === 0 ? (
          <div className="card text-center text-slate-400 py-6 text-sm">No trailers yet.</div>
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Tag</th>
                  <th className="px-4 py-2 text-left">VIN</th>
                  <th className="px-4 py-2 text-left">Capacity</th>
                  <th className="px-4 py-2 text-left">Can carry</th>
                  <th className="px-4 py-2 text-left">Active</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trailers.map((t) => (
                  <tr key={t.id} className={!t.is_active ? "opacity-50" : ""}>
                    <td className="px-4 py-2 font-medium">{t.name}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {t.license_tag || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-600">
                      {t.vin || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">{t.capacity_notes || "—"}</td>
                    <td className="px-4 py-2 text-xs">
                      <CompatibleTags
                        ids={t.compatible_inventory_item_ids || []}
                        inventoryById={inventoryById}
                      />
                    </td>
                    <td className="px-4 py-2 text-xs">{t.is_active ? "✓" : "—"}</td>
                    <td className="px-4 py-2 text-right space-x-1">
                      <button
                        onClick={() => {
                          setEditingTrailer(t);
                          setCreating(null);
                        }}
                        className="p-1 text-slate-600 hover:text-brand-navy"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteTrailer(t)}
                        className="p-1 text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* MODALS */}
      {(creating === "vehicle" || editingVehicle) && (
        <Modal
          title={editingVehicle ? `Edit "${editingVehicle.name}"` : "New vehicle"}
          onClose={() => {
            setCreating(null);
            setEditingVehicle(null);
          }}
        >
          <form action={handleVehicleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Name *</label>
              <input
                name="name"
                required
                defaultValue={editingVehicle?.name || ""}
                className="input"
                autoFocus
                placeholder="Truck 1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Type</label>
                <select
                  name="vehicle_type"
                  defaultValue={editingVehicle?.vehicle_type || "truck"}
                  className="input"
                >
                  <option value="truck">Truck</option>
                  <option value="van">Van</option>
                  <option value="pickup">Pickup</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    name="requires_trailer"
                    type="checkbox"
                    defaultChecked={editingVehicle?.requires_trailer ?? true}
                    className="h-4 w-4"
                  />
                  Needs trailer to deliver
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">License tag</label>
                <input
                  name="license_tag"
                  defaultValue={editingVehicle?.license_tag || ""}
                  className="input font-mono uppercase"
                  placeholder="e.g. ABC-1234"
                  maxLength={20}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">VIN</label>
                <input
                  name="vin"
                  defaultValue={editingVehicle?.vin || ""}
                  className="input font-mono uppercase"
                  placeholder="17 chars"
                  maxLength={50}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Capacity notes</label>
              <input
                name="capacity_notes"
                defaultValue={editingVehicle?.capacity_notes || ""}
                className="input"
                placeholder="e.g. 2 large bouncers + accessories"
              />
            </div>
            <CompatibleItemsPicker
              options={inventoryOptions}
              selectedIds={editingVehicle?.compatible_inventory_item_ids || []}
            />
            <div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  name="is_active"
                  type="checkbox"
                  defaultChecked={editingVehicle ? editingVehicle.is_active : true}
                  className="h-4 w-4"
                />
                Active (available for dispatch)
              </label>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={pending} className="btn-primary flex-1">
                {pending ? "Saving..." : editingVehicle ? "Save" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(null);
                  setEditingVehicle(null);
                }}
                className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {(creating === "trailer" || editingTrailer) && (
        <Modal
          title={editingTrailer ? `Edit "${editingTrailer.name}"` : "New trailer"}
          onClose={() => {
            setCreating(null);
            setEditingTrailer(null);
          }}
        >
          <form action={handleTrailerSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Name *</label>
              <input
                name="name"
                required
                defaultValue={editingTrailer?.name || ""}
                className="input"
                autoFocus
                placeholder="Trailer A (16ft)"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">License tag</label>
                <input
                  name="license_tag"
                  defaultValue={editingTrailer?.license_tag || ""}
                  className="input font-mono uppercase"
                  placeholder="e.g. T-9876"
                  maxLength={20}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">VIN</label>
                <input
                  name="vin"
                  defaultValue={editingTrailer?.vin || ""}
                  className="input font-mono uppercase"
                  placeholder="17 chars"
                  maxLength={50}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Capacity notes</label>
              <input
                name="capacity_notes"
                defaultValue={editingTrailer?.capacity_notes || ""}
                className="input"
                placeholder="e.g. 2 large bouncers"
              />
            </div>
            <CompatibleItemsPicker
              options={inventoryOptions}
              selectedIds={editingTrailer?.compatible_inventory_item_ids || []}
            />
            <div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  name="is_active"
                  type="checkbox"
                  defaultChecked={editingTrailer ? editingTrailer.is_active : true}
                  className="h-4 w-4"
                />
                Active
              </label>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={pending} className="btn-primary flex-1">
                {pending ? "Saving..." : editingTrailer ? "Save" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(null);
                  setEditingTrailer(null);
                }}
                className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function CompatibleTags({
  ids,
  inventoryById,
}: {
  ids: string[];
  inventoryById: Map<string, CompatibleInventoryOption>;
}) {
  if (!ids || ids.length === 0) {
    return <span className="text-slate-300">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1 max-w-[200px]">
      {ids.map((id) => {
        const item = inventoryById.get(id);
        if (!item) return null;
        return (
          <span
            key={id}
            className="bg-blue-100 text-blue-800 rounded px-1.5 py-0.5 text-[10px] whitespace-nowrap"
            title={item.category}
          >
            {item.name}
          </span>
        );
      })}
    </div>
  );
}

function CompatibleItemsPicker({
  options,
  selectedIds,
}: {
  options: CompatibleInventoryOption[];
  selectedIds: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Group by category for easier scanning
  const byCategory = new Map<string, CompatibleInventoryOption[]>();
  for (const opt of options) {
    if (!byCategory.has(opt.category)) byCategory.set(opt.category, []);
    byCategory.get(opt.category)!.push(opt);
  }

  return (
    <div>
      <label className="block text-xs text-slate-600 mb-1">
        Can carry / mount (special inventory)
      </label>
      <p className="text-[10px] text-slate-500 mb-2">
        Check items this unit is physically equipped to carry — electric dolly,
        ramps, lifts, etc. Used at dispatch time to know which trucks support
        which special gear.
      </p>
      {/* Render the chosen IDs as hidden inputs so FormData picks them up */}
      {Array.from(selected).map((id) => (
        <input key={id} type="hidden" name="compatible_inventory_item_ids" value={id} />
      ))}
      {options.length === 0 ? (
        <p className="text-xs text-slate-400 italic">
          No inventory items configured yet — add some in /admin/inventory.
        </p>
      ) : (
        <div className="border border-slate-200 rounded p-2 max-h-44 overflow-y-auto bg-white">
          {Array.from(byCategory.entries()).map(([cat, items]) => (
            <div key={cat} className="mb-2 last:mb-0">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">
                {cat}
              </div>
              <div className="grid grid-cols-2 gap-1">
                {items.map((opt) => (
                  <label
                    key={opt.id}
                    className="inline-flex items-center gap-1.5 text-xs cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(opt.id)}
                      onChange={() => toggle(opt.id)}
                      className="h-3 w-3"
                    />
                    <span className="truncate">{opt.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-slate-400 mt-1">
        {selected.size} selected
      </p>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-brand-navy">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
