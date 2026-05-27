import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenant } from "@/lib/tenant/server";

// Tenant-aware metadata: each tenant host (custom domain or *.getrentalflow.com)
// sees THEIR business name as the tab title, and THEIR uploaded logo as the
// favicon when available. Only the marketing/SaaS apex shows "RentalFlow".
//
// We branch on the middleware-set x-tenant-via header (NOT a DB query), so
// a transient DB failure can never make a tenant host fall back to the
// RentalFlow marketing branding by accident.
export async function generateMetadata(): Promise<Metadata> {
  const current = getCurrentTenant();
  const isMarketing = current.isMarketing || current.resolved_via === "marketing";

  if (isMarketing) {
    return {
      title: "RentalFlow — Rental management for party + event rentals",
      description:
        "All-in-one rental management software for bounce house, party, and event rental companies. $99/mo flat, every feature included.",
      manifest: "/manifest.json",
      appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "RentalFlow",
      },
      icons: {
        icon: [
          { url: "/favicon_32.png", sizes: "32x32", type: "image/png" },
          { url: "/05_rentalflow_appicon_navy.png", sizes: "192x192", type: "image/png" },
        ],
        apple: "/favicon_180_apple_touch.png",
        shortcut: "/favicon_32.png",
      },
    };
  }

  // Tenant host (custom domain or subdomain) — resolve their brand. If the
  // DB lookup fails we still want to AVOID emitting RentalFlow icons. Worst
  // case: tab title is "Rental Management" and favicon is the browser default.
  const tenant = await getTenantBranding();
  const branding = (tenant?.branding as Record<string, any>) || {};
  const name = tenant?.business_name || "Rental Management";
  const logoUrl =
    (branding.logo_url as string | undefined) ||
    (await getTenantSiteLogo());

  // Fall back to an auto-generated initial-on-brand-color SVG favicon so
  // tenants that haven't uploaded a logo yet still have a recognizable
  // tab icon — instead of the browser's blank default or a stale cached
  // RentalFlow asset.
  const primaryColor = (branding.primary_color as string | undefined) || "#1a1a6e";
  const iconUrl = logoUrl || generateInitialFaviconDataUri(name, primaryColor);

  return {
    title: name,
    description: `${name} — book online, manage rentals.`,
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: name,
    },
    icons: { icon: [{ url: iconUrl }], shortcut: iconUrl, apple: iconUrl },
  };
}

function generateInitialFaviconDataUri(businessName: string, color: string): string {
  const initial = (businessName.trim().charAt(0) || "R").toUpperCase();
  // SVG favicon — browsers render this directly. Solid rounded square with
  // the business initial in white. Single quotes inside attrs so we can
  // double-quote the whole string safely after URL-encoding.
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>` +
    `<rect width='64' height='64' rx='12' fill='${color}'/>` +
    `<text x='32' y='44' font-family='Arial,sans-serif' font-size='38' ` +
    `font-weight='700' fill='white' text-anchor='middle'>${escapeXml(initial)}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function getTenantSiteLogo(): Promise<string | undefined> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "logo_url")
      .maybeSingle();
    const v = (data?.value as string | undefined)?.trim();
    return v && v.length > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}

export const viewport: Viewport = {
  themeColor: "#1a1a6e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Read tenant branding to inject CSS variables — falls back to defaults
// outside request context (build time, scripts).
async function getTenantBranding() {
  try {
    const tenantId = getCurrentTenant().id;
    if (tenantId === "__marketing__") return null;
    const supabase = createAdminClient({ unscoped: true });
    const { data } = await supabase
      .from("tenants")
      .select("business_name, branding")
      .eq("id", tenantId)
      .maybeSingle();
    return data;
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await getTenantBranding();
  const branding = (tenant?.branding as Record<string, any>) || {};
  const primaryColor = branding.primary_color || "#1a1a6e";
  const accentColor = branding.accent_color || "#FFD700";

  // Inject as CSS custom properties so the rest of the site picks them up
  // without a full design system rewrite. Tailwind brand-navy / brand-yellow
  // classes still work; this overrides via inline style on <body>.
  const cssVars: React.CSSProperties = {
    // @ts-expect-error custom CSS vars
    "--brand-primary": primaryColor,
    "--brand-accent": accentColor,
  };

  return (
    <html lang="en">
      <body style={cssVars}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
