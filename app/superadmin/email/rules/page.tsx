// app/superadmin/email/rules/page.tsx
import { redirect } from "next/navigation";
import { getSuperadminUser } from "@/lib/auth/superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { Crumbs } from "../../Crumbs";
import { RulesClient } from "./RulesClient";
import type { EmailAccount, EmailLabel, EmailRule } from "@/lib/email/types";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const me = await getSuperadminUser();
  if (!me) redirect("/superadmin/login?error=not_superadmin");
  const supabase = createAdminClient({ unscoped: true });
  const [{ data: accounts }, { data: labels }, { data: rules }] = await Promise.all([
    supabase.from("email_accounts").select("*").eq("is_active", true),
    supabase.from("email_labels").select("*"),
    supabase.from("email_rules").select("*").order("priority"),
  ]);
  return (
    <div className="max-w-2xl">
      <Crumbs trail={[{ label: "Email", href: "/superadmin/email" }, { label: "Rules" }]} />
      <h1 className="text-2xl font-bold text-brand-navy mb-4">Rules</h1>
      <RulesClient
        accounts={(accounts as EmailAccount[]) || []}
        labels={(labels as EmailLabel[]) || []}
        rules={(rules as EmailRule[]) || []}
      />
    </div>
  );
}
