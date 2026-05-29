import { redirect } from "next/navigation";
import { getSuperadminUser } from "@/lib/auth/superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { InboxClient } from "./InboxClient";
import type { EmailAccount, EmailFolder, EmailThread, EmailLabel } from "@/lib/email/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function InboxPage({
  searchParams,
}: { searchParams: { account?: string; folder?: string; q?: string; page?: string } }) {
  const me = await getSuperadminUser();
  if (!me) redirect("/superadmin/login?error=not_superadmin");

  const supabase = createAdminClient({ unscoped: true });
  const [{ data: accounts }, { data: folders }, { data: labels }] = await Promise.all([
    supabase.from("email_accounts").select("*").eq("is_active", true).order("created_at"),
    supabase.from("email_folders").select("*").eq("is_active", true).order("name"),
    supabase.from("email_labels").select("*").order("name"),
  ]);

  let query = supabase.from("email_threads").select("*").order("last_message_at", { ascending: false, nullsFirst: false });
  if (searchParams.account) query = query.eq("account_id", searchParams.account);
  if (searchParams.folder) query = query.eq("folder_id", searchParams.folder);
  if (searchParams.q) query = query.ilike("subject", `%${searchParams.q}%`);

  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const from = (page - 1) * PAGE_SIZE;
  query = query.range(from, from + PAGE_SIZE - 1);
  const { data: threads } = await query;

  return (
    <InboxClient
      accounts={(accounts as EmailAccount[]) || []}
      folders={(folders as EmailFolder[]) || []}
      labels={(labels as EmailLabel[]) || []}
      threads={(threads as EmailThread[]) || []}
      page={page}
      pageSize={PAGE_SIZE}
      filters={searchParams}
    />
  );
}
