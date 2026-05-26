"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Truck,
  Package,
  Phone,
  MapPin,
  Clock,
  AlertTriangle,
  Link as LinkIcon,
  Smartphone,
} from "lucide-react";
import {
  createRoute,
  deleteRoute,
  updateRouteStatus,
  assignBookingToRoute,
  unassignBookingFromRoute,
  reorderStop,
} from "../actions";
import { RouteUnitAssignment, type UnitOption } from "./RouteUnitAssignment";

interface RouteUnitsMap {
  [routeId: string]: {
    [inventoryItemId: string]: {
      assigned: { unit_id: string; tag: string; condition: string }[];
      available: UnitOption[];
    };
  };
}

interface Booking {
  id: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_phone: string | null;
  customer_address: string | null;
  product_name: string;
  start_time: string | null;
  end_time: string | null;
  surface_type: string | null;
  needs_power_supply: boolean | null;
  booking_status: string;
  stripe_payment_status: string;
}

interface RouteWithLoad {
  id: string;
  vehicle_id: string;
  trailer_id: string | null;
  driver_name: string | null;
  notes: string | null;
  status: string;
  vehicles: { id: string; name: string; requires_trailer: boolean } | null;
  trailers: { id: string; name: string } | null;
  stops: any[];
  load: {
    items: Array<{
      inventory_item_id: string;
      inventory_name: string;
      inventory_category: string;
      total_quantity: number;
    }>;
    total_bookings: number;
  };
}

interface Vehicle {
  id: string;
  name: string;
  vehicle_type: string;
  requires_trailer: boolean;
}

interface Trailer {
  id: string;
  name: string;
}

const STATUS_STYLES: Record<string, string> = {
  planned: "bg-slate-100 text-slate-700",
  loaded: "bg-amber-100 text-amber-800",
  out: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export function DispatchClient({
  routeDate,
  routeType = "delivery",
  bookings,
  routes,
  vehicles,
  trailers,
  bookingRouteMap,
  routeUnits = {},
}: {
  routeDate: string;
  routeType?: "delivery" | "pickup";
  bookings: Booking[];
  routes: RouteWithLoad[];
  vehicles: Vehicle[];
  trailers: Trailer[];
  bookingRouteMap: Record<string, string>;
  routeUnits?: RouteUnitsMap;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [trailerId, setTrailerId] = useState("");
  const [driverName, setDriverName] = useState("");
  const [notes, setNotes] = useState("");

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);
  const needsTrailer = selectedVehicle?.requires_trailer;

  function refresh() {
    router.refresh();
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!vehicleId) {
      toast.error("Pick a vehicle");
      return;
    }
    if (needsTrailer && !trailerId) {
      toast.error(`${selectedVehicle?.name} requires a trailer`);
      return;
    }
    const fd = new FormData();
    fd.append("route_date", routeDate);
    fd.append("vehicle_id", vehicleId);
    if (trailerId) fd.append("trailer_id", trailerId);
    if (driverName) fd.append("driver_name", driverName);
    if (notes) fd.append("notes", notes);
    fd.append("route_type", routeType);

    startTransition(async () => {
      const r = await createRoute(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Route created");
      setVehicleId("");
      setTrailerId("");
      setDriverName("");
      setNotes("");
      setCreating(false);
      refresh();
    });
  }

  function handleDeleteRoute(routeId: string) {
    if (!confirm("Delete this route? Bookings will be unassigned.")) return;
    startTransition(async () => {
      const r = await deleteRoute(routeId, routeDate);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Route deleted");
      refresh();
    });
  }

  function handleStatus(routeId: string, status: string) {
    startTransition(async () => {
      const r = await updateRouteStatus(routeId, routeDate, status);
      if (r.error) toast.error(r.error);
      refresh();
    });
  }

  function handleAssign(bookingId: string, routeId: string) {
    startTransition(async () => {
      const r = await assignBookingToRoute(bookingId, routeId, routeDate);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      if (r.pickup_mirrored) {
        toast.success(
          r.pickup_mirrored.created
            ? `Assigned + pickup route auto-created for ${r.pickup_mirrored.route_date}`
            : `Assigned + added to existing pickup route (${r.pickup_mirrored.route_date})`,
        );
      }
      refresh();
    });
  }

  function handleUnassign(bookingId: string) {
    startTransition(async () => {
      const r = await unassignBookingFromRoute(bookingId, routeDate);
      if (r.error) toast.error(r.error);
      refresh();
    });
  }

  function handleReorder(stopId: string, routeId: string, direction: "up" | "down") {
    startTransition(async () => {
      const r = await reorderStop(stopId, direction, routeId, routeDate);
      if (r.error) toast.error(r.error);
      refresh();
    });
  }

  const unassigned = bookings.filter((b) => !bookingRouteMap[b.id]);
  const assignedCount = bookings.length - unassigned.length;

  return (
    <div className="space-y-6">
      {/* New route button */}
      {!creating && (
        <button
          onClick={() => setCreating(true)}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Add {routeType} route
        </button>
      )}

      {/* Create route form */}
      {creating && (
        <form onSubmit={handleCreate} className="card bg-blue-50 border-blue-200 space-y-3">
          <h2 className="font-bold text-brand-navy flex items-center gap-2">
            <Truck className="h-4 w-4" />
            New {routeType} route for {routeDate}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Vehicle *</label>
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                required
                className="input"
              >
                <option value="">Select…</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} {v.requires_trailer ? "(needs trailer)" : "(standalone)"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Trailer {needsTrailer && <span className="text-red-500">*</span>}
              </label>
              <select
                value={trailerId}
                onChange={(e) => setTrailerId(e.target.value)}
                className="input"
                disabled={selectedVehicle && !selectedVehicle.requires_trailer}
              >
                <option value="">
                  {selectedVehicle && !selectedVehicle.requires_trailer
                    ? "Not needed"
                    : "Select a trailer…"}
                </option>
                {trailers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Driver</label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="e.g. Mike, John"
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="optional"
                className="input"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? "Creating..." : "Create route"}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Bookings list — unassigned */}
      {unassigned.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">
            Unassigned bookings ({unassigned.length})
          </h2>
          {routes.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-3 text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
              <span>
                Create a route first ↑, then assign bookings to it.
              </span>
            </div>
          ) : null}
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 text-left">Time</th>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-left">Product</th>
                  <th className="px-3 py-2 text-left">Address</th>
                  <th className="px-3 py-2 text-left">Surface</th>
                  <th className="px-3 py-2 text-left">Assign to</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unassigned.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {b.start_time || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {b.customer_first_name} {b.customer_last_name}
                      </div>
                      {b.customer_phone && (
                        <a
                          href={`tel:${b.customer_phone.replace(/\D/g, "")}`}
                          className="text-xs text-slate-500 hover:text-brand-navy inline-flex items-center gap-1"
                        >
                          <Phone className="h-3 w-3" />
                          {b.customer_phone}
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-2">{b.product_name}</td>
                    <td className="px-3 py-2 text-xs">
                      {b.customer_address || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className="capitalize">{b.surface_type || "—"}</span>
                      {b.needs_power_supply && (
                        <span className="block text-purple-700 text-[10px]">⚡ Power</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        onChange={(e) => {
                          if (e.target.value) handleAssign(b.id, e.target.value);
                        }}
                        defaultValue=""
                        disabled={pending || routes.length === 0}
                        className="text-xs border border-slate-300 rounded px-2 py-1 bg-white"
                      >
                        <option value="">Pick route…</option>
                        {routes.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.vehicles?.name}{" "}
                            {r.trailers?.name ? `+ ${r.trailers.name}` : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Routes */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">
          Routes ({routes.length}) · {assignedCount}/{bookings.length} bookings assigned
        </h2>
        {routes.length === 0 ? (
          <div className="card text-center text-slate-400 py-6 text-sm">
            No routes yet. Click "Add route" above to start planning.
          </div>
        ) : (
          <div className="space-y-4">
            {routes.map((r) => (
              <RouteCard
                key={r.id}
                route={r}
                pending={pending}
                onDelete={() => handleDeleteRoute(r.id)}
                onStatusChange={(s) => handleStatus(r.id, s)}
                onUnassign={(bid) => handleUnassign(bid)}
                onReorder={(stopId, dir) => handleReorder(stopId, r.id, dir)}
                unitsForItems={routeUnits[r.id] || {}}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RouteCard({
  route,
  pending,
  onDelete,
  onStatusChange,
  onUnassign,
  onReorder,
  unitsForItems = {},
}: {
  route: RouteWithLoad;
  pending: boolean;
  onDelete: () => void;
  onStatusChange: (s: string) => void;
  onUnassign: (bookingId: string) => void;
  onReorder: (stopId: string, dir: "up" | "down") => void;
  unitsForItems?: {
    [inventoryItemId: string]: {
      assigned: { unit_id: string; tag: string; condition: string }[];
      available: UnitOption[];
    };
  };
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-brand-navy flex items-center gap-2">
            <Truck className="h-4 w-4" />
            {route.vehicles?.name || "Unknown vehicle"}
            {route.trailers && (
              <>
                <LinkIcon className="h-3 w-3 text-slate-400" />
                <span className="text-slate-700">{route.trailers.name}</span>
              </>
            )}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {route.driver_name ? `Driver: ${route.driver_name}` : "No driver assigned"}
            {route.notes && ` · ${route.notes}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/dispatch/route/${route.id}`}
            className="inline-flex items-center gap-1 text-xs bg-brand-yellow text-brand-navy font-semibold rounded px-3 py-1 hover:bg-yellow-300"
            title="Open mobile-friendly driver view"
          >
            <Smartphone className="h-3 w-3" /> Driver view
          </Link>
          <select
            value={route.status}
            onChange={(e) => onStatusChange(e.target.value)}
            disabled={pending}
            className={`text-xs rounded px-2 py-1 border-0 ${STATUS_STYLES[route.status]}`}
          >
            <option value="planned">Planned</option>
            <option value="loaded">Loaded</option>
            <option value="out">Out for delivery</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button
            onClick={onDelete}
            className="text-red-500 hover:text-red-700 p-1"
            disabled={pending}
            title="Delete route"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stops */}
      {route.stops.length === 0 ? (
        <div className="text-center text-slate-400 py-4 text-sm border-2 border-dashed border-slate-200 rounded">
          No stops yet — assign bookings from the list above.
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          {route.stops.map((s: any, idx: number) => (
            <div
              key={s.id}
              className="flex items-center gap-3 p-2 bg-slate-50 rounded text-sm"
            >
              <div className="font-mono font-bold text-brand-navy w-6 text-center">
                #{idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">
                  {s.bookings?.customer_first_name} {s.bookings?.customer_last_name} ·{" "}
                  {s.bookings?.product_name}
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-3">
                  {s.bookings?.start_time && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {s.bookings.start_time}
                    </span>
                  )}
                  {s.bookings?.customer_address && (
                    <span className="inline-flex items-center gap-1 truncate">
                      <MapPin className="h-3 w-3" /> {s.bookings.customer_address}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => onReorder(s.id, "up")}
                  disabled={pending || idx === 0}
                  className="p-1 hover:bg-slate-200 rounded disabled:opacity-30"
                  title="Move up"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onReorder(s.id, "down")}
                  disabled={pending || idx === route.stops.length - 1}
                  className="p-1 hover:bg-slate-200 rounded disabled:opacity-30"
                  title="Move down"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onUnassign(s.booking_id)}
                  disabled={pending}
                  className="p-1 hover:bg-red-100 rounded text-red-500"
                  title="Remove from route"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Aggregated load */}
      {route.load.items.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-amber-900 mb-2 flex items-center gap-1">
            <Package className="h-3 w-3" /> Truck load (aggregated)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-2 text-sm">
            {route.load.items.map((it) => {
              const unitData = unitsForItems[it.inventory_item_id];
              const tracksUnits = !!unitData;
              return (
                <div key={it.inventory_item_id} className="border-b border-amber-100 pb-1.5 last:border-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono font-bold text-amber-900">
                      {it.total_quantity}×
                    </span>
                    <span className="text-slate-700 truncate flex-1">{it.inventory_name}</span>
                  </div>
                  {tracksUnits && (
                    <RouteUnitAssignment
                      routeId={route.id}
                      inventoryItemId={it.inventory_item_id}
                      inventoryItemName={it.inventory_name}
                      quantityNeeded={it.total_quantity}
                      assignedUnits={unitData.assigned}
                      availableUnits={unitData.available}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
