// Security settings — currently TOTP-based 2FA enrollment.
// Supabase Auth handles the cryptography; this page is the UI for users
// to enroll a TOTP factor (Google Authenticator / 1Password / Authy).

import Link from "next/link";
import { requireAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant/server";
import { isAdminMfaRequired } from "@/lib/auth/mfa-required";
import { MfaPanel } from "./MfaPanel";
import { RequireMfaToggle } from "./RequireMfaToggle";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage({
  searchParams,
}: {
  searchParams: { enroll_required?: string };
}) {
  await requireAdmin();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Lista los factores ya enrolados (TOTP, phone, etc.)
  const { data: factorsList } = await supabase.auth.mfa.listFactors();
  const totpFactors = factorsList?.totp || [];
  const verifiedFactorCount = totpFactors.filter((f) => f.status === "verified").length;
  // AAL (Authenticator Assurance Level): aal1 = solo password, aal2 = password + TOTP
  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const currentAal: "aal1" | "aal2" = aalData?.currentLevel === "aal2" ? "aal2" : "aal1";

  const tenantId = getCurrentTenantId();
  const mfaRequired = tenantId ? await isAdminMfaRequired(tenantId) : false;
  const camFromGate = searchParams?.enroll_required === "1";

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <div className="mb-6">
        <Link href="/admin/settings" className="text-sm text-slate-500 hover:underline">
          ← Settings
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Security</h1>
      <p className="text-sm text-slate-500 mb-6">
        Two-factor authentication (2FA) using a time-based code from your phone's
        authenticator app. Protects against password compromise.
      </p>

      {camFromGate && verifiedFactorCount === 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-red-800 mb-1">
              This account requires 2FA for admins
            </p>
            <p className="text-red-700">
              Enroll an authenticator below to continue. You can't reach
              other admin pages until 2FA is set up.
            </p>
          </div>
        </div>
      )}

      <RequireMfaToggle
        initialValue={mfaRequired}
        currentUserHasFactor={verifiedFactorCount > 0}
      />

      <MfaPanel
        userEmail={user?.email || ""}
        enrolledFactors={totpFactors.map((f) => ({
          id: f.id,
          friendlyName: f.friendly_name || "Authenticator",
          createdAt: f.created_at || null,
          status: f.status,
        }))}
        currentAal={currentAal}
      />
    </div>
  );
}
