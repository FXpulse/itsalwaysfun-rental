"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-renders the current Server Component subtree on an interval so newly
 *  inserted rows (bookings, dispatch stops, calendar events, messages, etc.)
 *  appear without the user hitting F5.
 *
 *  Pause it while the user is mid-edit by passing `paused: true` — the
 *  refresh would otherwise wipe their unsubmitted form state.
 *
 *  Pause it when the tab is hidden — no point hammering the server while
 *  the page isn't visible.
 *
 *  Defaults: 30s interval, not paused. */
export function useAutoRefresh(opts: {
  intervalMs?: number;
  paused?: boolean;
} = {}) {
  const router = useRouter();
  const intervalMs = opts.intervalMs ?? 30_000;
  const paused = opts.paused ?? false;

  useEffect(() => {
    if (paused) return;

    let hidden = typeof document !== "undefined" && document.hidden;
    const onVisibilityChange = () => {
      hidden = document.hidden;
      // Refresh immediately when the user comes back to the tab — likely
      // they want fresh data and we paused while they were away
      if (!hidden) router.refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const id = setInterval(() => {
      if (!hidden) router.refresh();
    }, intervalMs);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs, paused, router]);
}
