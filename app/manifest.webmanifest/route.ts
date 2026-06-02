// Dynamic per-tenant PWA manifest. Each tenant gets a manifest with
// their business_name as the app name and their logo_url as the icon —
// so when a driver installs the PWA from itsalwaysfun.net they get
// "It's Always Fun" branding, and from bouncedreams.getrentalflow.com
// they get "Bounce Dreams" branding, all served by the same codebase.
//
// The static /manifest.json is the RentalFlow-branded fallback used by
// the marketing host. Tenant pages link to /manifest.webmanifest via
// the layout's metadata.manifest.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { resolveTenantByHostname } from "@/lib/tenant/resolve";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const host = headers().get("host") || "";

  let businessName = "RentalFlow";
  let logoUrl: string | null = null;
  let themeColor = "#1a1a6e";

  try {
    const tenant = await resolveTenantByHostname(host);
    if (tenant && (tenant as any).id) {
      businessName = (tenant as any).business_name || businessName;
      const branding = ((tenant as any).branding || {}) as Record<string, any>;
      if (branding.logo_url) logoUrl = String(branding.logo_url);
      if (branding.primary_color) themeColor = String(branding.primary_color);

      if (!logoUrl) {
        try {
          const supabase = createAdminClient({ unscoped: true });
          const { data: row } = await supabase
            .from("site_settings")
            .select("value")
            .eq("tenant_id", (tenant as any).id)
            .eq("key", "logo_url")
            .maybeSingle();
          if (row?.value) logoUrl = String(row.value);
        } catch {}
      }
    }
  } catch {
    // Outside tenant context or DB error — keep the RentalFlow defaults
  }

  // Use platform icons (192/512) if no tenant logo set
  const icons = logoUrl
    ? [
        // Tenant's own logo at the sizes browsers expect
        { src: logoUrl, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: logoUrl, sizes: "512x512", type: "image/png", purpose: "any" },
        { src: logoUrl, sizes: "192x192", type: "image/png", purpose: "maskable" },
        { src: logoUrl, sizes: "512x512", type: "image/png", purpose: "maskable" },
      ]
    : [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ];

  const manifest = {
    name: businessName,
    short_name: businessName.length > 12 ? businessName.split(" ")[0] : businessName,
    description: `${businessName} — book online, manage rentals.`,
    start_url: "/driver",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: themeColor,
    theme_color: themeColor,
    lang: "en-US",
    categories: ["business", "productivity"],
    icons,
    shortcuts: [
      {
        name: "Today's Routes",
        short_name: "Today",
        url: "/driver",
        description: "Today's driver routes",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
