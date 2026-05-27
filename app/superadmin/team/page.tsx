import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Crown, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TeamManager } from "./TeamManager";

export const dynamic = "force-dynamic";

export interface SuperadminRow {
  user_id: string;
  email: string;
  last_sign_in_at: string | null;
  created_at: string;
}

export default async function SuperadminTeamPage() {
  // Auth (raw — bypass tenant scoping)
  const authClient = createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) redirect("/superadmin/login");

  const admin = createAdminClient({ unscoped: true });
  const { data: meRow } = await admin
    .from("user_roles")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .eq("is_superadmin", true)
    .maybeSingle();
  if (!meRow) redirect("/superadmin/login?error=not_superadmin");

  // Fetch all distinct superadmin user_ids
  const { data: roles } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("is_superadmin", true)
    .eq("is_active", true);

  const superadminIds = Array.from(
    new Set(((roles as any[]) || []).map((r) => r.user_id)),
  );

  // Pull their email + last sign in from auth
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const authMap = new Map(
    (authData?.users || []).map((u) => [
      u.id,
      {
        email: u.email || "(unknown)",
        last_sign_in_at: u.last_sign_in_at,
        created_at: u.created_at,
      },
    ]),
  );

  const team: SuperadminRow[] = superadminIds.map((id) => {
    const info = authMap.get(id);
    return {
      user_id: id,
      email: info?.email || "(unknown user)",
      last_sign_in_at: info?.last_sign_in_at || null,
      created_at: info?.created_at || "",
    };
  });

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Link
        href="/superadmin/tenants"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-navy mb-4"
      >
        <ChevronLeft className="h-4 w-4" /> Back to tenants
      </Link>

      <h1 className="text-2xl font-bold text-brand-navy flex items-center gap-2 mb-1">
        <Users className="h-6 w-6" /> RentalFlow team
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        People with superadmin access — can manage all tenants, billing,
        suspension, impersonation. Add helpers as you scale support.
      </p>

      <TeamManager team={team} currentUserId={user.id} />
    </div>
  );
}
