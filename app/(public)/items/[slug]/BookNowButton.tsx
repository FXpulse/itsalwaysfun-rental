"use client";

import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { useCart } from "@/lib/cart/context";
import type { Product } from "@/types/database";

export function BookNowButton({ product }: { product: Product }) {
  const router = useRouter();
  const { setItem } = useCart();

  function handleBookNow() {
    setItem({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      pricePerDay: product.price_per_day,
      imageUrl: product.image_url,
      eventDate: null,
      startTime: null,
      endTime: null,
      addedAt: new Date().toISOString(),
    });
    router.push("/order-by-date");
  }

  return (
    <button
      onClick={handleBookNow}
      className="inline-flex items-center justify-center gap-2 bg-brand-yellow text-brand-navy font-bold px-6 py-3 rounded-md hover:bg-yellow-300 transition flex-1 shadow-md"
    >
      <Calendar className="h-5 w-5" /> Book Now
    </button>
  );
}
