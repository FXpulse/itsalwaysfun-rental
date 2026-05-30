"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

function dateMinus(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}
function startOfMonth(monthsAgo: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function endOfMonth(monthsAgo: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}
function startOfYear(yearsAgo: number): string {
  const d = new Date();
  return `${d.getFullYear() - yearsAgo}-01-01`;
}

const PRESETS = [
  { label: "Last 7 days", from: () => dateMinus(7), to: () => dateMinus(0) },
  { label: "Last 30 days", from: () => dateMinus(30), to: () => dateMinus(0) },
  { label: "Last 90 days", from: () => dateMinus(90), to: () => dateMinus(0) },
  { label: "This month", from: () => startOfMonth(0), to: () => dateMinus(0) },
  { label: "Last month", from: () => startOfMonth(1), to: () => endOfMonth(1) },
  { label: "Year to date", from: () => startOfYear(0), to: () => dateMinus(0) },
];

export function DateRangePresets({ activeFrom, activeTo }: { activeFrom: string; activeTo: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function apply(from: string, to: string) {
    router.push(`${pathname}?from=${from}&to=${to}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((p) => {
        const f = p.from();
        const t = p.to();
        const isActive = f === activeFrom && t === activeTo;
        return (
          <button
            key={p.label}
            onClick={() => apply(f, t)}
            className={`text-xs font-semibold rounded-full px-3 py-1 transition ${
              isActive
                ? "bg-violet-600 text-white shadow-sm"
                : "bg-white/70 text-slate-700 hover:bg-violet-50 hover:text-violet-700"
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
