import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteSettings } from "@/lib/site-settings";
import { formatCurrency } from "@/lib/utils";
import { productJsonLd } from "@/lib/seo/json-ld";
import { Calendar, Maximize2, Zap, Users, ArrowLeft, ChevronRight } from "lucide-react";
import type { Product } from "@/types/database";
import { BookNowButton } from "./BookNowButton";
import { ProductGallery, type GalleryPhoto } from "./ProductGallery";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const supabase = createAdminClient();
  const { data: product } = await supabase
    .from("products")
    .select("name, description, image_url, price_per_day")
    .eq("slug", params.slug)
    .eq("is_active", true)
    .single();

  if (!product) {
    return { title: "Rental not found", robots: { index: false, follow: false } };
  }

  const settings = await getSiteSettings();
  const h = headers();
  const host = h.get("host") || "itsalwaysfun.net";
  const proto = h.get("x-forwarded-proto") || "https";
  const baseUrl = `${proto}://${host}`;

  const title = `${product.name} Rental — ${settings.business_name}`;
  const description = product.description
    ? truncate(product.description, 155)
    : `Rent ${product.name} starting at ${formatCurrency(product.price_per_day)}/day. Delivery, setup, and takedown included. Book online today.`;
  const image = product.image_url || settings.logo_url || `${baseUrl}/og-default.png`;

  return {
    title,
    description,
    metadataBase: new URL(baseUrl),
    alternates: { canonical: `/items/${params.slug}` },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/items/${params.slug}`,
      siteName: settings.business_name,
      images: [{ url: image, width: 1200, height: 630, alt: product.name }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
    robots: { index: true, follow: true },
  };
}

function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

export default async function ItemDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = createAdminClient();

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("slug", params.slug)
    .eq("is_active", true)
    .eq("is_addon", false)
    .single();

  if (!product) notFound();
  const p = product as Product;

  // Fetch 3 related products + gallery photos in parallel
  const [{ data: related }, { data: galleryRows }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, slug, category, price_per_day, image_url")
      .eq("category", p.category)
      .eq("is_active", true)
      .eq("is_addon", false)
      .neq("id", p.id)
      .limit(3),
    supabase
      .from("product_images")
      .select("image_url, alt_text, sort_order")
      .eq("product_id", p.id)
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  // Build photo list: primary first, then gallery (dedupe to avoid showing primary twice)
  const photos: GalleryPhoto[] = [];
  if (p.image_url) {
    photos.push({ url: p.image_url, alt: p.name });
  }
  for (const row of (galleryRows as any[]) || []) {
    if (row.image_url && row.image_url !== p.image_url) {
      photos.push({ url: row.image_url, alt: row.alt_text || p.name });
    }
  }

  // Product JSON-LD — Google can render price + availability in search results
  const h = headers();
  const host = h.get("host") || "itsalwaysfun.net";
  const proto = h.get("x-forwarded-proto") || "https";
  const baseUrl = `${proto}://${host}`;
  const settings = await getSiteSettings();
  const jsonLd = productJsonLd({
    name: p.name,
    description: p.description,
    image: p.image_url,
    priceCents: p.price_per_day,
    slug: p.slug,
    baseUrl,
    businessName: settings.business_name,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Breadcrumb */}
      <nav className="text-sm text-slate-500 mb-4 flex items-center gap-1">
        <Link href="/" className="hover:text-brand-navy">
          Home
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/rentals" className="hover:text-brand-navy">
          Rentals
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link
          href={`/rentals?category=${encodeURIComponent(p.category)}`}
          className="hover:text-brand-navy"
        >
          {p.category}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-brand-navy font-medium truncate">{p.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mb-12">
        {/* Gallery (cover + extra photos with carousel + lightbox) */}
        <ProductGallery photos={photos} productName={p.name} />

        {/* Info */}
        <div>
          <span className="inline-block bg-brand-yellow text-brand-navy text-xs font-bold px-2 py-1 rounded uppercase tracking-wider mb-3">
            {p.category}
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-brand-navy mb-3">
            {p.name}
          </h1>

          <div className="flex items-baseline gap-2 mb-6">
            <span className="text-4xl font-bold text-brand-navy">
              {formatCurrency(p.price_per_day)}
            </span>
            <span className="text-slate-500">/ day</span>
            <span className="text-xs text-slate-400 ml-2">Rental price</span>
          </div>

          <p className="text-slate-700 mb-6 leading-relaxed">
            {p.description || "Premium rental for your event."}
          </p>

          {/* Specs grid */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            {p.setup_area && (
              <SpecItem icon={Maximize2} label="Setup area" value={p.setup_area} />
            )}
            {p.actual_size && (
              <SpecItem icon={Maximize2} label="Actual size" value={p.actual_size} />
            )}
            <SpecItem icon={Zap} label="Outlets needed" value={`${p.outlets_required || 1} × 110V`} />
            {p.age_group && (
              <SpecItem icon={Users} label="Age group" value={p.age_group} />
            )}
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3">
            <BookNowButton product={p} />
            <Link
              href="/order-by-date"
              className="inline-flex items-center justify-center gap-2 bg-white border-2 border-brand-navy text-brand-navy font-bold px-6 py-3 rounded-md hover:bg-slate-50 transition"
            >
              <Calendar className="h-5 w-5" /> Check date
            </Link>
          </div>

          <p className="text-xs text-slate-500 mt-4">
            🚚 Free delivery within Jacksonville metro area · 🧼 Cleaned & sanitized · ⭐ 5-star service
          </p>
        </div>
      </div>

      {/* Related products */}
      {related && related.length > 0 && (
        <div className="border-t border-slate-200 pt-10">
          <h2 className="text-2xl font-bold text-brand-navy mb-6">
            You may also like
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
            {(related as Product[]).map((rp) => (
              <Link
                key={rp.id}
                href={`/items/${rp.slug}`}
                className="group bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all border border-slate-200"
              >
                <div className="aspect-square relative bg-slate-50">
                  {rp.image_url && (
                    <Image
                      src={rp.image_url}
                      alt={rp.name}
                      fill
                      className="object-contain group-hover:scale-105 transition-transform"
                      unoptimized
                    />
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-brand-navy text-sm mb-1">
                    {rp.name}
                  </h3>
                  <span className="text-brand-navy font-bold">
                    {formatCurrency(rp.price_per_day)} <span className="text-xs text-slate-500">/ day</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10">
        <Link
          href="/rentals"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-navy"
        >
          <ArrowLeft className="h-4 w-4" /> Back to all rentals
        </Link>
      </div>
    </div>
  );
}

function SpecItem({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 bg-slate-50 rounded p-3">
      <Icon className="h-4 w-4 text-brand-yellow-dark mt-0.5 flex-shrink-0" />
      <div className="text-sm">
        <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
        <div className="font-semibold text-brand-navy">{value}</div>
      </div>
    </div>
  );
}
