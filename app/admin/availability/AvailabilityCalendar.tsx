"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isSameDay,
  isBefore,
  addDays,
} from "date-fns";
import { ChevronLeft, ChevronRight, X, AlertCircle } from "lucide-react";
import { blockDate, unblockDate } from "./actions";

interface Booking {
  id: string;
  event_date: string;
  booking_status: string;
  customer_first_name: string;
  customer_last_name: string;
  hold_expires_at: string | null;
}

interface BlockedDate {
  id: string;
  blocked_date: string;
  reason: string | null;
  created_by: string | null;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  category: string;
  is_active: boolean;
}

export function AvailabilityCalendar({
  products,
  selectedProductId,
  bookings,
  blocks,
}: {
  products: Product[];
  selectedProductId: string;
  bookings: Booking[];
  blocks: BlockedDate[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [cursorMonth, setCursorMonth] = useState(new Date());
  const [pending, startTransition] = useTransition();
  const [openBlockModal, setOpenBlockModal] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState("");

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // Group bookings + blocks by date string
  const bookingsByDate = useMemo(() => {
    const map = new Map<string, Booking>();
    const now = new Date();
    for (const b of bookings) {
      if (
        b.booking_status === "pending_payment" &&
        b.hold_expires_at &&
        new Date(b.hold_expires_at) < now
      ) {
        continue; // expired hold
      }
      map.set(b.event_date, b);
    }
    return map;
  }, [bookings]);

  const blocksByDate = useMemo(() => {
    const map = new Map<string, BlockedDate>();
    for (const b of blocks) {
      map.set(b.blocked_date, b);
    }
    return map;
  }, [blocks]);

  // Build calendar grid for cursorMonth
  const monthStart = startOfMonth(cursorMonth);
  const monthEnd = endOfMonth(cursorMonth);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);
  const days: Date[] = [];
  let d = gridStart;
  while (d <= gridEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  function changeProduct(id: string) {
    const params = new URLSearchParams(searchParams);
    if (id === "all") {
      params.delete("product");
    } else {
      params.set("product", id);
    }
    router.push(`/admin/availability?${params.toString()}`);
  }

  function handleConfirmBlock() {
    if (!openBlockModal) return;
    startTransition(async () => {
      const result = await blockDate({
        product_id: selectedProductId,
        blocked_date: openBlockModal,
        reason: blockReason.trim() || null,
      });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Date blocked");
        setOpenBlockModal(null);
        setBlockReason("");
        router.refresh();
      }
    });
  }

  function handleUnblock(blockId: string) {
    startTransition(async () => {
      const result = await unblockDate(blockId);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Date unblocked");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Product selector */}
      <div className="card flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex-1">
          <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
            Product
          </label>
          <select
            value={selectedProductId}
            onChange={(e) => changeProduct(e.target.value)}
            className="input max-w-md"
          >
            <option value="all">⭐ All products (overview)</option>
            <optgroup label="Single product">
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {!p.is_active && "(inactive)"} — {p.category}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className="text-xs flex gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>Available
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>Booked
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>Blocked
          </span>
        </div>
      </div>

      {/* Calendar */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCursorMonth(subMonths(cursorMonth, 1))}
            className="p-2 rounded hover:bg-slate-100"
            disabled={pending}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold text-brand-navy">
            {format(cursorMonth, "MMMM yyyy")}
          </h2>
          <button
            onClick={() => setCursorMonth(addMonths(cursorMonth, 1))}
            className="p-2 rounded hover:bg-slate-100"
            disabled={pending}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs uppercase tracking-wider text-slate-500 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const iso = format(day, "yyyy-MM-dd");
            const inMonth = isSameMonth(day, cursorMonth);
            const isPast = isBefore(day, new Date()) && !isSameDay(day, new Date());
            const isToday = isSameDay(day, new Date());

            const booking = bookingsByDate.get(iso);
            const block = blocksByDate.get(iso);

            let badge: React.ReactNode = null;
            if (booking) {
              badge = (
                <div className="absolute inset-x-1 bottom-1 rounded px-1 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-800 truncate">
                  {booking.customer_first_name}
                </div>
              );
            } else if (block) {
              badge = (
                <div className="absolute inset-x-1 bottom-1 rounded px-1 py-0.5 text-[10px] font-medium bg-red-100 text-red-800 truncate flex items-center justify-between">
                  <span className="truncate">{block.reason || "Blocked"}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnblock(block.id);
                    }}
                    disabled={pending}
                    className="ml-1 text-red-600 hover:text-red-900 flex-shrink-0"
                    title="Unblock"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            }

            const baseClass =
              "relative aspect-square rounded p-1 text-left text-sm border transition";
            const stateClass = !inMonth
              ? "bg-slate-50/50 text-slate-300 border-transparent"
              : isPast
                ? "bg-slate-50 text-slate-400 border-slate-100"
                : booking
                  ? "bg-purple-50 border-purple-200 text-slate-700"
                  : block
                    ? "bg-red-50 border-red-200 text-slate-700"
                    : isToday
                      ? "bg-yellow-50 border-brand-yellow text-slate-900 font-semibold cursor-pointer hover:bg-yellow-100"
                      : "bg-white border-slate-200 text-slate-700 cursor-pointer hover:bg-emerald-50 hover:border-emerald-300";

            return (
              <button
                key={iso}
                disabled={!inMonth || isPast || !!booking || pending}
                onClick={() => {
                  if (!booking && !block && inMonth && !isPast) {
                    setOpenBlockModal(iso);
                    setBlockReason("");
                  }
                }}
                className={`${baseClass} ${stateClass}`}
              >
                <span className="text-xs">{format(day, "d")}</span>
                {badge}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-slate-400 mt-4">
          Click an available date to block it (maintenance, damaged, personal hold).
          Bookings cannot be removed from here — manage them in Bookings page.
        </p>
      </div>

      {/* Block modal */}
      {openBlockModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-brand-navy mb-1">Block date</h3>
            <p className="text-sm text-slate-500 mb-4">
              <strong>{selectedProduct?.name}</strong> on{" "}
              <strong>{format(new Date(openBlockModal), "EEE, MMM d, yyyy")}</strong>
            </p>

            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reason (optional)
            </label>
            <input
              autoFocus
              className="input"
              placeholder="e.g. Maintenance, Damaged, Personal hold"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              disabled={pending}
            />

            <div className="flex gap-2 mt-5 justify-end">
              <button
                onClick={() => setOpenBlockModal(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
                disabled={pending}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBlock}
                className="btn-primary text-sm"
                disabled={pending}
              >
                {pending ? "Blocking..." : "Block this date"}
              </button>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-start gap-2 text-xs text-slate-500">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-slate-400" />
              <span>
                This will prevent customers from booking this product on this date.
                You can unblock anytime by clicking the X on the blocked cell.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
