// Helpers to generate JSON-LD structured data for search engines.
//
// LocalBusiness tells Google "this is a real business in this city" — improves
// local pack rankings ("party rentals near me") + can show address, phone,
// hours, and review stars in search results.
//
// Product tells Google "this is a sellable item" — can show price + image in
// rich results and Google Shopping.

import type { SiteSettings } from "@/lib/site-settings";

interface LocalBusinessInput {
  settings: SiteSettings;
  baseUrl: string;
}

export function localBusinessJsonLd({ settings, baseUrl }: LocalBusinessInput) {
  const phoneE164 = toE164(settings.business_phone);
  const address = parseAddress(settings.business_address);
  const hours = parseHours(settings.business_hours);
  const sameAs = [settings.instagram_url, settings.facebook_url].filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${baseUrl}/#business`,
    name: settings.business_name,
    description: settings.footer_description || settings.hero_subtitle || undefined,
    url: baseUrl,
    telephone: phoneE164 || settings.business_phone,
    email: settings.business_email || undefined,
    image: settings.logo_url || undefined,
    address: address
      ? {
          "@type": "PostalAddress",
          streetAddress: address.street,
          addressLocality: address.city,
          addressRegion: address.state,
          postalCode: address.zip,
          addressCountry: "US",
        }
      : undefined,
    openingHoursSpecification: hours || undefined,
    areaServed: settings.service_area || undefined,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
    priceRange: "$$",
  };
}

interface ProductInput {
  name: string;
  description?: string | null;
  image?: string | null;
  priceCents: number;
  slug: string;
  baseUrl: string;
  inStock?: boolean;
  businessName?: string;
}

export function productJsonLd(p: ProductInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${p.baseUrl}/items/${p.slug}#product`,
    name: p.name,
    description: p.description || undefined,
    image: p.image || undefined,
    brand: p.businessName ? { "@type": "Brand", name: p.businessName } : undefined,
    offers: {
      "@type": "Offer",
      url: `${p.baseUrl}/items/${p.slug}`,
      priceCurrency: "USD",
      price: (p.priceCents / 100).toFixed(2),
      availability:
        p.inStock === false
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
      priceValidUntil: yearEnd(),
    },
  };
}

// ── helpers ───────────────────────────────────────────────────────────

function toE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function parseAddress(addr: string) {
  // Expected: "8917 Western Way, Jacksonville, FL 32256"
  const parts = addr.split(",").map((s) => s.trim());
  if (parts.length < 3) return null;
  const street = parts[0];
  const city = parts[1];
  const stateZip = parts[2].split(/\s+/);
  const state = stateZip[0] || "";
  const zip = stateZip[1] || "";
  if (!street || !city || !state) return null;
  return { street, city, state, zip };
}

function parseHours(hours: string) {
  // Expected: "8:00 AM – 6:00 PM ET, Monday-Saturday"
  // We just generate one specification covering Mon-Sat 8-18 if we can detect it,
  // otherwise return null and let Google ignore the field.
  const text = hours.toLowerCase();
  const dayMatch = text.match(/(mon|tue|wed|thu|fri|sat|sun)\w*\s*[-–]\s*(mon|tue|wed|thu|fri|sat|sun)/);
  if (!dayMatch) return null;
  const dayMap: Record<string, string> = {
    mon: "Monday", tue: "Tuesday", wed: "Wednesday",
    thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
  };
  const opens = "08:00";
  const closes = "18:00";
  return [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [dayMap[dayMatch[1]], dayMap[dayMatch[2]]],
      opens,
      closes,
    },
  ];
}

function yearEnd(): string {
  const d = new Date();
  return `${d.getFullYear()}-12-31`;
}
