// Security settings — currently TOTP-based 2FA enrollment.
// Supabase Auth handles the cryptography; this page is the UI for users
// to enroll a TOTP factor (Google Authenticator / 1Password / Authy).

import Link from "next/link";
import { requireAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { MfaPanel } from "./MfaPanel";

export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage() {
  await requireAdmin();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Lista los factores ya enrolados (TOTP, phone, etc.)
  const { data: factorsList } = await supabase.auth.mfa.listFactors();
  const totpFactors = factorsList?.totp || [];
  // AAL (Authenticator Assurance Level): aal1 = solo password, aal2 = password + TOTP
  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  // currentLevel está tipado como AuthenticatorAssuranceLevels (string union) →
  // narrow al subset que la prop espera.
  const currentAal: "aal1" | "aal2" = aalData?.currentLevel === "aal2" ? "aal2" : "aal1";

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
