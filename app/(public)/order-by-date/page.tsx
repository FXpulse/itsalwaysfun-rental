import { createAdminClient } from "@/lib/supabase/admin";
import { BookingWizard } from "./BookingWizard";
import { isStripeConfigured } from "@/lib/stripe/server";
import type { Product } from "@/types/database";

export const dynamic = "force-dynamic";

interface CategoryRow {
  name: string;
  slug: string;
  is_active: boolean;
}

export default async function OrderByDatePage() {
  const supabase = createAdminClient();

  const [productsResult, categoriesResult] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("category")
      .order("name"),
    supabase
      .from("categories")
      .select("name, slug, is_active")
      .eq("is_active", true)
      .order("display_order"),
  ]);

  const products = (productsResult.data as Product[]) || [];
  const categories = (categoriesResult.data as CategoryRow[]) || [];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-brand-navy mb-2">
          Book Your Rental
        </h1>
        <p className="text-slate-600">
          Pick a date, choose your rental, pay & confirm in 2 minutes.
        </p>
      </div>

      <BookingWizard
        products={products}
        categories={categories}
        stripeConfigured={isStripeConfigured()}
        stripePublishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""}
      />
    </div>
  );
}
