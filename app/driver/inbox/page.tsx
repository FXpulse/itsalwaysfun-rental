// Driver inbox — recent team-chat across all assigned bookings.
// Groups by booking; shows the latest few messages. Tap a booking to drill
// into the full thread inline.

import Link from "next/link";
import { ArrowRight, MessageCircle, AtSign } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function DriverInboxPage() {
  const authClient = createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return null;
  const me = await getCurrentUserRole().catch(() => null);

  const supabase = createAdminClient();

  // Bookings I'm assigned to via dispatch_stops (RLS filters cross-tenant)
  const { data: stops } = await supabase
    .from("dispatch_stops")
    .select(`
      booking_id,
      bookings (
        id, customer_first_name, customer_last_name, event_date, product_name
      )
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  const bookingMap = new Map<string, any>();
  for (const s of (stops as any[]) || []) {
    if (s.bookings && !bookingMap.has(s.booking_id)) {
      bookingMap.set(s.booking_id, s.bookings);
    }
  }
  const bookingIds = Array.from(bookingMap.keys());

  if (bookingIds.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <MessageCircle className="h-12 w-12 mx-auto text-slate-300 mb-3" />
        <p className="text-sm">No assigned bookings yet.</p>
        <p className="text-xs mt-1">Your inbox will fill up once you're added to a route.</p>
      </div>
    );
  }

  // Latest message per booking (any thread that has activity)
  const { data: messages } = await supabase
    .from("booking_internal_messages")
    .select("id, booking_id, body, author_name, author_role, mention_user_ids, created_at, deleted_at")
    .in("booking_id", bookingIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  const latestByBooking = new Map<string, any>();
  const countsByBooking = new Map<string, { total: number; mentionsMe: number }>();
  for (const m of (messages as any[]) || []) {
    if (!latestByBooking.has(m.booking_id)) {
      latestByBooking.set(m.booking_id, m);
    }
    const c = countsByBooking.get(m.booking_id) || { total: 0, mentionsMe: 0 };
    c.total++;
    if (Array.isArray(m.mention_user_ids) && me?.id && m.mention_user_ids.includes(me.id)) {
      c.mentionsMe++;
    }
    countsByBooking.set(m.booking_id, c);
  }

  // Build ordered list — bookings with activity first, by most recent
  const ordered = bookingIds
    .map((bid) => {
      const b = bookingMap.get(bid);
      const latest = latestByBooking.get(bid);
      const counts = countsByBooking.get(bid) || { total: 0, mentionsMe: 0 };
      return { booking: b, latest, counts };
    })
    .sort((a, b) => {
      const at = a.latest?.created_at ? new Date(a.latest.created_at).getTime() : 0;
      const bt = b.latest?.created_at ? new Date(b.latest.created_at).getTime() : 0;
      return bt - at;
    });

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold text-brand-navy mb-1">Inbox</h1>
      <p className="text-xs text-slate-500 mb-4">
        Team chat across your assigned bookings. @mentions highlighted.
      </p>

      {ordered.map(({ booking, latest, counts }) => {
        const fullName = `${booking.customer_first_name} ${booking.customer_last_name}`.trim();
        const hasMention = counts.mentionsMe > 0;
        return (
          <Link
            key={booking.id}
            href={`/driver/booking/${booking.id}/chat`}
            className={`block rounded-xl border-2 transition active:scale-95 ${
              hasMention
                ? "border-blue-300 bg-blue-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="p-3 flex items-start gap-3">
              <div className="flex-shrink-0">
                {hasMention ? (
                  <div className="h-10 w-10 rounded-full bg-blue-500 text-white flex items-center justify-center">
                    <AtSign className="h-5 w-5" />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold">
                    {booking.customer_first_name?.[0]?.toUpperCase()}
                    {booking.customer_last_name?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-800 truncate">{fullName}</span>
                  {latest?.created_at && (
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {timeAgo(latest.created_at)}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mb-1">
                  {booking.product_name} · {booking.event_date}
                </div>
                {latest ? (
                  <p className="text-xs text-slate-600 line-clamp-2">
                    <span className="font-medium">{latest.author_name}:</span> {latest.body}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic">No messages yet — start the thread</p>
                )}
                {counts.total > 0 && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[10px] bg-slate-200 text-slate-700 rounded px-1.5 py-0.5">
                      {counts.total} {counts.total === 1 ? "message" : "messages"}
                    </span>
                    {hasMention && (
                      <span className="text-[10px] bg-blue-500 text-white rounded px-1.5 py-0.5 font-bold">
                        @ you {counts.mentionsMe}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}
