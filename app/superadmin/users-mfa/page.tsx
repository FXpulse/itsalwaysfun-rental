// Operator-only MFA reset surface. Lists every active user across all
// tenants with their MFA enrollment status. Ludmila uses this when a
// tenant admin loses their device and asks for help.
//
// Resetting just deletes the user's TOTP factors. The user can then log
// in with password, and the admin layout's mfa-required gate forces
// re-enrollment of a new device.

import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ShieldOff } from "lucide-react";
import { getSuperadminUser } from "@/lib/auth/superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { UsersMfaClient, type UserMfaRow } from "./UsersMfaClient";

export const dynamic = "force-dynamic";

export default async function SuperadminUsersMfaPage() {
  const me = await getSuperadminUser();
  if (!me) redirect("/admin/login?error=not_superadmin");

  const supabase = createAdminClient({ unscoped: true });

  // List users + count factors. We do this in 3 queries (auth users +
  // factors + roles) because joins across the auth schema are awkward
  // from the JS client.
  const { data: usersPage } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const users = usersPage?.users || [];

  const { data: factors } = await (supabase as any)
    .schema("auth")
    .from("mfa_factors")
    .select("user_id, status");
  const factorByUser = new Map<string, { verified: number; total: number }>();
  for (const f of (factors as { user_id: string; status: string }[]) || []) {
    const cur = factorByUser.get(f.user_id) || { verified: 0, total: 0 };
    cur.total++;
    if (f.status === "verified") cur.verified++;
    factorByUser.set(f.user_id, cur);
  }

  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id, role, tenant_id, is_active, is_superadmin")
    .eq("is_active", true);

  // Group roles by user
  const rolesByUser = new Map<
    string,
    { role: string; tenant_id: string; is_superadmin: boolean }[]
  >();
  for (const r of (roles as any[]) || []) {
    const arr = rolesByUser.get(r.user_id) || [];
    arr.push({ role: r.role, tenant_id: r.tenant_id, is_superadmin: !!r.is_superadmin });
    rolesByUser.set(r.user_id, arr);
  }

  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, business_name");
  const tenantNameById = new Map<string, string>(
    ((tenants as { id: string; business_name: string }[]) || []).map((t) => [
      t.id,
      t.business_name,
    ]),
  );

  const rows: UserMfaRow[] = users
    .filter((u) => rolesByUser.has(u.id)) // only show users with active roles
    .map((u) => {
      const userRoles = rolesByUser.get(u.id) || [];
      const fac = factorByUser.get(u.id) || { verified: 0, total: 0 };
      return {
        userId: u.id,
        email: u.email || "",
        roles: userRoles.map((r) => ({
          role: r.role,
          tenantName: tenantNameById.get(r.tenant_id) || r.tenant_id.slice(0, 8),
          isSuperadmin: r.is_superadmin,
        })),
        verifiedFactors: fac.verified,
        totalFactors: fac.total,
        isSelf: u.id === me.id,
      };
    });

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Link
        href="/superadmin/dashboard"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-navy mb-4"
      >
        <ChevronLeft className="h-4 w-4" /> Back to superadmin dashboard
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="bg-rose-100 text-rose-800 p-2 rounded">
          <ShieldOff className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold text-brand-navy">
          MFA reset for users
        </h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Lists every active user across all tenants with their MFA factor
        count. When a tenant admin loses their device, click <strong>Reset
        MFA</strong> on their row to delete all their TOTP factors. The
        user can then log in with their password and the admin layout will
        force them to enroll a new factor.
      </p>

      <UsersMfaClient rows={rows} />
    </div>
  );
}
