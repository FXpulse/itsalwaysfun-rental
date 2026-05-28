// Build the default "Message to customer" body for new quotes.
// Uses site_settings so each tenant gets THEIR branding (no IAF hardcoding).
// Admin can still edit freely after the form pre-fills.

import type { SiteSettings } from "@/lib/site-settings";

/** Extract @handle from a full Instagram URL. Returns "" if not parseable. */
function instagramHandle(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    if (!u.hostname.includes("instagram.com")) return "";
    const slug = u.pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
    return slug ? `@${slug}` : "";
  } catch {
    return "";
  }
}

/** Strip "https://" / "www." for a cleaner display in the signature. */
function cleanDomainForDisplay(rawUrl: string): string {
  if (!rawUrl) return "";
  return rawUrl.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}

/** Pre-fill body for the "Message to customer" textarea in a new quote.
 *  All branding (name, tagline, service area, social, website) comes from
 *  site_settings + tenant public URL. Admins can edit freely after fill. */
export function buildDefaultQuoteMessage(
  settings: SiteSettings,
  publicUrl: string,
): string {
  const business = settings.business_name || "our team";
  const tagline = settings.footer_description?.trim() || "";
  const area = settings.service_area?.trim() || "";
  const handle = instagramHandle(settings.instagram_url);
  const website = cleanDomainForDisplay(publicUrl);

  const lines: string[] = [
    `Thank you for choosing ${business} for your upcoming celebration!`,
    "",
    "Please note that dates fill up quickly, so we recommend securing your booking soon.",
    "If everything looks good or if you need to make any adjustments, just let us know.",
    "Looking forward to celebrating with you!",
    "",
    `${business} Team`,
  ];
  if (tagline) lines.push(tagline);
  if (area) lines.push(area);
  if (handle) lines.push(handle);
  if (website) lines.push(website);

  return lines.join("\n");
}
