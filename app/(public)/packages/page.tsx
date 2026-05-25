import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";
import { Package as PackageIcon, ArrowRight, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicPackagesPage() {
  const supabase = createAdminClient();
  const { data: packages } = await supabase
    .from("packages")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name");

  const list = (packages as any[]) || [];

  // Compute potential savings per package
  const productIds = new Set<string>();
  for (const p of list) {
    for (const it of p.items || []) productIds.add(it.product_id);
  }
  const productPrices = new Map<string, number>();
  if (productIds.size > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id, price_per_day")
      .in("id", Array.from(productIds));
    for (const p of (products as any[]) || []) {
      productPrices.set(p.id, p.price_per_day);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-brand-navy mb-2">
          Party Packages
        </h1>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Save money and skip the guesswork — our pre-built packages include
          everything you need for a successful party at one bundled price.
        </p>
      </div>

      {list.length === 0 ? (
        <div className="text-center text-slate-400 py-16">
          <PackageIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No packages available right now. Check back soon!</p>
          <Link href="/rentals" className="text-brand-navy hover:underline mt-3 inline-block">
            Browse individual rentals →
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {list.map((p) => {
            const regularPrice = (p.items || []).reduce((sum: number, it: any) => {
              return sum + (productPrices.get(it.product_id) || 0) * it.quantity;
            }, 0);
            const savings = regularPrice - p.price_cents;
            const savingsPct = regularPrice > 0 ? (savings / regularPrice) * 100 : 0;
            return (
              <Link
                key={p.id}
                href={`/order-by-date?package=${p.slug}`}
                className="card hover:shadow-xl transition group flex flex-col"
              >
                {p.image_url ? (
                  <div className="aspect-video relative bg-slate-100 rounded mb-3 overflow-hidden">
                    <Image
                      src={p.image_url}
                      alt={p.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-brand-yellow/20 to-brand-navy/10 rounded mb-3 flex items-center justify-center">
                    <PackageIcon className="h-12 w-12 text-brand-navy/40" />
                  </div>
                )}

                <h2 className="text-xl font-bold text-brand-navy mb-1">{p.name}</h2>
                {p.description && (
                  <p className="text-sm text-slate-600 mb-3">{p.description}</p>
                )}

                <div className="text-xs text-slate-500 mb-3">
                  <strong>Includes:</strong>
                  <ul className="mt-1 space-y-0.5">
                    {(p.items || []).map((it: any, i: number) => (
                      <li key={i}>
                        <span className="font-mono">{it.quantity}×</span> {it.name}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-3xl font-bold text-brand-navy">
                      {formatCurrency(p.price_cents)}
                    </span>
                  </div>
                  {savings > 0 && (
                    <div className="text-sm text-green-700 font-semibold inline-flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Save {formatCurrency(savings)} ({savingsPct.toFixed(0)}% off)
                    </div>
                  )}
                  <div className="mt-3 text-brand-navy font-semibold text-sm inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                    Book this package <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
