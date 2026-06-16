"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateRouteStatus } from "@/app/admin/dispatch/actions";

const STATUS_FLOW: Record<string, string> = {
  planned: "loaded",
  loaded: "out",
  out: "completed",
};

const STATUS_BTN_LABEL: Record<string, string> = {
  planned: "Mark as LOADED",
  loaded: "Start route → OUT",
  out: "Finish route",
};

const STATUS_PILL: Record<string, string> = {
  planned: "bg-slate-100 text-slate-700",
  loaded: "bg-amber-100 text-amber-900",
  out: "bg-blue-100 text-blue-900",
  completed: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-red-100 text-red-900",
};

export function RouteHeader({
  routeId,
  routeDate,
  status,
  notes,
  totalStops,
  completedStops,
}: {
  routeId: string;
  routeDate: string;
  status: string;
  notes: string | null;
  totalStops: number;
  completedStops: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function advance() {
    const next = STATUS_FLOW[status];
    if (!next) return;
    startTransition(async () => {
      const r = await updateRouteStatus(routeId, routeDate, next);
      if ((r as any).error) {
        toast.error((r as any).error);
        return;
      }
      toast.success(`Route → ${next}`);
      router.refresh();
    });
  }

  const allDelivered = totalStops > 0 && completedStops === totalStops;
  const nextLabel = STATUS_BTN_LABEL[status];

  return (
    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_PILL[status] || "bg-slate-100"}`}>
          {status.toUpperCase()}
        </span>
        <span className="text-xs text-slate-600 font-medium">
          {completedStops}/{totalStops} stops done
        </span>
      </div>
      {notes && (
        <p className="text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded p-2 mb-2">
          📝 {notes}
        </p>
      )}
      {nextLabel && status !== "completed" && status !== "cancelled" && (
        <button
          onClick={advance}
          disabled={pending || (status === "out" && !allDelivered)}
          className="w-full bg-brand-navy text-white font-bold py-3 rounded-lg disabled:opacity-50 active:scale-95 transition"
        >
          {pending ? "Updating..." : nextLabel}
        </button>
      )}
      {status === "out" && !allDelivered && (
        <p className="text-xs text-slate-500 text-center mt-2">
          Mark all stops delivered first
        </p>
      )}
    </div>
  );
}
