import Link from "next/link";
import { LayoutDashboard, ChevronRight } from "lucide-react";

/** Breadcrumb-style nav for /superadmin/* pages. Always anchors to dashboard. */
export function Crumbs({ trail }: { trail: Array<{ label: string; href?: string }> }) {
  return (
    <nav className="flex items-center gap-1 text-sm mb-3 flex-wrap">
      <Link
        href="/superadmin/dashboard"
        className="text-slate-500 hover:text-brand-navy inline-flex items-center gap-1"
      >
        <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
      </Link>
      {trail.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 text-slate-300" />
          {c.href ? (
            <Link href={c.href} className="text-slate-500 hover:text-brand-navy">{c.label}</Link>
          ) : (
            <span className="font-semibold text-brand-navy">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
