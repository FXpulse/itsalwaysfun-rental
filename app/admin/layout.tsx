// Admin shell — sidebar nav + logout. Auth handled by middleware.ts.
// Role-based access: staff see limited nav (bookings/inventory/availability),
// admin sees everything. Users with no role are kicked to /admin/login.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/roles";
import {
  LogOut,
  Calendar,
  Package,
  BookOpen,
  Settings,
  Home,
  Globe,
  Tag,
  HelpCircle,
  Ticket,
  Users,
  BarChart3,
  Boxes,
  UserCircle,
  FileText,
  Images,
  Sparkles,
} from "lucide-react";

type Role = "admin" | "staff";

interface NavItem {
  href: string;
  label: string;
  icon: any;
  minRole: Role;
}

const ALL_NAV: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: Home, minRole: "staff" },
  { href: "/admin/bookings", label: "Bookings", icon: BookOpen, minRole: "staff" },
  { href: "/admin/quotes", label: "Quotes", icon: FileText, minRole: "admin" },
  { href: "/admin/customers", label: "Customers", icon: UserCircle, minRole: "staff" },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes, minRole: "staff" },
  { href: "/admin/availability", label: "Availability", icon: Calendar, minRole: "staff" },
  { href: "/admin/products", label: "Products", icon: Package, minRole: "admin" },
  { href: "/admin/categories", label: "Categories", icon: Tag, minRole: "admin" },
  { href: "/admin/coupons", label: "Coupons", icon: Ticket, minRole: "admin" },
  { href: "/admin/loyalty", label: "Loyalty", icon: Sparkles, minRole: "admin" },
  { href: "/admin/reports", label: "Reports", icon: BarChart3, minRole: "admin" },
  { href: "/admin/site", label: "Website content", icon: Globe, minRole: "admin" },
  { href: "/admin/banners", label: "Home banners", icon: Images, minRole: "admin" },
  { href: "/admin/faqs", label: "FAQs", icon: HelpCircle, minRole: "admin" },
  { href: "/admin/users", label: "Users", icon: Users, minRole: "admin" },
  { href: "/admin/settings", label: "Settings", icon: Settings, minRole: "admin" },
];

function visibleNav(role: Role): NavItem[] {
  if (role === "admin") return ALL_NAV;
  return ALL_NAV.filter((item) => item.minRole === "staff");
}

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

  // Authenticated but no role assigned? Kick to login with error.
  // (Admin must seed user_roles row via /admin/users or SQL.)
  const userRole = await getCurrentUserRole();
  if (!userRole) {
    // Sign out + redirect with error
    redirect("/admin/login?error=no_role");
  }

  const nav = visibleNav(userRole.role);
  const roleBadge =
    userRole.role === "admin" ? (
      <span className="inline-block bg-brand-yellow text-brand-navy text-[10px] font-bold tracking-widest px-2 py-0.5 rounded mb-2">
        ADMIN
      </span>
    ) : (
      <span className="inline-block bg-white/20 text-white text-[10px] font-bold tracking-widest px-2 py-0.5 rounded mb-2">
        STAFF
      </span>
    );

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-brand-navy text-white flex flex-col">
        <div className="p-6 border-b border-white/10">
          {roleBadge}
          <h1 className="text-lg font-bold">It's Always Fun</h1>
          <p className="text-xs text-white/60">Rental management</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
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
