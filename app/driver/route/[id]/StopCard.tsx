"use client";

// Per-stop card optimized for mobile. Big tap targets, address tap-to-navigate,
// proof capture + inspection links. Driver workflow: arrive → photo → mark delivered → next.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { MapPin, Phone, Camera, ClipboardCheck, MessageSquare, CheckCircle2, ChevronDown } from "lucide-react";
import { markStopDelivered, clearStopDelivered } from "@/app/admin/dispatch/actions";

interface BookingInline {
  id: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_phone: string | null;
  customer_address: string;
  product_name: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  surface_type: string | null;
  needs_power_supply: boolean | null;
  notes: string | null;
}

interface StopInline {
  id: string;
  stop_order: number;
  delivered_at: string | null;
  notes: string | null;
  bookings: BookingInline;
}

export function StopCard({
  stop,
  routeId,
  routeType,
  stopNumber,
}: {
  stop: StopInline;
  routeId: string;
  routeType: "delivery" | "pickup" | string;
  stopNumber: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(!stop.delivered_at);
  const booking = stop.bookings;

  function toggleDelivered() {
    startTransition(async () => {
      const fn = stop.delivered_at ? clearStopDelivered : markStopDelivered;
      const r = await fn(stop.id, routeId);
      if ((r as any).error) {
        toast.error((r as any).error);
        return;
      }
      toast.success(
        stop.delivered_at
          ? "Stop reopened"
          : routeType === "pickup"
          ? "Stop picked up ✓"
          : "Stop delivered ✓",
      );
      router.refresh();
    });
  }

  const fullName = `${booking.customer_first_name} ${booking.customer_last_name}`.trim();
  const isDone = !!stop.delivered_at;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.customer_address)}`;
  const phoneHref = booking.customer_phone ? `tel:${booking.customer_phone.replace(/\D/g, "")}` : null;

  return (
    <div
      className={`rounded-xl border-2 overflow-hidden transition ${
        isDone
          ? "border-emerald-200 bg-emerald-50/50"
          : "border-slate-200 bg-white"
      }`}
    >
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-start gap-3 text-left"
      >
        <div className="flex-shrink-0 mt-0.5">
          {isDone ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          ) : (
            <div className="h-6 w-6 rounded-full border-2 border-slate-300 flex items-center justify-center text-xs font-bold text-slate-500">
              {stopNumber}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-800">{fullName}</div>
          <div className="text-sm text-slate-600 flex items-center gap-1 mt-0.5">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{booking.customer_address}</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {booking.product_name} · {booking.start_time?.slice(0, 5)} – {booking.end_time?.slice(0, 5)}
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-slate-400 flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3">
          {/* Big action grid */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-blue-50 text-blue-800 font-medium py-3 rounded-lg active:scale-95 transition"
            >
              <MapPin className="h-4 w-4" />
              Navigate
            </a>
            {phoneHref ? (
              <a
                href={phoneHref}
                className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-800 font-medium py-3 rounded-lg active:scale-95 transition"
              >
                <Phone className="h-4 w-4" />
                Call
              </a>
            ) : (
              <div className="flex items-center justify-center gap-2 bg-slate-50 text-slate-400 py-3 rounded-lg">
                <Phone className="h-4 w-4" />
                No phone
              </div>
            )}
          </div>

          {/* Secondary links */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Link
              href={`/admin/bookings/${booking.id}#proofs`}
              className="flex flex-col items-center gap-1 bg-slate-50 text-slate-700 py-2 rounded-lg active:scale-95"
            >
              <Camera className="h-4 w-4" />
              Proof
            </Link>
            <Link
              href={`/admin/bookings/${booking.id}#inspection`}
              className="flex flex-col items-center gap-1 bg-slate-50 text-slate-700 py-2 rounded-lg active:scale-95"
            >
              <ClipboardCheck className="h-4 w-4" />
              Inspect
            </Link>
            <Link
              href={`/admin/bookings/${booking.id}#chat`}
              className="flex flex-col items-center gap-1 bg-slate-50 text-slate-700 py-2 rounded-lg active:scale-95"
            >
              <MessageSquare className="h-4 w-4" />
              Chat
            </Link>
          </div>

          {/* Setup details */}
          {(booking.surface_type || booking.needs_power_supply || booking.notes) && (
            <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs space-y-1">
              {booking.surface_type && (
                <div>
                  <span className="font-medium">Surface:</span> {booking.surface_type}
                </div>
              )}
              {booking.needs_power_supply && (
                <div className="font-medium text-amber-800">⚠ Customer needs power supply</div>
              )}
              {booking.notes && (
                <div>
                  <span className="font-medium">Notes:</span> {booking.notes}
                </div>
              )}
            </div>
          )}

          {/* Primary delivered button */}
          <button
            onClick={toggleDelivered}
            disabled={pending}
            className={`w-full font-bold py-3 rounded-lg active:scale-95 transition ${
              isDone
                ? "bg-slate-100 text-slate-700"
                : "bg-emerald-600 text-white"
            } disabled:opacity-50`}
          >
            {pending
              ? "Updating..."
              : isDone
              ? "Reopen stop (mark not done)"
              : routeType === "pickup"
              ? "✓ Picked up"
              : "✓ Delivered"}
          </button>

          {isDone && stop.delivered_at && (
            <p className="text-xs text-slate-500 text-center">
              Completed {new Date(stop.delivered_at).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
