// Driver shell — minimal. Drivers only see today's routes.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { LogOut, Truck } from "lucide-react";
import { InstallPWAPrompt } from "@/components/InstallPWAPrompt";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant/server";
import { BottomNav } from "./BottomNav";

export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login?next=/driver");

  const role = await getCurrentUserRole();
  if (!role) redirect("/admin/login?error=no_role");

  // Unread count para el badge del bottom nav Inbox: mensajes mention-eando
  // al driver en booking_internal_messages de los últimos 7 días en bookings
  // que tiene asignados via dispatch_stops. Both queries MUST filter by
  // tenant_id — unscoped admin client bypasses RLS, so a missing filter
  // would leak cross-tenant stops + messages into the count.
  let unreadCount = 0;
  try {
    const currentTenantId = getCurrentTenantId();
    if (currentTenantId) {
      const admin = createAdminClient({ unscoped: true });
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
      const { data: assignedStops } = await admin
        .from("dispatch_stops")
        .select("booking_id")
        .eq("tenant_id", currentTenantId);
      const myBookingIds = ((assignedStops as any[]) || []).map((s) => s.booking_id);
      if (myBookingIds.length > 0) {
        const { count } = await admin
          .from("booking_internal_messages")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", currentTenantId)
          .in("booking_id", myBookingIds)
          .contains("mention_user_ids", [user.id])
          .gte("created_at", sevenDaysAgo)
          .is("deleted_at", null);
        unreadCount = count || 0;
      }
    }
  } catch (e) {
    // Best-effort — never block the UI
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-brand-navy text-white py-3 sticky top-0 z-30 shadow-md">
        <div className="max-w-2xl mx-auto px-4 flex items-center gap-3">
          <Link href="/driver" className="flex items-center gap-2 flex-1">
            <div className="bg-brand-yellow text-brand-navy text-[10px] font-bold tracking-widest px-2 py-0.5 rounded">
              DRIVER
            </div>
            <Truck className="h-5 w-5" />
            <span className="font-semibold text-sm">It's Always Fun</span>
          </Link>
          <form action="/admin/logout" method="post">
            <button
              type="submit"
              className="text-white/70 hover:text-brand-yellow p-2"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </header>

      {/* Bottom padding (pb-20) keeps content above the fixed BottomNav. */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 pb-20">{children}</main>

      {/* Fixed bottom nav across all /driver/* pages */}
      <BottomNav unreadCount={unreadCount} />

      {/* PWA install prompt — auto-shows on Android/Chrome + iOS Safari helper */}
      <InstallPWAPrompt label="Install the driver app on your phone" />
    </div>
  );
}
