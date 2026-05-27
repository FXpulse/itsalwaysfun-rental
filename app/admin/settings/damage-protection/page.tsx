import { ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { DamageProtectionForm } from "./DamageProtectionForm";

export const dynamic = "force-dynamic";

export default async function DamageProtectionPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("site_settings")
    .select("key, value")
    .in("key", [
      "damage_protection_enabled",
      "damage_protection_price_cents",
      "damage_protection_coverage_cents",
    ]);

  const map = new Map<string, string>(
    (data || []).map((r: any) => [r.key as string, r.value as string]),
  );
  const enabled = (map.get("damage_protection_enabled") || "true") === "true";
  const priceDollars = (parseInt(map.get("damage_protection_price_cents") || "2500", 10) / 100);
  const coverageDollars = (parseInt(map.get("damage_protection_coverage_cents") || "50000", 10) / 100);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-1">
        <ShieldCheck className="h-6 w-6 text-brand-navy" />
        <h1 className="text-2xl font-bold text-brand-navy">Damage Protection</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Optional fee customers can add at checkout to cover accidental damage.
        If enabled, a checkbox appears in the booking wizard. If a damage is
        recorded later, you can mark it as "covered by protection" so the
        customer isn't charged.
      </p>

      <DamageProtectionForm
        initialEnabled={enabled}
        initialPriceDollars={priceDollars}
        initialCoverageDollars={coverageDollars}
      />

      <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600">
        <p className="font-medium mb-1">How it works</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Customer sees the option on the checkout step of <code>/order-by-date</code></li>
          <li>The fee is charged once per booking (not per day)</li>
          <li>If they opt in and damage is recorded, you can mark it covered on the booking detail page</li>
          <li>Turn it off here to hide the checkbox completely</li>
        </ul>
      </div>
    </div>
  );
}
