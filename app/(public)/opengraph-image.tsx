// Dynamic OG image — generated per-tenant using their business_name,
// hero_title, and brand colors. Replaces the static /og-default.png
// fallback so social shares show a branded card per tenant.
//
// Returns a 1200x630 PNG (the standard OG dimensions for FB, X, LinkedIn,
// WhatsApp, iMessage). Next.js caches by host so each tenant's image is
// generated once and reused.

import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import { resolveTenantByHostname } from "@/lib/tenant/resolve";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "edge";
export const alt = "Get the app";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  // Resolve the tenant from the host header
  const host = headers().get("host") || "";
  let businessName = "Rental Management";
  let tagline = "Book online — bouncers, slides, party rentals";
  let primaryColor = "#1a1a6e";
  let logoUrl: string | null = null;

  try {
    const tenant = await resolveTenantByHostname(host);
    if (tenant && (tenant as any).id) {
      businessName = (tenant as any).business_name || businessName;
      const branding = ((tenant as any).branding || {}) as Record<string, any>;
      if (branding.logo_url) logoUrl = String(branding.logo_url);
      if (branding.primary_color) primaryColor = String(branding.primary_color);

      // Pull tagline + logo + service area from site_settings for richer card
      try {
        const supabase = createAdminClient({ unscoped: true });
        const { data: rows } = await supabase
          .from("site_settings")
          .select("key, value")
          .eq("tenant_id", (tenant as any).id)
          .in("key", ["hero_tagline", "hero_subtitle", "logo_url", "service_area"]);
        const map = new Map<string, string>(
          ((rows as any[]) || []).map((r) => [r.key, r.value]),
        );
        if (map.get("hero_tagline")) tagline = String(map.get("hero_tagline"));
        else if (map.get("hero_subtitle")) tagline = String(map.get("hero_subtitle"));
        if (!logoUrl && map.get("logo_url")) logoUrl = String(map.get("logo_url"));
      } catch {}
    }
  } catch {
    // Fallback — use defaults
  }

  // Truncate tagline (OG cards have limited space)
  const trimmedTagline = tagline.length > 120 ? `${tagline.slice(0, 117)}...` : tagline;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: `linear-gradient(135deg, ${primaryColor} 0%, #1a1a2e 100%)`,
          padding: "60px",
        }}
      >
        {logoUrl ? (
          // Logo at top
          <img
            src={logoUrl}
            alt={businessName}
            style={{
              maxWidth: "300px",
              maxHeight: "120px",
              objectFit: "contain",
              marginBottom: "40px",
            }}
          />
        ) : (
          // Initials block if no logo
          <div
            style={{
              width: "120px",
              height: "120px",
              borderRadius: "24px",
              background: "#fbbf24",
              color: primaryColor,
              fontSize: "56px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "40px",
            }}
          >
            {businessName.split(" ").map((w) => w[0]).join("").slice(0, 3)}
          </div>
        )}

        {/* Business name */}
        <div
          style={{
            fontSize: "72px",
            fontWeight: 800,
            color: "white",
            textAlign: "center",
            lineHeight: 1.1,
            marginBottom: "24px",
            letterSpacing: "-0.02em",
          }}
        >
          {businessName}
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: "32px",
            color: "rgba(255,255,255,0.85)",
            textAlign: "center",
            lineHeight: 1.35,
            maxWidth: "900px",
          }}
        >
          {trimmedTagline}
        </div>

        {/* Bottom call-to-action strip */}
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            left: "60px",
            right: "60px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "rgba(255,255,255,0.65)",
            fontSize: "20px",
          }}
        >
          <span>Book online · Free quote · Same-day response</span>
          <span style={{ color: "#fbbf24", fontWeight: 600 }}>{host}</span>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
