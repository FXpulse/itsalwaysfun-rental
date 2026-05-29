// app/superadmin/email/accounts/new/page.tsx
import { redirect } from "next/navigation";
import { getSuperadminUser } from "@/lib/auth/superadmin";
import { AccountWizard } from "./AccountWizard";

export const dynamic = "force-dynamic";

export default async function NewAccountPage() {
  const me = await getSuperadminUser();
  if (!me) redirect("/superadmin/login?error=not_superadmin");
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1">Add email account</h1>
      <p className="text-sm text-slate-500 mb-6">5 steps. Live IMAP + SMTP test before save.</p>
      <AccountWizard />
    </div>
  );
}
