// Operator's own MFA recovery codes. Lives in /superadmin so only Ludmila
// (or other platform owners) can manage them. Tenant admins do not get
// self-service recovery — if they lose their device, they email Ludmila
// who resets via /superadmin/users-mfa.

import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, KeyRound } from "lucide-react";
import { getSuperadminUser } from "@/lib/auth/superadmin";
import { getRecoveryCodeStatus } from "@/lib/auth/recovery-codes";
import { RecoveryCodesClient } from "./RecoveryCodesClient";

export const dynamic = "force-dynamic";

export default async function SuperadminRecoveryCodesPage() {
  const me = await getSuperadminUser();
  if (!me) redirect("/admin/login?error=not_superadmin");

  const status = await getRecoveryCodeStatus(me.id);

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Link
        href="/superadmin/dashboard"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-navy mb-4"
      >
        <ChevronLeft className="h-4 w-4" /> Back to superadmin dashboard
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="bg-amber-100 text-amber-800 p-2 rounded">
          <KeyRound className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold text-brand-navy">
          My MFA recovery codes
        </h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Single-use codes that let YOU reset MFA on your own platform-owner
        account if you lose your authenticator. We show them <strong>once</strong>;
        write them down somewhere very safe (1Password Family, paper in a
        safe). Tenant admins do not get self-service recovery — they email
        you and you reset via{" "}
        <Link href="/superadmin/users-mfa" className="text-brand-navy underline">
          /superadmin/users-mfa
        </Link>
        .
      </p>

      <RecoveryCodesClient initialStatus={status} />
    </div>
  );
}
