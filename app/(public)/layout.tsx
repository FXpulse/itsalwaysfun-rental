import { Suspense } from "react";
import Script from "next/script";
import { Header } from "@/components/public/Header";
import { Footer } from "@/components/public/Footer";
import { ReferralTracker } from "@/components/public/ReferralTracker";
import { CartProvider } from "@/lib/cart/context";
import { getSiteSettings } from "@/lib/site-settings";

export const revalidate = 60;

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSiteSettings();

  return (
    <CartProvider>
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
