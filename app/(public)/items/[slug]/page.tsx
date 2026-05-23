import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";
import { Calendar, Maximize2, Zap, Users, ArrowLeft, ChevronRight } from "lucide-react";
import type { Product } from "@/types/database";
import { BookNowButton } from "./BookNowButton";

export const dynamic = "force-dynamic";

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
    .single();

  if (!product) notFound();
  const p = product as Product;

  // Fetch 3 related products from same category
  const { data: related } = await supabase
    .from("products")
    .select("id, name, slug, category, price_per_day, image_url")
    .eq("category", p.category)
    .eq("is_active", true)
    .neq("id", p.id)
    .limit(3);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
        {/* Image */}
        <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-md">
          <div className="aspect-square relative bg-slate-50">
            {p.image_url ? (
              <Image
                src={p.image_url}
                alt={p.name}
                fill
                className="object-contain"
                priority
                unoptimized
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-300">
                No image available
              </div>
            )}
          </div>
        </div>

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
