"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

interface BookingCell {
  id: string;
  date: string;
  title: string;
  subtitle: string;
  status: string;
  paymentStatus: string;
  startTime: string | null;
  multiDay: boolean;
  isStart: boolean;
  isEnd: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "bg-amber-100 text-amber-900 border-amber-300",
  confirmed: "bg-blue-100 text-blue-900 border-blue-300",
  delivered: "bg-purple-100 text-purple-900 border-purple-300",
  completed: "bg-green-100 text-green-900 border-green-300",
  cancelled: "bg-slate-200 text-slate-600 border-slate-300 line-through",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({
  gridDates,
  byDate,
  todayStr,
}: {
  gridDates: { date: string; inMonth: boolean }[];
  byDate: Record<string, BookingCell[]>;
  todayStr: string;
}) {
  return (
    <div className="card p-0 overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 text-center"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 divide-x divide-slate-100">
        {gridDates.map((g, i) => {
          const dayNum = new Date(g.date + "T00:00:00").getDate();
          const events = byDate[g.date] || [];
          const isToday = g.date === todayStr;
          const isWeekEnd = i % 7 === 6;
          return (
            <div
              key={g.date}
              className={`min-h-[110px] p-1.5 border-b border-slate-100 ${
                g.inMonth ? "bg-white" : "bg-slate-50 opacity-50"
              } ${isToday ? "ring-2 ring-brand-yellow ring-inset" : ""}`}
              style={{ borderRight: isWeekEnd ? "none" : undefined }}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-semibold ${
                    isToday ? "text-brand-navy" : g.inMonth ? "text-slate-700" : "text-slate-400"
                  }`}
                >
                  {dayNum}
                </span>
                {g.inMonth && (
                  <Link
                    href={`/admin/bookings/new?date=${g.date}`}
                    className="text-slate-300 hover:text-brand-navy"
                    title="New booking"
                  >
                    <Plus className="h-3 w-3" />
                  </Link>
                )}
              </div>
              <div className="space-y-0.5">
                {events.slice(0, 4).map((e, idx) => (
                  <Link
                    key={`${e.id}-${idx}`}
                    href={`/admin/bookings/${e.id}`}
                    className={`block text-[10px] leading-tight rounded px-1 py-0.5 border ${STATUS_COLORS[e.status] || ""} truncate hover:opacity-80`}
                    title={`${e.title} — ${e.subtitle}${e.startTime ? ` @ ${e.startTime}` : ""}`}
                  >
                    {e.multiDay && (
                      <span className="font-bold mr-0.5">
                        {e.isStart ? "▶" : e.isEnd ? "◀" : "•"}
                      </span>
                    )}
                    {e.startTime && (
                      <span className="font-mono mr-1">{e.startTime.substring(0, 5)}</span>
                    )}
                    <span className="font-semibold">{e.subtitle}</span>{" "}
                    <span className="opacity-70">{e.title}</span>
                  </Link>
                ))}
                {events.length > 4 && (
                  <div className="text-[10px] text-slate-400 font-semibold px-1">
                    +{events.length - 4} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
