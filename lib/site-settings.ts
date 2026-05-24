// Site settings reader — single fetch per render.
// Components import getSiteSettings() in Server Components.

import { createAdminClient } from "@/lib/supabase/admin";

export interface SiteSettings {
  business_name: string;
  business_phone: string;
  business_email: string;
  business_address: string;
  business_hours: string;
  service_area: string;
  instagram_url: string;
  facebook_url: string;
  logo_url: string;
  hero_title: string;
  hero_subtitle: string;
  hero_tagline: string;
  hero_cta_label: string;
  section_categories_title: string;
  section_featured_title: string;
  trust_delivery: string;
  trust_cleaned: string;
  trust_rating: string;
  footer_description: string;
  booking_terms_note: string;
  // Appearance (per-zone styling — empty = use defaults)
  hero_bg_color: string;
  hero_text_color: string;
  hero_font_family: string;
  categories_bg_color: string;
  categories_text_color: string;
  categories_font_family: string;
  featured_bg_color: string;
  featured_text_color: string;
  featured_font_family: string;
  trust_bg_color: string;
  trust_text_color: string;
  trust_font_family: string;
  footer_bg_color: string;
  footer_text_color: string;
  footer_font_family: string;
}

// Sensible defaults (used if DB query fails or key missing)
const DEFAULTS: SiteSettings = {
  business_name: "It's Always Fun, LLC",
  business_phone: "(904) 584-3047",
  business_email: "admin@itsalwaysfun.com",
  business_address: "8917 Western Way, Jacksonville, FL 32256",
  business_hours: "8:00 AM – 6:00 PM ET, Monday-Saturday",
  service_area: "Jacksonville, FL and surrounding areas within 30 miles",
  instagram_url: "https://instagram.com/itsalwaysfunparty",
  facebook_url: "https://facebook.com/itsalwaysfunparty",
  logo_url:
    "https://files.sysers.com/cp/upload/itsalwaysfun/editor/med/its_always_fun_logo.png",
  hero_title: "Welcome to It's Always Fun",
  hero_subtitle:
    "We don't just rent bounce houses — we create unforgettable memories filled with energy, laughter, and joy.",
  hero_tagline:
    "Because when it comes to your special day, fun isn't optional, it's guaranteed!",
  hero_cta_label: "Check availability →",
  section_categories_title: "Bounce Higher. Laugh Louder. Celebrate Bigger.",
  section_featured_title: "Our Rentals",
  trust_delivery: "Free Delivery — Within Jacksonville metro area",
  trust_cleaned: "Cleaned & Sanitized — Every unit, every rental, every time",
  trust_rating: "5-Star Rated — Hundreds of happy families",
  footer_description:
    "We don't just rent bounce houses — we create unforgettable memories filled with energy, laughter, and joy. Serving Jacksonville and surrounding areas.",
  booking_terms_note: "Reschedule up to 7 days before with no fee.",
  // Appearance defaults (empty → tailwind classes take over)
  hero_bg_color: "",
  hero_text_color: "",
  hero_font_family: "",
  categories_bg_color: "",
  categories_text_color: "",
  categories_font_family: "",
  featured_bg_color: "",
  featured_text_color: "",
  featured_font_family: "",
  trust_bg_color: "",
  trust_text_color: "",
  trust_font_family: "",
  footer_bg_color: "",
  footer_text_color: "",
  footer_font_family: "",
};

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select("key, value");
    if (error) throw error;

    const overrides: Partial<SiteSettings> = {};
    for (const row of data || []) {
      if (row.value !== null && row.value !== "") {
        (overrides as any)[row.key] = row.value;
      }
    }
    return { ...DEFAULTS, ...overrides };
  } catch {
    return DEFAULTS;
  }
}
