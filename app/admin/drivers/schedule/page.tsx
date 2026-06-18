// Driver schedule + skills profile editor. Used by the AI route optimizer
// to decide who gets which routes. Lives under /admin/drivers/schedule so
// it stays grouped with future driver-related admin pages.
//
// Each row = 1 active driver. If they have no profile row yet, the form
// shows empty defaults (40 hr/wk, no skills, etc.). Saving creates or
// updates the row via upsert.

import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Users } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { getCurrentTenantId } from "@/lib/tenant/db";
import { DriverScheduleClient, type DriverProfileRow } from "./DriverScheduleClient";

export const dynamic = "force-dynamic";

export default async function DriverSchedulePage() {
  const me = await getCurrentUserRole();
  if (!me) redirect("/admin/login");
  if (me.role !== "admin" && me.role !== "staff") redirect("/admin");

  const tenantId = getCurrentTenantId();
  if (!tenantId) redirect("/admin");

  const supabase = createAdminClient({ unscoped: true });

  // 1. Active drivers (user_roles)
  const { data: driverRoles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "driver")
    .eq("is_active", true);
  const driverUserIds = ((driverRoles as { user_id: string }[]) || []).map(
    (r) => r.user_id,
  );

  // 2. Resolve emails + names via auth.users
  const drivers: { email: string; name: string }[] = [];
  if (driverUserIds.length > 0) {
    const { data: usersPage } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const userMap = new Map((usersPage?.users || []).map((u) => [u.id, u]));
    for (const uid of driverUserIds) {
      const u = userMap.get(uid);
      if (!u?.email) continue;
      const meta = (u.user_metadata as { first_name?: string; last_name?: string }) || {};
      const name =
        [meta.first_name, meta.last_name].filter(Boolean).join(" ") || u.email;
      drivers.push({ email: u.email.toLowerCase(), name });
    }
  }

  // 3. Existing schedule profiles
  const { data: profilesRaw } = await supabase
    .from("driver_schedule_profiles")
    .select("driver_email, skills, home_zip, weekly_max_hours, available_days, notes")
    .eq("tenant_id", tenantId);
  const profileByEmail = new Map<string, any>(
    ((profilesRaw as any[]) || []).map((p) => [
      (p.driver_email || "").toLowerCase(),
      p,
    ]),
  );

  const rows: DriverProfileRow[] = drivers
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => {
      const p = profileByEmail.get(d.email);
      return {
        email: d.email,
        name: d.name,
        skills: p?.skills || [],
        home_zip: p?.home_zip || "",
        weekly_max_hours: p?.weekly_max_hours ?? 40,
        available_days: p?.available_days || [],
        notes: p?.notes || "",
      };
    });

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-navy mb-4"
      >
        <ChevronLeft className="h-4 w-4" /> Back to admin
      </Link>

      <h1 className="text-2xl font-bold text-brand-navy mb-1 flex items-center gap-2">
        <Users className="h-5 w-5" />
        Driver schedule profiles
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Set skills, home ZIP, weekly hour cap, and available days for each
        driver. The AI route optimizer uses these to assign routes faster
        and more fairly. All fields are optional — empty means "no constraint."
      </p>

      {rows.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded p-6 text-center">
          <p className="text-sm text-slate-600">
            No active drivers yet. Invite drivers in{" "}
            <Link href="/admin/team" className="text-brand-navy underline">
              /admin/team
            </Link>{" "}
            first.
          </p>
        </div>
      ) : (
        <DriverScheduleClient initialRows={rows} />
      )}
    </div>
  );
}
