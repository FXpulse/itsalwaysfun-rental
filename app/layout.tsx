import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant/server";

export const metadata: Metadata = {
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
    const tenantId = getCurrentTenantId();
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
