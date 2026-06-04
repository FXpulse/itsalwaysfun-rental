"use client";

import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh";

/** Drop into any Server Component page to enable auto-refresh of its data.
 *  Renders nothing — just runs the hook. Example:
 *
 *    export default async function BookingsPage() {
 *      const bookings = await fetchBookings();
 *      return (
 *        <div>
 *          <AutoRefresh />
 *          <BookingsList bookings={bookings} />
 *        </div>
 *      );
 *    }
 *
 *  Pass `intervalMs` to override the 30s default for slower-changing data
 *  (e.g. monthly calendar can be 60s). */
export function AutoRefresh({ intervalMs }: { intervalMs?: number } = {}) {
  useAutoRefresh({ intervalMs });
  return null;
}
