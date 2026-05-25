import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BookingWizard } from "./BookingWizard";
import { isStripeConfigured } from "@/lib/stripe/server";
import { ensureCustomerProfile, getLoyaltySettings } from "@/lib/loyalty";
import type { Product } from "@/types/database";
import { Sparkles } from "lucide-react";

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

  const allProducts = (productsResult.data as Product[]) || [];
  // Wizard's category/product picker only shows non-addon products
  const products = allProducts.filter((p) => !p.is_addon);
  // Power supply add-on (used when customer says "no power source")
  const powerSupply = allProducts.find((p) => p.slug === "power-supply" && p.is_addon) || null;
  const categories = (categoriesResult.data as CategoryRow[]) || [];

  // Detect portal-authenticated customer + pull profile to prefill the wizard
  const authClient = createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  let prefill: any = null;
  let isReturningCustomer = false;
  let availablePoints = 0;
  let loyaltySettings: { points_redemption_rate: number; min_redeem_points: number } | null = null;
  if (user?.email) {
    const meta = (user.user_metadata as any) || {};
    const { data: latest } = await supabase
      .from("bookings")
      .select(
        "customer_first_name, customer_last_name, customer_phone, customer_address",
      )
      .ilike("customer_email", user.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    isReturningCustomer = !!latest;

    prefill = {
      firstName: meta.first_name || latest?.customer_first_name || "",
      lastName: meta.last_name || latest?.customer_last_name || "",
      email: user.email,
      phone: meta.phone || latest?.customer_phone || "",
      address: meta.address || latest?.customer_address || "",
    };

    // Loyalty: ensure profile + fetch points
    await ensureCustomerProfile(user.id);
    const { data: profile } = await supabase
      .from("customer_profiles")
      .select("loyalty_points")
      .eq("user_id", user.id)
      .single();
    availablePoints = profile?.loyalty_points || 0;
    const s = await getLoyaltySettings();
    loyaltySettings = {
      points_redemption_rate: s.points_redemption_rate,
      min_redeem_points: s.min_redeem_points,
    };
  }

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

      {isReturningCustomer && (
        <div className="mb-4 bg-brand-navy text-white rounded-lg p-3 flex items-center gap-3 text-sm">
          <Sparkles className="h-5 w-5 text-brand-yellow flex-shrink-0" />
          <div className="flex-1">
            <strong>Welcome back!</strong> Your contact info is filled in — just pick a
            date and product.
          </div>
          <Link href="/portal" className="text-brand-yellow text-xs underline whitespace-nowrap">
            My account →
          </Link>
        </div>
      )}

      {!user && (
        <div className="mb-4 bg-slate-100 rounded-lg p-3 text-sm text-slate-600 text-center">
          Returning customer?{" "}
          <Link href="/portal/login" className="text-brand-navy font-semibold hover:underline">
            Sign in
          </Link>{" "}
          for faster checkout + loyalty rewards.
        </div>
      )}

      <BookingWizard
        products={products}
        categories={categories}
        powerSupply={powerSupply}
        stripeConfigured={isStripeConfigured()}
        stripePublishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""}
        prefillCustomer={prefill}
        availablePoints={availablePoints}
        loyaltySettings={loyaltySettings}
      />
    </div>
  );
}
