// Driver account page — minimal. Email, role, sign out, app install hint.

import Link from "next/link";
import { LogOut, User as UserIcon, ShieldCheck, Phone, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function DriverMePage() {
  const authClient = createClient();
  const { data: { user } } = await authClient.auth.getUser();
  const role = await getCurrentUserRole();
  const meta = (user?.user_metadata as any) || {};
  const name =
    meta.full_name ||
    [meta.first_name, meta.last_name].filter(Boolean).join(" ") ||
    user?.email ||
    "Unknown";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-brand-navy mb-2">Me</h1>

      <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-brand-navy text-white flex items-center justify-center text-lg font-bold">
          {(meta.first_name || user?.email || "?")[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-800 truncate">{name}</div>
          <div className="text-xs text-slate-500 truncate">{user?.email}</div>
          <div className="text-xs text-slate-600 mt-1 inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            <span className="capitalize">{role?.role || "—"}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Link
          href="/admin/settings/security"
          className="flex items-center gap-3 p-4 hover:bg-slate-50 active:scale-95"
        >
          <UserIcon className="h-5 w-5 text-slate-500" />
          <div className="flex-1">
            <div className="font-medium text-slate-800 text-sm">Security</div>
            <div className="text-xs text-slate-500">Two-factor authentication (2FA)</div>
          </div>
          <ExternalLink className="h-4 w-4 text-slate-400" />
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <a
          href="tel:+19045843047"
          className="flex items-center gap-3 p-4 hover:bg-slate-50 active:scale-95"
        >
          <Phone className="h-5 w-5 text-emerald-600" />
          <div className="flex-1">
            <div className="font-medium text-slate-800 text-sm">Call admin</div>
            <div className="text-xs text-slate-500">For route changes or questions</div>
          </div>
        </a>
      </div>

      <form action="/admin/logout" method="post" className="pt-4">
        <button
          type="submit"
          className="w-full rounded-xl border border-red-200 bg-white text-red-700 font-medium py-3 hover:bg-red-50 active:scale-95 inline-flex items-center justify-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </form>

      <p className="text-center text-xs text-slate-400 pt-4">
        Tip: install the driver app on your home screen for faster access. Use
        the install banner that appears at the bottom of the screen.
      </p>
    </div>
  );
}
