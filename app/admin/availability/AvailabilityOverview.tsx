"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Product {
  id: string;
  name: string;
  slug: string;
  category: string;
  is_active: boolean;
}

interface Booking {
  id: string;
  product_id: string;
  event_date: string;
  booking_status: string;
  hold_expires_at: string | null;
  customer_first_name: string;
  customer_last_name: string;
  product_name: string;
}

interface BlockedDate {
  id: string;
  product_id: string;
  blocked_date: string;
  reason: string | null;
  product_name?: string;
}

export function AvailabilityOverview({
  products,
  bookings,
  blocks,
}: {
  products: Product[];
  bookings: Booking[];
  blocks: BlockedDate[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cursorMonth, setCursorMonth] = useState(new Date());
  const [openDay, setOpenDay] = useState<string | null>(null);

  const activeProducts = products.filter((p) => p.is_active);
  const totalActive = activeProducts.length;

  // Map: date → array of unavailable product_ids (booked OR blocked)
  const unavailableByDate = useMemo(() => {
    const map = new Map<string, { booked: Booking[]; blocked: BlockedDate[] }>();
    const now = new Date();

    for (const b of bookings) {
      if (
        b.booking_status === "pending_payment" &&
        b.hold_expires_at &&
        new Date(b.hold_expires_at) < now
      ) {
        continue;
      }
      if (!map.has(b.event_date)) map.set(b.event_date, { booked: [], blocked: [] });
      map.get(b.event_date)!.booked.push(b);
    }
    for (const bd of blocks) {
      if (!map.has(bd.blocked_date)) map.set(bd.blocked_date, { booked: [], blocked: [] });
      map.get(bd.blocked_date)!.blocked.push(bd);
    }
    return map;
  }, [bookings, blocks]);

  // Build month grid
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

  return (
    <div className="space-y-4">
      {/* Product selector w/ "All" option */}
      <div className="card flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex-1">
          <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
            Product
          </label>
          <select
            value="all"
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

        <div className="text-xs flex gap-4 flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>All available
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>Some booked
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>All booked
          </span>
        </div>
      </div>

      {/* Calendar */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCursorMonth(subMonths(cursorMonth, 1))}
            className="p-2 rounded hover:bg-slate-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold text-brand-navy">
            {format(cursorMonth, "MMMM yyyy")} — All {totalActive} active products
          </h2>
          <button
            onClick={() => setCursorMonth(addMonths(cursorMonth, 1))}
            className="p-2 rounded hover:bg-slate-100"
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

            const dayData = unavailableByDate.get(iso);
            const bookedCount = dayData?.booked.length || 0;
            const blockedCount = dayData?.blocked.length || 0;
            const unavailableCount = bookedCount + blockedCount;
            const availableCount = Math.max(0, totalActive - unavailableCount);
            const pct = totalActive > 0 ? unavailableCount / totalActive : 0;

            let bgClass = "bg-white";
            let borderClass = "border-slate-200";
            if (inMonth && !isPast) {
              if (unavailableCount === 0) {
                bgClass = "bg-emerald-50";
                borderClass = "border-emerald-200";
              } else if (pct >= 1) {
                bgClass = "bg-red-50";
                borderClass = "border-red-200";
              } else if (pct >= 0.5) {
                bgClass = "bg-amber-50";
                borderClass = "border-amber-200";
              } else {
                bgClass = "bg-amber-50/50";
                borderClass = "border-amber-200";
              }
            }
            if (!inMonth) {
              bgClass = "bg-slate-50/50";
              borderClass = "border-transparent";
            } else if (isPast) {
              bgClass = "bg-slate-50";
              borderClass = "border-slate-100";
            }
            if (isToday) {
              borderClass = "border-brand-yellow border-2";
            }

            return (
              <button
                key={iso}
                disabled={!inMonth || isPast}
                onClick={() => setOpenDay(iso)}
                className={`relative aspect-square rounded p-1 text-left text-sm border transition ${bgClass} ${borderClass} ${
                  !inMonth ? "text-slate-300" : isPast ? "text-slate-400" : "text-slate-700"
                } ${inMonth && !isPast ? "hover:scale-105 cursor-pointer" : ""}`}
              >
                <span className="text-xs font-medium">{format(day, "d")}</span>
                {inMonth && !isPast && totalActive > 0 && (
                  <div className="absolute inset-x-1 bottom-1 text-center">
                    <div className="text-[10px] font-bold text-slate-700 leading-tight">
                      {availableCount}/{totalActive}
                    </div>
                    <div className="text-[9px] text-slate-500 leading-tight">
                      available
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-slate-400 mt-4">
          Click any day to see which products are booked or blocked.
          Use the product dropdown to manage availability for a single item.
        </p>
      </div>

      {/* Day detail modal */}
      {openDay && (
        <DayDetailModal
          isoDate={openDay}
          dayData={unavailableByDate.get(openDay) || { booked: [], blocked: [] }}
          totalActive={totalActive}
          activeProducts={activeProducts}
          onClose={() => setOpenDay(null)}
        />
      )}
    </div>
  );
}

function DayDetailModal({
  isoDate,
  dayData,
  totalActive,
  activeProducts,
  onClose,
}: {
  isoDate: string;
  dayData: { booked: Booking[]; blocked: BlockedDate[] };
  totalActive: number;
  activeProducts: Product[];
  onClose: () => void;
}) {
  const router = useRouter();
  const occupiedIds = new Set([
    ...dayData.booked.map((b) => b.product_id),
    ...dayData.blocked.map((b) => b.product_id),
  ]);
  const availableProducts = activeProducts.filter((p) => !occupiedIds.has(p.id));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-brand-navy">
            {format(new Date(isoDate), "EEEE, MMMM d, yyyy")}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">
            &times;
          </button>
        </div>

        <div className="text-sm text-slate-500 mb-4">
          {availableProducts.length} of {totalActive} products available
        </div>

        {dayData.booked.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">
              📦 Booked ({dayData.booked.length}) — click to open detail
            </h4>
            <ul className="space-y-1">
              {dayData.booked.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/admin/bookings/${b.id}`}
                    onClick={onClose}
                    className="block bg-purple-50 border border-purple-200 rounded px-3 py-2 text-sm hover:bg-purple-100 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-purple-900">{b.product_name}</div>
                        <div className="text-xs text-purple-700">
                          {b.customer_first_name} {b.customer_last_name} · {b.booking_status}
                        </div>
                      </div>
                      <span className="text-xs text-purple-700">View →</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {dayData.blocked.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">
              🚫 Blocked ({dayData.blocked.length})
            </h4>
            <ul className="space-y-1">
              {dayData.blocked.map((b) => (
                <li key={b.id} className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm">
                  <div className="font-medium text-red-900">{b.product_name || "Unknown product"}</div>
                  <div className="text-xs text-red-700">{b.reason || "Blocked"}</div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {availableProducts.length > 0 && (
          <div>
            <h4 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">
              ✓ Available ({availableProducts.length})
            </h4>
            <ul className="space-y-1">
              {availableProducts.map((p) => (
                <li
                  key={p.id}
                  className="bg-emerald-50 border border-emerald-200 rounded px-3 py-2 text-sm flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-emerald-900">{p.name}</div>
                    <div className="text-xs text-emerald-700">{p.category}</div>
                  </div>
                  <button
                    onClick={() => {
                      router.push(`/admin/availability?product=${p.id}`);
                      onClose();
                    }}
                    className="text-xs text-brand-navy hover:underline"
                  >
                    Manage →
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
