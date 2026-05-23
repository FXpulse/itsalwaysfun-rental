// Admin shell — sidebar nav + logout. Auth handled by middleware.ts.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogOut, Calendar, Package, BookOpen, Settings, Home, Globe, Tag } from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Login page renders without sidebar
  // (middleware redirects unauthenticated for other routes)
  if (!user) {
    return <>{children}</>;
  }

  const nav = [
    { href: "/admin/dashboard", label: "Dashboard", icon: Home },
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/categories", label: "Categories", icon: Tag },
    { href: "/admin/bookings", label: "Bookings", icon: BookOpen },
    { href: "/admin/availability", label: "Availability", icon: Calendar },
    { href: "/admin/site", label: "Website content", icon: Globe },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-brand-navy text-white flex flex-col">
        <div className="p-6 border-b border-white/10">
          <div className="inline-block bg-brand-yellow text-brand-navy text-[10px] font-bold tracking-widest px-2 py-0.5 rounded mb-2">
            ADMIN
          </div>
          <h1 className="text-lg font-bold">It's Always Fun</h1>
          <p className="text-xs text-white/60">Rental management</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded hover:bg-white/10 transition"
            >
              <item.icon className="h-4 w-4" />
              <span className="text-sm">{item.label}</span>
            </Link>
          ))}
        </nav>

        <form action="/admin/logout" method="post" className="p-4 border-t border-white/10">
          <p className="text-xs text-white/50 mb-2">{user.email}</p>
          <button
            type="submit"
            className="flex items-center gap-2 text-sm text-white/80 hover:text-brand-yellow transition"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </form>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  );
}
