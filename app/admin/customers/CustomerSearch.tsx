"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

export function CustomerSearch({
  initialQuery,
  initialSort,
}: {
  initialQuery: string;
  initialSort: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [sort, setSort] = useState(initialSort);

  function apply(newQ: string, newSort: string) {
    const params = new URLSearchParams();
    if (newQ) params.set("q", newQ);
    if (newSort && newSort !== "recent") params.set("sort", newSort);
    const qs = params.toString();
    router.push(`/admin/customers${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex gap-3 items-center mb-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply(q, sort);
        }}
        className="relative flex-1"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, phone..."
          className="input pl-9"
        />
      </form>
      <select
        value={sort}
        onChange={(e) => {
          setSort(e.target.value);
          apply(q, e.target.value);
        }}
        className="input max-w-[200px]"
      >
        <option value="recent">Most recent</option>
        <option value="spent">Top spenders</option>
        <option value="bookings">Most bookings</option>
        <option value="name">Name (A-Z)</option>
      </select>
    </div>
  );
}
