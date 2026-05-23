import { Header } from "@/components/public/Header";
import { Footer } from "@/components/public/Footer";
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
        />
      </div>
    </CartProvider>
  );
}
