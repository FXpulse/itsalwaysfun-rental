import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteSettings } from "@/lib/site-settings";
import { formatCurrency } from "@/lib/utils";
import { Calendar, Sparkles, ArrowRight } from "lucide-react";
import type { Product } from "@/types/database";

export const revalidate = 60;

const CATEGORY_CARDS = [
  {
    title: "Order by Date",
    href: "/order-by-date",
    image: null,
    icon: Calendar,
    desc: "Pick your date — see what's available.",
    color: "from-brand-yellow to-yellow-300",
  },
  {
    title: "Bounce Houses",
    href: "/category/bounce-houses",
    image: "https://files.sysers.com/cp/upload/itsalwaysfun/categories/med/allsportsarena.png",
    desc: "Themed bounce houses for every party.",
  },
  {
    title: "Bounce & Slide Combos",
    href: "/category/combos",
    image: "https://files.sysers.com/cp/upload/itsalwaysfun/categories/med/4_Bounce_Slides_Combos.jpg",
    desc: "Coming soon.",
    comingSoon: true,
  },
  {
    title: "Dry Slides",
    href: "/category/dry-slides",
    image: "https://files.sysers.com/cp/upload/itsalwaysfun/categories/med/dry-slides.png",
    desc: "Big slides for big thrills.",
  },
];

export default async function HomePage() {
  const [supabaseResult, settings] = await Promise.all([
    createAdminClient()
      .from("products")
      .select("id, name, slug, category, price_per_day, image_url, description")
      .eq("is_active", true)
      .order("category")
      .order("name"),
    getSiteSettings(),
  ]);

  const list = (supabaseResult.data as Product[]) || [];

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-navy to-brand-navy-dark text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <Sparkles className="h-12 w-12 text-brand-yellow mx-auto mb-4" />
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4">
            {settings.hero_title}
          </h1>
          <p className="text-lg sm:text-xl text-white/90 max-w-2xl mx-auto mb-6">
            {settings.hero_subtitle}
          </p>
          <p className="text-brand-yellow text-xl sm:text-2xl font-semibold italic mb-8">
            "{settings.hero_tagline}"
          </p>
          <Link
            href="/order-by-date"
            className="inline-flex items-center gap-2 bg-brand-yellow text-brand-navy font-bold px-8 py-4 rounded-md hover:bg-yellow-300 transition text-lg shadow-lg"
          >
            {settings.hero_cta_label}
          </Link>
        </div>
      </section>

      {/* Categories grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-3xl font-bold text-brand-navy text-center mb-8">
          {settings.section_categories_title}
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {CATEGORY_CARDS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className={`group relative rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all ${
                c.comingSoon ? "opacity-70" : ""
              }`}
            >
              <div className="aspect-square relative bg-gradient-to-br from-brand-yellow/10 to-brand-navy/10">
                {c.image ? (
                  <Image
                    src={c.image}
                    alt={c.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    unoptimized
                  />
                ) : c.icon ? (
                  <div className="flex items-center justify-center h-full">
                    <c.icon className="h-16 w-16 text-brand-navy" />
                  </div>
                ) : null}
                {c.comingSoon && (
                  <div className="absolute top-2 right-2 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                    Coming Soon
                  </div>
                )}
              </div>
              <div className="bg-white p-3 sm:p-4">
                <h3 className="font-bold text-brand-navy text-sm sm:text-base mb-1">
                  {c.title}
                </h3>
                <p className="text-xs text-slate-600 hidden sm:block">{c.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="bg-slate-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-brand-navy">
                {settings.section_featured_title}
              </h2>
              <p className="text-slate-600">
                {list.length} bounce houses + slides ready for your event
              </p>
            </div>
            <Link
              href="/rentals"
              className="hidden sm:inline-flex items-center gap-1 text-brand-navy font-semibold hover:text-brand-yellow-dark"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {list.slice(0, 8).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>

          <div className="text-center mt-8">
            <Link
              href="/rentals"
              className="inline-flex items-center gap-2 bg-brand-navy text-white font-semibold px-6 py-3 rounded-md hover:bg-brand-navy-dark transition"
            >
              View all {list.length} rentals →
            </Link>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="bg-brand-yellow text-brand-navy py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          {[settings.trust_delivery, settings.trust_cleaned, settings.trust_rating].map((line, i) => {
            const [bold, ...rest] = line.split("—");
            return (
              <div key={i}>
                <div className="text-2xl font-bold">{bold.trim()}</div>
                <div className="text-sm">{rest.join("—").trim()}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/items/${product.slug}`}
      className="group bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all border border-slate-200"
    >
      <div className="aspect-square relative bg-slate-50">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-contain group-hover:scale-105 transition-transform duration-500"
            unoptimized
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-300">
            No image
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-bold text-brand-navy text-sm sm:text-base mb-1 line-clamp-1">
          {product.name}
        </h3>
        <div className="flex items-baseline gap-1">
          <span className="text-brand-navy font-bold">
            {formatCurrency(product.price_per_day)}
          </span>
          <span className="text-xs text-slate-500">/ day</span>
        </div>
      </div>
    </Link>
  );
}
