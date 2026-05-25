import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { HelpClient } from "./HelpClient";

export const dynamic = "force-dynamic";

export default async function AdminHelpPage() {
  const me = await getCurrentUserRole();
  if (!me) redirect("/admin/login");

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1">Help & Setup Guide</h1>
      <p className="text-sm text-slate-500 mb-6">
        Step-by-step manual for setting up your rental business from scratch.
        Downloadable CSV templates for bulk uploads.
      </p>
      <HelpClient />
    </div>
  );
}
