import { Suspense } from "react";
import Script from "next/script";
import { Header } from "@/components/public/Header";
import { Footer } from "@/components/public/Footer";
import { ReferralTracker } from "@/components/public/ReferralTracker";
import { CartProvider } from "@/lib/cart/context";
import { getSiteSettings } from "@/lib/site-settings";
import { isPackagesSectionEnabled } from "@/lib/sections";
import { isGiftCardSalesEnabled } from "@/lib/gift-cards";

export const revalidate = 60;

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, packagesOn, giftCardsOn] = await Promise.all([
    getSiteSettings(),
    isPackagesSectionEnabled(),
    isGiftCardSalesEnabled(),
  ]);

  // Build the font CSS — applied via global style tag so it cascades to every
  // public element while per-zone overrides still win.
  // Self-hosted font (uploaded via admin) takes precedence over Google Fonts.
  const fontFamily = (settings.site_font_family || "").trim();
  const googleUrl = (settings.site_font_google_url || "").trim();
  const selfHostedUrl = (settings.site_font_self_hosted_url || "").trim();
  // Whitelist hosts to avoid arbitrary CSS injection from a compromised setting
  const googleUrlSafe = /^https:\/\/fonts\.googleapis\.com\//.test(googleUrl) ? googleUrl : "";
  const selfHostedSafe = /^https:\/\/[a-z0-9.-]+\.supabase\.co\//i.test(selfHostedUrl)
    ? selfHostedUrl
    : "";
  const useSelfHosted = !!(selfHostedSafe && fontFamily);
  const fontFamilyJson = fontFamily ? JSON.stringify(fontFamily) : "";
  const fontFormat = (() => {
    const u = selfHostedSafe.toLowerCase();
    if (u.endsWith(".woff2")) return "woff2";
    if (u.endsWith(".woff")) return "woff";
    if (u.endsWith(".ttf")) return "truetype";
    if (u.endsWith(".otf")) return "opentype";
    return "woff2";
  })();

  return (
    <CartProvider>
      {!useSelfHosted && googleUrlSafe && (
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      )}
      {!useSelfHosted && googleUrlSafe && <link rel="stylesheet" href={googleUrlSafe} />}
      {fontFamily && (
        <style
          dangerouslySetInnerHTML={{
            __html: `${
              useSelfHosted
                ? `@font-face { font-family: ${fontFamilyJson}; src: url(${JSON.stringify(selfHostedSafe)}) format(${JSON.stringify(fontFormat)}); font-display: swap; }`
                : ""
            }:root { --site-font: ${fontFamilyJson}, system-ui, -apple-system, sans-serif; } body { font-family: var(--site-font); }`,
          }}
        />
      )}
      <Suspense fallback={null}>
        <ReferralTracker />
      </Suspense>
      <div className="min-h-screen flex flex-col">
        <Header
          logoUrl={settings.logo_url}
          businessName={settings.business_name}
          phone={settings.business_phone}
          instagramUrl={settings.instagram_url}
          facebookUrl={settings.facebook_url}
          showPackages={packagesOn}
          showGiftCards={giftCardsOn}
        />
        <main className="flex-1">{children}</main>
        <Footer
          businessName={settings.business_name}
          phone={settings.business_phone}
          email={settings.business_email}
          address={settings.business_address}
          description={settings.footer_description}
          instagramUrl={settings.instagram_url}
          facebookUrl={settings.facebook_url}
          bgColor={settings.footer_bg_color}
          textColor={settings.footer_text_color}
          fontFamily={settings.footer_font_family}
        />
      </div>

      {/* GHL Chat Widget — only on public pages, not admin */}
      <Script
        id="ghl-chat-widget"
        src="https://beta.leadconnectorhq.com/loader.js"
        data-resources-url="https://beta.leadconnectorhq.com/chat-widget/loader.js"
        data-widget-id="69eba45b52e615af8a4d80d6"
        strategy="afterInteractive"
      />
    </CartProvider>
  );
}
