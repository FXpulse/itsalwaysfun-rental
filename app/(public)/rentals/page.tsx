import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export default async function RentalsPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const supabase = createAdminClient();
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .eq("is_addon", false)
    .order("category")
    .order("name");

  const all = (products as Product[]) || [];
  const categories = Array.from(new Set(all.map((p) => p.category)));

  const filtered = searchParams.category
    ? all.filter((p) => p.category === searchParams.category)
    : all;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-brand-navy mb-2">All Rentals</h1>
        <p className="text-slate-600">
          {filtered.length} of {all.length} rentals
          {searchParams.category && ` in ${searchParams.category}`}
        </p>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        <Link
          href="/rentals"
          className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
            !searchParams.category
              ? "bg-brand-navy text-white"
              : "bg-white border border-slate-300 text-brand-navy hover:bg-slate-50"
          }`}
        >
          All ({all.length})
        </Link>
        {categories.map((cat) => {
          const count = all.filter((p) => p.category === cat).length;
          const active = searchParams.category === cat;
          return (
            <Link
              key={cat}
              href={`/rentals?category=${encodeURIComponent(cat)}`}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
                active
                  ? "bg-brand-navy text-white"
                  : "bg-white border border-slate-300 text-brand-navy hover:bg-slate-50"
              }`}
            >
              {cat} ({count})
            </Link>
          );
        })}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center text-slate-500 py-16">
          No rentals available in this category yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/items/${p.slug}`}
              className="group bg-white rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all border border-slate-200"
            >
              <div className="aspect-[4/3] relative bg-slate-50 overflow-hidden">
                {p.image_url ? (
                  <Image
                    src={p.image_url}
                    alt={p.name}
                    fill
                    className="object-contain group-hover:scale-105 transition-transform duration-500"
                    unoptimized
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-300">
                    No image
                  </div>
                )}
                <div className="absolute top-2 left-2 bg-brand-navy text-white text-xs font-semibold px-2 py-1 rounded">
                  {p.category}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-brand-navy mb-1">{p.name}</h3>
                <p className="text-sm text-slate-600 line-clamp-2 mb-3">
                  {p.description || ""}
                </p>
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-bold text-brand-navy">
                      {formatCurrency(p.price_per_day)}
                    </span>
                    <span className="text-sm text-slate-500"> / day</span>
                  </div>
                  <span className="text-sm font-semibold text-brand-yellow-dark group-hover:underline">
                    View →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
