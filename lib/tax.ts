// Sales tax / IVA / VAT calculation helpers — shared between public
// booking flow, quote approval, and admin display.

export interface TaxConfig {
  enabled: boolean;
  /** e.g. 7.5 means 7.5% */
  ratePercent: number;
  /** Label shown to customers ("Sales tax", "IVA", "VAT") */
  label: string;
}

export function readTaxConfig(
  settingsMap: Map<string, string> | Record<string, string>,
): TaxConfig {
  const get = (k: string): string => {
    if (settingsMap instanceof Map) return settingsMap.get(k) ?? "";
    return (settingsMap as Record<string, string>)[k] ?? "";
  };
  const enabled = (get("tax_enabled") || "false").toLowerCase() === "true";
  const ratePercent = Number.parseFloat(get("tax_rate_percent") || "0") || 0;
  const label = get("tax_label") || "Sales tax";
  return { enabled, ratePercent, label };
}

/** Apply tax to a subtotal (cents) using a percent. Rounds half-up to
 *  the nearest cent — matches what Stripe + tax-reporting tools expect. */
export function calculateTaxCents(subtotalCents: number, ratePercent: number): number {
  if (!subtotalCents || subtotalCents <= 0) return 0;
  if (!ratePercent || ratePercent <= 0) return 0;
  return Math.round((subtotalCents * ratePercent) / 100);
}
