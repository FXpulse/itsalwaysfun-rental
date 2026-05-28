import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteSettings } from "@/lib/site-settings";
import { formatCurrency } from "@/lib/utils";
import { Calendar, Sparkles, ArrowRight } from "lucide-react";
import { HomeBanners } from "@/components/public/HomeBanners";
import { ReviewsCarousel } from "@/components/public/ReviewsCarousel";
import type { Product } from "@/types/database";

export const revalidate = 60;

export default async function HomePage() {
  const supabase = createAdminClient();

  const [productsResult, categoriesResult, settings, bannersResult, reviewsResult, reviewSettingsResult] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, slug, category, price_per_day, image_url, description")
      .eq("is_active", true)
      .eq("is_addon", false)
      .order("category")
      .order("name"),
    supabase
      .from("categories")
      .select("name, slug, description, image_url, is_active")
      .order("display_order"),
    getSiteSettings(),
    supabase
      .from("home_banners")
      .select("id, image_url, alt_text, link_url")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("customer_reviews")
      .select("id, customer_name, customer_location, review_text, rating, photo_url, source, reviewed_at")
      .eq("is_active", true)
      .eq("is_featured", true)
      .order("sort_order")
      .order("reviewed_at", { ascending: false, nullsFirst: false })
      .limit(12),
    supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["google_review_url", "reviews_carousel_enabled", "reviews_section_title"]),
  ]);

  const banners = bannersResult.data || [];
  const featuredReviews = reviewsResult.data || [];
  const reviewSettingsMap = new Map(
    (reviewSettingsResult.data as any[] || []).map((r) => [r.key, r.value]),
  );
  const reviewsEnabled = (reviewSettingsMap.get("reviews_carousel_enabled") || "true").toLowerCase() !== "false";
  const googleReviewUrl = reviewSettingsMap.get("google_review_url") || "";
  const reviewsTitle = reviewSettingsMap.get("reviews_section_title") || "What Our Customers Are Saying";

  const list = (productsResult.data as Product[]) || [];
  const allCategories = categoriesResult.data || [];

  // Count active products per category
  const productCountByCategory: Record<string, number> = {};
  for (const p of list) {
    productCountByCategory[p.category] = (productCountByCategory[p.category] || 0) + 1;
  }

  // Build category cards: 1st card always "Order by Date", then DB categories
  const orderByDateCard = {
    title: "Order by Date",
    href: "/order-by-date",
    image: null as string | null,
    desc: "Pick your date — see what's available.",
    comingSoon: false,
    isOrderByDate: true,
  };

  const dbCategoryCards = allCategories
    .filter((c) => c.is_active)
    .map((c) => ({
      title: c.name,
      href: `/category/${c.slug}`,
      image: c.image_url,
      desc: c.description || "",
      comingSoon: (productCountByCategory[c.name] || 0) === 0,
      isOrderByDate: false,
    }));

  const categoryCards = [orderByDateCard, ...dbCategoryCards];

  // Build per-zone style objects (only set what's customized, leave else default)
  const heroStyle: React.CSSProperties = {
    ...(settings.hero_bg_color && {
      background: settings.hero_bg_color,
      backgroundImage: "none",
    }),
    ...(settings.hero_text_color && { color: settings.hero_text_color }),
    ...(settings.hero_font_family && { fontFamily: settings.hero_font_family }),
  };
  const categoriesStyle: React.CSSProperties = {
    ...(settings.categories_bg_color && { background: settings.categories_bg_color }),
    ...(settings.categories_text_color && { color: settings.categories_text_color }),
    ...(settings.categories_font_family && {
      fontFamily: settings.categories_font_family,
    }),
  };
  const featuredStyle: React.CSSProperties = {
    ...(settings.featured_bg_color && { background: settings.featured_bg_color }),
    ...(settings.featured_text_color && { color: settings.featured_text_color }),
    ...(settings.featured_font_family && { fontFamily: settings.featured_font_family }),
  };
  const trustStyle: React.CSSProperties = {
    ...(settings.trust_bg_color && { background: settings.trust_bg_color }),
    ...(settings.trust_text_color && { color: settings.trust_text_color }),
    ...(settings.trust_font_family && { fontFamily: settings.trust_font_family }),
  };

  return (
    <div>
      {/* Banner carousel (above hero, only if banners exist) */}
      {banners.length > 0 && <HomeBanners banners={banners} />}

      {/* Hero */}
      <section
        className="bg-gradient-to-br from-brand-navy to-brand-navy-dark text-white"
        style={heroStyle}
      >
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
      <section style={categoriesStyle}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-3xl font-bold text-brand-navy text-center mb-8">
          {settings.section_categories_title}
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {categoryCards.map((c) => (
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
                ) : c.isOrderByDate ? (
                  <div className="flex items-center justify-center h-full">
                    <Calendar className="h-16 w-16 text-brand-navy" />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-300 text-sm">
                    No image
                  </div>
                )}
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
        </div>
      </section>

      {/* Featured products */}
      <section className="bg-slate-50 py-12" style={featuredStyle}>
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

      {/* Trust strip (now ABOVE reviews so the page closes on social proof) */}
      <section className="bg-brand-yellow text-brand-navy py-8" style={trustStyle}>
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

      {/* Customer reviews carousel (last block before footer — closes with social proof) */}
      {reviewsEnabled && featuredReviews.length > 0 && (
        <ReviewsCarousel
          reviews={featuredReviews as any}
          title={reviewsTitle}
          googleReviewUrl={googleReviewUrl}
        />
      )}
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
