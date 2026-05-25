"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Phone,
  MapPin,
  Clock,
  Camera,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { markStopDelivered, clearStopDelivered } from "../../actions";

interface StopRow {
  id: string;
  booking_id: string;
  stop_order: number;
  delivered_at: string | null;
  bookings: {
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
    notes: string | null;
  } | null;
}

const SURFACE_BADGES: Record<string, string> = {
  grass: "bg-green-100 text-green-800",
  dirt: "bg-amber-100 text-amber-800",
  concrete: "bg-slate-200 text-slate-700",
  paver: "bg-orange-100 text-orange-800",
  asphalt: "bg-slate-300 text-slate-800",
  other: "bg-slate-100 text-slate-600",
};

export function DriverRouteClient({
  routeId,
  stops,
}: {
  routeId: string;
  stops: StopRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleMarkDelivered(stopId: string) {
    startTransition(async () => {
      const r = await markStopDelivered(stopId, routeId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Marked delivered");
      router.refresh();
    });
  }

  function handleUndo(stopId: string) {
    if (!confirm("Undo delivery? The stop will be marked pending again.")) return;
    startTransition(async () => {
      const r = await clearStopDelivered(stopId, routeId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Reset");
      router.refresh();
    });
  }

  function mapHref(address: string | null): string {
    if (!address) return "#";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }

  function telHref(phone: string | null): string {
    if (!phone) return "#";
    return `tel:${phone.replace(/\D/g, "")}`;
  }

  return (
    <div className="space-y-3">
      {stops.map((s, i) => {
        const b = s.bookings;
        if (!b) return null;
        const delivered = !!s.delivered_at;
        return (
          <div
            key={s.id}
            className={`card ${delivered ? "bg-green-50 border-green-200 opacity-80" : ""}`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`font-mono font-bold text-lg w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    delivered
                      ? "bg-green-600 text-white"
                      : "bg-brand-navy text-white"
                  }`}
                >
                  {delivered ? "✓" : i + 1}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-base truncate">
                    {b.customer_first_name} {b.customer_last_name}
                  </h3>
                  <p className="text-xs text-slate-500">{b.product_name}</p>
                </div>
              </div>
              {b.start_time && (
                <div className="text-right text-xs flex-shrink-0">
                  <Clock className="h-3 w-3 inline mr-0.5" />
                  <strong>{b.start_time}</strong>
                  {b.end_time && ` – ${b.end_time}`}
                </div>
              )}
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-1 mb-2">
              {b.surface_type && (
                <span
                  className={`text-xs px-2 py-0.5 rounded ${SURFACE_BADGES[b.surface_type] || "bg-slate-100 text-slate-700"}`}
                >
                  {b.surface_type}
                </span>
              )}
              {b.needs_power_supply && (
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded inline-flex items-center gap-1">
                  <Zap className="h-3 w-3" /> power supply
                </span>
              )}
            </div>

            {/* Customer-provided notes (warnings, gate codes, etc.) */}
            {b.notes && (
              <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-900 mb-2 flex items-start gap-1.5">
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>{b.notes}</span>
              </div>
            )}

            {/* Big tap-to-call + tap-to-map buttons */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <a
                href={telHref(b.customer_phone)}
                className="inline-flex items-center justify-center gap-2 bg-green-600 text-white font-semibold rounded-md py-3 hover:bg-green-700 transition text-sm"
              >
                <Phone className="h-4 w-4" />
                Call
              </a>
              <a
                href={mapHref(b.customer_address)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold rounded-md py-3 hover:bg-blue-700 transition text-sm"
              >
                <MapPin className="h-4 w-4" />
                Navigate
              </a>
            </div>

            <p className="text-xs text-slate-600 mb-3 flex items-start gap-1">
              <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>{b.customer_address || "(no address)"}</span>
            </p>

            {/* Action row */}
            <div className="flex gap-2">
              <Link
                href={`/admin/bookings/${b.id}`}
                className="flex-1 inline-flex items-center justify-center gap-1 border border-slate-300 rounded-md py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Camera className="h-4 w-4" />
                Capture proof / open
              </Link>
              {delivered ? (
                <button
                  onClick={() => handleUndo(s.id)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 text-xs text-amber-700 px-3 py-2"
                >
                  <RotateCcw className="h-3 w-3" /> Undo
                </button>
              ) : (
                <button
                  onClick={() => handleMarkDelivered(s.id)}
                  disabled={pending}
                  className="inline-flex items-center justify-center gap-1 bg-brand-navy text-white font-semibold rounded-md px-4 py-2 hover:bg-brand-navy-dark text-sm"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Done
                </button>
              )}
            </div>

            {delivered && (
              <p className="text-xs text-green-700 mt-2 text-center">
                ✓ Delivered at {new Date(s.delivered_at!).toLocaleTimeString()}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
