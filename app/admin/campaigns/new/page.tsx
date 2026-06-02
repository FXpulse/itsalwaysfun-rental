import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Megaphone } from "lucide-react";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { listExistingTags } from "../../customers/[email]/tag-actions";
import { CampaignBuilder } from "./CampaignBuilder";
import { getTenantInfo } from "@/lib/tenant/business";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/login");

  const availableTags = await listExistingTags();
  const tenant = await getTenantInfo();
  const tz = tenant.timezone;

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/admin/campaigns" className="text-sm text-slate-500 inline-flex items-center gap-1">
        <ChevronLeft className="h-4 w-4" /> Back to campaigns
      </Link>

      <div className="rounded-2xl bg-gradient-to-br from-fuchsia-600 via-violet-600 to-indigo-700 text-white p-6 shadow-xl">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-fuchsia-100 mb-2">
          <Megaphone className="h-3 w-3" /> New campaign
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold">Send a targeted email</h1>
        <p className="text-sm text-fuchsia-100 mt-2">
          Pick an audience, write the email, preview, send.
        </p>
      </div>

      <CampaignBuilder availableTags={availableTags} tz={tz} />
    </div>
  );
}
