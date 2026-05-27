import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantBusinessName } from "@/lib/tenant/business";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const name = await getTenantBusinessName();
  return {
    title: `Rental Agreement & Liability Waiver — ${name}`,
    description: `Full text of the rental agreement and liability waiver customers sign at checkout for ${name}.`,
  };
}

export default async function PublicWaiverPage() {
  const supabase = createAdminClient();
  const { data: rows } = await supabase
    .from("site_settings")
    .select("key, value")
    .in("key", ["waiver_title", "waiver_text"]);
  const map = new Map((rows as any[] || []).map((r) => [r.key, r.value]));
  const title = map.get("waiver_title") || "Rental Agreement & Liability Waiver";
  const text = map.get("waiver_text") || "Waiver not configured yet.";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold text-brand-navy mb-2">{title}</h1>
      <p className="text-sm text-slate-500 mb-6">
        This is the agreement every renter signs electronically at checkout.
        You can save or print this page for your records.
      </p>
      <div className="card text-sm text-slate-700 whitespace-pre-line font-sans leading-relaxed">
        {text}
      </div>
      <p className="text-xs text-slate-400 mt-6 text-center">
        Questions? Call us before booking and we'll walk you through it.
      </p>
    </div>
  );
}
