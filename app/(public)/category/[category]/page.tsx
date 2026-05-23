import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/types/database";

export const dynamic = "force-dynamic";

const CATEGORY_MAP: Record<string, string> = {
  "bounce-houses": "Bounce Houses",
  "combos": "Bounce & Slide Combos",
  "dry-slides": "Dry Slides",
  "concessions": "Concessions",
};

const COMING_SOON = ["combos", "concessions"];

export default async function CategoryPage({
  params,
}: {
  params: { category: string };
}) {
  const dbCategory = CATEGORY_MAP[params.category];
  if (!dbCategory) notFound();

  const supabase = createAdminClient();
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("category", dbCategory)
    .eq("is_active", true)
    .order("name");

  const list = (products as Product[]) || [];
  const isComingSoon = COMING_SOON.includes(params.category) || list.length === 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-brand-navy mb-2">{dbCategory}</h1>
        <p className="text-slate-600">
          {isComingSoon
            ? "Coming soon — new inventory landing soon."
            : `${list.length} rental${list.length === 1 ? "" : "s"} ready for your event`}
        </p>
      </div>

      {isComingSoon ? (
        <div className="card text-center py-16 max-w-xl mx-auto">
          <span className="inline-block bg-brand-yellow text-brand-navy text-sm font-bold px-3 py-1 rounded uppercase tracking-wider mb-4">
            Coming Soon
          </span>
          <h2 className="text-2xl font-bold text-brand-navy mb-2">
            We're growing our inventory!
          </h2>
          <p className="text-slate-600 mb-6">
            New {dbCategory.toLowerCase()} are on their way. In the meantime,
            browse our other rentals.
          </p>
          <Link href="/rentals" className="btn-primary">
            See available rentals →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {list.map((p) => (
            <Link
              key={p.id}
              href={`/items/${p.slug}`}
              className="group bg-white rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all border border-slate-200"
            >
              <div className="aspect-[4/3] relative bg-slate-50 overflow-hidden">
                {p.image_url && (
                  <Image
                    src={p.image_url}
                    alt={p.name}
                    fill
                    className="object-contain group-hover:scale-105 transition-transform duration-500"
                    unoptimized
                  />
                )}
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
