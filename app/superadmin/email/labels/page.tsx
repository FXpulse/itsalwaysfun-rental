// app/superadmin/email/labels/page.tsx
import { redirect } from "next/navigation";
import { getSuperadminUser } from "@/lib/auth/superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { Crumbs } from "../../Crumbs";
import { LabelsClient } from "./LabelsClient";
import type { EmailAccount, EmailLabel } from "@/lib/email/types";

export const dynamic = "force-dynamic";

export default async function LabelsPage() {
  const me = await getSuperadminUser();
  if (!me) redirect("/superadmin/login?error=not_superadmin");
  const supabase = createAdminClient({ unscoped: true });
  const [{ data: accounts }, { data: labels }] = await Promise.all([
    supabase.from("email_accounts").select("*").eq("is_active", true),
    supabase.from("email_labels").select("*"),
  ]);
  return (
    <div className="max-w-2xl">
      <Crumbs trail={[{ label: "Email", href: "/superadmin/email" }, { label: "Labels" }]} />
      <h1 className="text-2xl font-bold text-brand-navy mb-4">Labels</h1>
      <LabelsClient accounts={(accounts as EmailAccount[]) || []} labels={(labels as EmailLabel[]) || []} />
    </div>
  );
}
