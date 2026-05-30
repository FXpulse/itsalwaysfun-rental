import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getSuperadminUser } from "@/lib/auth/superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ComposeForm } from "./ComposeForm";
import type { EmailAccount } from "@/lib/email/types";

export const dynamic = "force-dynamic";

export default async function ComposePage({
  searchParams,
}: {
  searchParams: { to?: string; subject?: string; body?: string; cc?: string };
}) {
  const me = await getSuperadminUser();
  if (!me) redirect("/superadmin/login?error=not_superadmin");

  const supabase = createAdminClient({ unscoped: true });
  const { data: accounts } = await supabase
    .from("email_accounts").select("*")
    .eq("is_active", true)
    .order("created_at");

  const list = (accounts as EmailAccount[]) || [];

  return (
    <div className="max-w-3xl">
      <Link
        href="/superadmin/email"
        className="text-sm text-slate-500 inline-flex items-center gap-1 mb-3"
      >
        <ChevronLeft className="h-4 w-4" /> Back to inbox
      </Link>
      <h1 className="text-2xl font-bold text-brand-navy mb-4">New message</h1>
      {list.length === 0 ? (
        <p className="text-sm text-slate-500 card">
          No active email accounts. Add one first at <Link href="/superadmin/email/accounts/new" className="underline">/superadmin/email/accounts/new</Link>.
        </p>
      ) : (
        <ComposeForm
          accounts={list}
          initialTo={searchParams.to || ""}
          initialCc={searchParams.cc || ""}
          initialSubject={searchParams.subject || ""}
          initialBody={searchParams.body || ""}
        />
      )}
    </div>
  );
}
