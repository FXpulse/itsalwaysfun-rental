import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { NewBookingForm } from "./NewBookingForm";
import type { Product } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function NewBookingPage() {
  const supabase = createAdminClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, slug, category, price_per_day, is_active")
    .eq("is_active", true)
    .order("category")
    .order("name");

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/bookings"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-navy mb-4"
      >
        <ChevronLeft className="h-4 w-4" /> Back to bookings
      </Link>

      <h1 className="text-2xl font-bold text-brand-navy mb-1">Create new booking</h1>
      <p className="text-sm text-slate-500 mb-6">
        For phone bookings, walk-ins, or any rental not made through the public website.
      </p>

      <div className="card">
        <NewBookingForm products={(products as Product[]) || []} />
      </div>
    </div>
  );
}
