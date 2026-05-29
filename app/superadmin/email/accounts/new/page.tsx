// app/superadmin/email/accounts/new/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { AccountWizard } from "./AccountWizard";

export const dynamic = "force-dynamic";

export default async function NewAccountPage() {
  const me = await getCurrentUserRole();
  // @ts-expect-error — "superadmin" is a valid DB role not yet in the UserRole union
  if (!me || me.role !== "superadmin") redirect("/superadmin/login");
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1">Add email account</h1>
      <p className="text-sm text-slate-500 mb-6">5 steps. Live IMAP + SMTP test before save.</p>
      <AccountWizard />
    </div>
  );
}
