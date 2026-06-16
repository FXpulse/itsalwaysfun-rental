// MFA verify gate — middleware redirige aquí cuando el usuario tiene un factor
// TOTP enrolado pero la sesión actual sigue en AAL1 (solo password).

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MfaVerifyForm } from "./MfaVerifyForm";

export const dynamic = "force-dynamic";

export default async function MfaVerifyPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: factorsList } = await supabase.auth.mfa.listFactors();
  const totps = factorsList?.totp?.filter((f) => f.status === "verified") || [];
  if (totps.length === 0) {
    // No factor enrolado — no debería estar acá. Mandalo al admin dashboard.
    redirect("/admin/dashboard");
  }

  const nextPath = searchParams?.next || "/admin/dashboard";

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Two-factor verification</h1>
        <p className="text-sm text-slate-600 mb-6">
          Enter the 6-digit code from your authenticator app to continue.
        </p>
        <MfaVerifyForm
          factorId={totps[0].id}
          factorName={totps[0].friendly_name || "Authenticator"}
          nextPath={nextPath}
        />
      </div>
    </div>
  );
}
