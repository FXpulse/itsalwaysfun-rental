// Per-tenant Twilio config — shared-account model.
// Lives at /superadmin/tenants/[id]/sms — operator (Ludmila) buys a number
// in the platform's Twilio console, pastes E.164 here. From then on, that
// tenant's customer-facing SMS sends from that number.
//
// Without a number, customer-facing SMS for that tenant is skipped silently
// (email side still goes out) and Sentry logs a warning.

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SmsConfigForm } from "./SmsConfigForm";

export const dynamic = "force-dynamic";

export default async function TenantSmsConfigPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/superadmin/login");

  const admin = createAdminClient({ unscoped: true });
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .eq("is_superadmin", true)
    .maybeSingle();
  if (!roleRow) redirect("/admin/login?error=not_superadmin");

  const { data: tenant } = await admin
    .from("tenants")
    .select(
      "id, slug, business_name, twilio_from_number, twilio_messaging_service_sid",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!tenant) notFound();
  const t = tenant as any;

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <div className="mb-6">
        <Link
          href={`/superadmin/tenants/${params.id}`}
          className="text-sm text-slate-500 hover:underline"
        >
          ← {t.business_name}
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-slate-800 mb-2">
        Twilio SMS number
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Every customer-facing SMS for this tenant (booking confirmation,
        3-day reminder, review request, COI delivery, gift-card receipt)
        sends from the number below. Buy 1 number per tenant in the
        platform's Twilio console, then paste it here in E.164 format.
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm text-blue-900 mb-6">
        <p className="font-bold mb-1">Shared Twilio account, dedicated number per tenant.</p>
        <p>
          Account SID + Auth Token live in platform env (one account, one
          A2P registration). Each tenant gets their own phone number on
          that account for branding + delivery isolation. Cost: ~$1.15/mo
          per number + per-message Twilio rate.
        </p>
      </div>

      <SmsConfigForm
        tenantId={params.id}
        businessName={t.business_name}
        initial={{
          twilio_from_number: t.twilio_from_number || "",
          twilio_messaging_service_sid: t.twilio_messaging_service_sid || "",
        }}
      />
    </div>
  );
}
