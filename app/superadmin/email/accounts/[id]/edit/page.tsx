import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getSuperadminUser } from "@/lib/auth/superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditAccountForm } from "./EditAccountForm";

export const dynamic = "force-dynamic";

export default async function EditAccountPage({ params }: { params: { id: string } }) {
  const me = await getSuperadminUser();
  if (!me) redirect("/superadmin/login?error=not_superadmin");

  const supabase = createAdminClient({ unscoped: true });
  const { data: account } = await supabase
    .from("email_accounts").select("*").eq("id", params.id).maybeSingle();
  if (!account) notFound();

  return (
    <div className="max-w-2xl">
      <Link href="/superadmin/email/accounts" className="text-sm text-slate-500 inline-flex items-center gap-1 mb-3">
        <ChevronLeft className="h-4 w-4" /> Back to accounts
      </Link>
      <h1 className="text-2xl font-bold text-brand-navy mb-1">Edit email account</h1>
      <p className="text-sm text-slate-500 mb-6">
        Update the password or connection settings. Use <strong>Test</strong> to verify, then <strong>Save</strong>.
        You can save WITHOUT a successful test — the next sync will retry.
      </p>
      <EditAccountForm account={account as any} />
    </div>
  );
}
