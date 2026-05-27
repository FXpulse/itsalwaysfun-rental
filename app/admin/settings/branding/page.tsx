import { redirect } from "next/navigation";
import { Palette } from "lucide-react";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant/db";
import { BrandingEditor } from "./BrandingEditor";

export const dynamic = "force-dynamic";

export default async function BrandingPage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/dashboard");

  const tenantId = getCurrentTenantId();
  const supabase = createAdminClient({ unscoped: true });
  const { data: tenant } = await supabase
    .from("tenants")
    .select("business_name, branding, slug, custom_domain")
    .eq("id", tenantId)
    .single();

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1 flex items-center gap-2">
        <Palette className="h-6 w-6" /> Branding
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Your business name, logo, and colors show on your public booking site,
        emails, and admin panel. Changes apply immediately.
      </p>

      <BrandingEditor
        initial={{
          business_name: tenant?.business_name || "",
          logo_url: (tenant?.branding as any)?.logo_url || "",
          primary_color: (tenant?.branding as any)?.primary_color || "#1a1a6e",
          accent_color: (tenant?.branding as any)?.accent_color || "#FFD700",
          font_family: (tenant?.branding as any)?.font_family || "Quicksand",
        }}
      />

      <div className="mt-6 card bg-slate-50 text-xs text-slate-600">
        <strong>Your public site:</strong>{" "}
        <code>
          {tenant?.custom_domain
            ? `https://${tenant.custom_domain}`
            : `https://${tenant?.slug}.getrentalflow.com`}
        </code>
        <br />
        Visit this URL in incognito to preview without your admin session.
      </div>
    </div>
  );
}
