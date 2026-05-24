// Portal shell — protected. Redirects to /portal/login if not authenticated.
// Admin users can also access this (they'd see no bookings if they aren't customers).

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogOut, Home, BookOpen, User, Plus, Gift, Sparkles } from "lucide-react";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/portal/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/portal" className="flex items-center gap-2">
            <div className="bg-brand-yellow text-brand-navy text-[10px] font-bold tracking-widest px-2 py-0.5 rounded">
              IAF
            </div>
            <span className="font-semibold text-brand-navy hidden sm:inline">Customer portal</span>
          </Link>
          <nav className="flex gap-1 ml-auto text-sm">
            <NavLink href="/portal" icon={Home} label="Home" />
            <NavLink href="/portal/bookings" icon={BookOpen} label="Bookings" />
            <NavLink href="/portal/points" icon={Sparkles} label="Points" />
            <NavLink href="/portal/referrals" icon={Gift} label="Refer" />
            <NavLink href="/portal/profile" icon={User} label="Profile" />
            <Link
              href="/order-by-date"
              className="btn-primary text-xs px-3 py-1.5 ml-2 inline-flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Book now
            </Link>
            <form action="/portal/logout" method="post" className="ml-2">
              <button
                type="submit"
                className="text-slate-500 hover:text-brand-navy p-2"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">{children}</main>

      <footer className="text-center text-xs text-slate-400 py-6">
        <p>{user.email}</p>
      </footer>
    </div>
  );
}

function NavLink({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100 hover:text-brand-navy transition inline-flex items-center gap-1"
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
