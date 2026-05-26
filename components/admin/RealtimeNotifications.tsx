"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/** Mounts in the admin layout. Listens to INSERTs on key tables via Supabase
 *  Realtime and pops a toast + refreshes the route data so dashboards/lists
 *  update without a manual page refresh.
 *
 *  Tables watched (must be in the supabase_realtime publication — see
 *  supabase/realtime_publication.sql):
 *    - contact_messages → "New message from X"
 *    - bookings → "New booking: Product on date"
 *    - payout_requests → "Payout request from X"
 *    - coi_requests → "COI request for Venue X"
 *
 *  Suppresses notifications for the first 2 seconds after mount to avoid
 *  toasts for messages that already existed on page load.
 */
export function RealtimeNotifications() {
  const router = useRouter();
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    const supabase = createClient();

    function notify(title: string, description: string) {
      // Skip notifications for stuff that was inserted JUST before page load
      // (sometimes Realtime replays the latest insert when first subscribing).
      if (Date.now() - mountedAt.current < 2000) return;
      toast(title, {
        description,
        duration: 6000,
        action: {
          label: "Refresh",
          onClick: () => router.refresh(),
        },
      });
      // Auto-refresh the current route's data so the new row shows up
      router.refresh();
    }

    const channel = supabase
      .channel("admin-realtime")
      // 📨 New contact messages (form OR inbound email)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "contact_messages" },
        (payload) => {
          const m = payload.new as any;
          const sender = `${m.first_name || ""} ${m.last_name || ""}`.trim() || m.email;
          const subject = m.subject ? ` — ${m.subject}` : "";
          const source = m.source === "inbound-email" ? " 📥 email" : " 📝 form";
          notify(`📨 New message${source}`, `${sender}${subject}`);
        },
      )
      // 📅 New bookings (any status — paid + pending)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bookings" },
        (payload) => {
          const b = payload.new as any;
          const customer = `${b.customer_first_name || ""} ${b.customer_last_name || ""}`.trim();
          const product = b.product_name || "rental";
          const paid = b.stripe_payment_status === "paid";
          notify(
            paid ? "💰 New PAID booking" : "📅 New booking (pending payment)",
            `${customer} · ${product} · ${b.event_date}`,
          );
        },
      )
      // 💵 Payout requests from referrers
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "payout_requests" },
        (payload) => {
          const r = payload.new as any;
          const amount = `$${((r.amount_cents || 0) / 100).toFixed(2)}`;
          const type = r.payout_type === "credit" ? "credit" : "cash";
          notify(
            `💵 Payout requested (${type})`,
            `${amount} — review in /admin/loyalty`,
          );
        },
      )
      // 📄 COI requests from customers needing venue insurance
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "coi_requests" },
        (payload) => {
          const c = payload.new as any;
          notify(
            "📄 COI requested",
            `For venue: ${c.venue_name} — see /admin/coi`,
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  // No UI — purely a side-effect component
  return null;
}
