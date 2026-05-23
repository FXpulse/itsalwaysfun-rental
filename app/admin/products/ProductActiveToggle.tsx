"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { toggleProductActive } from "./actions";

export function ProductActiveToggle({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState(isActive);

  function handleToggle() {
    startTransition(async () => {
      const prev = active;
      setActive(!active);
      const result = await toggleProductActive(id, prev);
      if (result?.error) {
        setActive(prev);
        toast.error(result.error);
      } else {
        toast.success(prev ? "Set to inactive" : "Set to active");
      }
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={pending}
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded
        ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}
        hover:opacity-80 transition disabled:opacity-50`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`}
      ></span>
      {active ? "Active" : "Inactive"}
    </button>
  );
}
