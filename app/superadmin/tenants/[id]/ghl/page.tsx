// Per-tenant GoHighLevel sub-account config.
// Lives at /superadmin/tenants/[id]/ghl — operator (Ludmila) provisions
// the sub-account in HighLevel, copies Location ID + workflow webhook
// URLs, pastes here. From then on, that tenant's bookings/contacts/quotes
// push to their own GHL Location (not IAF's).
//
// GHL is for marketing/social media sync. Email + SMS do NOT go through
// GHL — those use Resend (email) + Twilio (SMS) directly.

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GhlConfigForm } from "./GhlConfigForm";

export const dynamic = "force-dynamic";

export default async function TenantGhlConfigPage({
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
      "id, slug, business_name, ghl_location_id, ghl_booking_webhook_url, ghl_abandoned_cart_webhook_url, ghl_referral_webhook_url, ghl_quote_webhook_url",
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
        GoHighLevel sub-account config
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Each tenant gets their own sub-account (Location) under the master
        agency. Provision it in HighLevel, copy the Location ID + workflow
        webhook URLs, paste them here. The tenant's bookings, contacts,
        quotes, abandoned carts, and referral commissions push to this
        Location from then on.
      </p>

      <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-900 mb-6">
        <p className="font-bold mb-1">GHL is marketing-only.</p>
        <p>
          Email + SMS do NOT go through GHL — those use the platform's
          own Resend account + Twilio. GHL is for social ads, Facebook
          lookalike audiences, and CRM workflows (notes, tags, contact
          enrichment).
        </p>
      </div>

      <GhlConfigForm
        tenantId={params.id}
        businessName={t.business_name}
        initial={{
          ghl_location_id: t.ghl_location_id || "",
          ghl_booking_webhook_url: t.ghl_booking_webhook_url || "",
          ghl_abandoned_cart_webhook_url:
            t.ghl_abandoned_cart_webhook_url || "",
          ghl_referral_webhook_url: t.ghl_referral_webhook_url || "",
          ghl_quote_webhook_url: t.ghl_quote_webhook_url || "",
        }}
      />
    </div>
  );
}
