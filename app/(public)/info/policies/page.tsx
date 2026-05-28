import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const settings = await getSiteSettings();

  // Pull the important_tips text live from site_settings (the tenant's
  // current edition — getSiteSettings already merges defaults).
  const supabase = createAdminClient();
  const { data: tipsRow } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "important_tips")
    .maybeSingle();
  const tipsText = String(tipsRow?.value || "").trim();

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <Link
          href="/info"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-navy mb-6"
        >
          <ArrowLeft className="h-3 w-3" /> Back to info
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl font-bold text-brand-navy mb-2">
            Important tips & policies
          </h1>
          <p className="text-sm text-slate-600">
            Please read before booking. These cover payment, setup, weather, and
            safety policies so your event runs smoothly.
          </p>
        </header>

        <article className="card bg-white p-6">
          {tipsText ? (
            <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {tipsText}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              No policies configured. The owner can edit this at{" "}
              <code>/admin/site</code>.
            </p>
          )}
        </article>

        <div className="mt-8 text-center text-xs text-slate-500">
          Questions? Call{" "}
          {settings.business_phone ? (
            <a
              href={`tel:${settings.business_phone.replace(/\D/g, "")}`}
              className="font-semibold text-brand-navy"
            >
              {settings.business_phone}
            </a>
          ) : (
            "us"
          )}
          {settings.business_email && (
            <>
              {" "}
              or email{" "}
              <a
                href={`mailto:${settings.business_email}`}
                className="font-semibold text-brand-navy"
              >
                {settings.business_email}
              </a>
            </>
          )}
          .
        </div>
      </div>
    </div>
  );
}
