import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { FileText, AlertTriangle } from "lucide-react";
import { WaiverEditor } from "./WaiverEditor";

export const dynamic = "force-dynamic";

export default async function AdminWaiverPage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/dashboard");

  const supabase = createAdminClient();
  const { data: rows } = await supabase
    .from("site_settings")
    .select("key, value")
    .in("key", ["waiver_enabled", "waiver_title", "waiver_text"]);

  const map = new Map((rows as any[] || []).map((r) => [r.key, r.value]));
  const enabled = (map.get("waiver_enabled") || "true").toLowerCase() !== "false";
  const title = map.get("waiver_title") || "Liability Waiver";
  const text = map.get("waiver_text") || "";

  // Count signed waivers for context
  const { count: signedCount } = await supabase
    .from("booking_waivers")
    .select("id", { count: "exact", head: true });

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1 flex items-center gap-2">
        <FileText className="h-6 w-6" /> Liability Waiver
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Customers e-sign this agreement at checkout. The exact text shown at
        signing time is snapshotted per booking, so editing here only affects
        FUTURE bookings — past signatures keep their original wording.
      </p>

      <div className="card bg-amber-50 border-l-4 border-l-amber-500 mb-6">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-amber-900 mb-1">
              Legal disclaimer
            </p>
            <p className="text-amber-900">
              This default waiver is a starting point built from common
              bounce-house industry language. <strong>Have it reviewed by a
              Florida attorney before going live.</strong> Liability waivers vary
              by state and the wrong wording can be unenforceable. Update the
              text below with your attorney's recommended version.
            </p>
          </div>
        </div>
      </div>

      <div className="card mb-4 text-sm text-slate-600">
        <strong>{signedCount || 0}</strong> waiver{signedCount === 1 ? "" : "s"} signed to date.
        Each one is viewable from the booking's detail page in <code>/admin/bookings</code>.
      </div>

      <WaiverEditor
        initialEnabled={enabled}
        initialTitle={title}
        initialText={text}
      />
    </div>
  );
}
