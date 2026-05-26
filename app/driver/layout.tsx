// Driver shell — minimal. Drivers only see today's routes.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { LogOut, Truck } from "lucide-react";
import { InstallPWAPrompt } from "@/components/InstallPWAPrompt";

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

  // Admins/staff can use /driver too (acting as driver), but the redirect
  // from admin layout only sends actual drivers here

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-brand-navy text-white py-3 sticky top-0 z-30 shadow-md">
        <div className="max-w-2xl mx-auto px-4 flex items-center gap-3">
          <Link href="/driver" className="flex items-center gap-2 flex-1">
            <div className="bg-brand-yellow text-brand-navy text-[10px] font-bold tracking-widest px-2 py-0.5 rounded">
              DRIVER
            </div>
            <Truck className="h-5 w-5" />
            <span className="font-semibold text-sm">My routes</span>
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

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4">{children}</main>

      <footer className="text-center text-xs text-slate-400 py-4 px-4">
        <p className="mb-1">{user.email} · {role.role}</p>
        <p>Questions? Call (904) 584-3047</p>
      </footer>

      {/* PWA install prompt — auto-shows on Android/Chrome + iOS Safari helper */}
      <InstallPWAPrompt label="Install the driver app on your phone" />
    </div>
  );
}
