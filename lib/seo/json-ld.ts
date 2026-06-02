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
  averageRating?: number;
  ratingCount?: number;
}

export function localBusinessJsonLd({
  settings,
  baseUrl,
  averageRating,
  ratingCount,
}: LocalBusinessInput) {
  const phoneE164 = toE164(settings.business_phone);
  const address = parseAddress(settings.business_address);
  const hours = parseHours(settings.business_hours);
  const sameAs = [
    settings.instagram_url,
    settings.facebook_url,
    settings.google_business_profile_url,
  ].filter(Boolean);

  // Service area: support comma-separated cities for areaServed array
  const serviceAreaRaw = settings.service_area || "";
  const cities = serviceAreaRaw
    .split(/[,;]/)
    .map((c) => c.trim())
    .filter((c) => c && c.length > 1);
  const areaServed = cities.length > 1
    ? cities.map((c) => ({ "@type": "City", name: c }))
    : serviceAreaRaw || undefined;

  // Geo coordinates (lift "near me" searches if admin has set lat/lon)
  const lat = settings.geo_latitude;
  const lon = settings.geo_longitude;
  const geo = lat && lon ? {
    "@type": "GeoCoordinates",
    latitude: parseFloat(lat),
    longitude: parseFloat(lon),
  } : undefined;

  const result: any = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "Store"],
    "@id": `${baseUrl}/#business`,
    name: settings.business_name,
    description: settings.footer_description || settings.hero_subtitle || undefined,
    url: baseUrl,
    telephone: phoneE164 || settings.business_phone,
    email: settings.business_email || undefined,
    image: settings.logo_url ? absoluteUrl(settings.logo_url, baseUrl) : undefined,
    logo: settings.logo_url ? absoluteUrl(settings.logo_url, baseUrl) : undefined,
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
    geo,
    openingHoursSpecification: hours || undefined,
    areaServed,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
    priceRange: settings.price_range || "$$",
  };

  // Aggregate rating from real reviews — biggest SERP impact (stars in result)
  if (averageRating && ratingCount && ratingCount > 0) {
    result.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: averageRating.toFixed(1),
      reviewCount: ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return result;
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
  averageRating?: number;
  ratingCount?: number;
}

export function productJsonLd(p: ProductInput) {
  const result: any = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${p.baseUrl}/items/${p.slug}#product`,
    name: p.name,
    description: p.description || undefined,
    image: p.image ? absoluteUrl(p.image, p.baseUrl) : undefined,
    sku: p.slug,
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
      itemCondition: "https://schema.org/NewCondition",
      priceValidUntil: yearEnd(),
      seller: p.businessName
        ? { "@type": "Organization", name: p.businessName }
        : undefined,
    },
  };

  // Aggregate rating from business reviews → shows stars in Google Shopping
  if (p.averageRating && p.ratingCount && p.ratingCount > 0) {
    result.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: p.averageRating.toFixed(1),
      reviewCount: p.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return result;
}

interface FAQItem {
  question: string;
  answer: string;
}

/** FAQPage schema — shows FAQs as expandable cards directly in Google search.
 *  Big CTR boost — typically 30-60% more clicks for queries that match a FAQ. */
export function faqPageJsonLd(params: { faqs: FAQItem[]; baseUrl: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${params.baseUrl}/info/faqs#faqpage`,
    mainEntity: params.faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  };
}

/** BreadcrumbList — shows breadcrumb trail in SERP instead of raw URL.
 *  Better UX signal + tells Google about page hierarchy. */
export function breadcrumbJsonLd(params: {
  items: Array<{ name: string; url: string }>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: params.items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

function absoluteUrl(input: string, baseUrl: string): string {
  if (/^https?:\/\//.test(input)) return input;
  if (input.startsWith("//")) return `https:${input}`;
  if (input.startsWith("/")) return `${baseUrl}${input}`;
  return `${baseUrl}/${input}`;
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
