import { Header } from "@/components/public/Header";
import { Footer } from "@/components/public/Footer";
import { CartProvider } from "@/lib/cart/context";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </CartProvider>
  );
}
