import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  NewBookingForm,
  type BookingFormInitial,
} from "../../new/NewBookingForm";
import type { Product } from "@/types/database";

export const dynamic = "force-dynamic";

const IdSchema = z.string().uuid();

export default async function EditBookingPage({
  params,
}: {
  params: { id: string };
}) {
  if (!IdSchema.safeParse(params.id).success) notFound();

  const supabase = createAdminClient();

  const [{ data: booking }, { data: products }] = await Promise.all([
    supabase.from("bookings").select("*").eq("id", params.id).single(),
    supabase
      .from("products")
      .select("id, name, slug, category, price_per_day, is_active")
      .eq("is_active", true)
      .order("category")
      .order("name"),
  ]);

  if (!booking) notFound();
  const b = booking as any;

  const initial: BookingFormInitial = {
    id: b.id,
    product_id: b.product_id,
    customer_first_name: b.customer_first_name || "",
    customer_last_name: b.customer_last_name || "",
    customer_email: b.customer_email || "",
    customer_phone: b.customer_phone || "",
    customer_address: b.customer_address ?? null,
    event_date: b.event_date,
    start_time: b.start_time ?? null,
    end_time: b.end_time ?? null,
    total_amount: b.total_amount || 0,
    payment_method: b.payment_method ?? null,
    booking_status: b.booking_status || "confirmed",
    notes: b.notes ?? null,
  };

  return (
    <div className="max-w-3xl">
      <Link
        href={`/admin/bookings/${params.id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-navy mb-4"
      >
        <ChevronLeft className="h-4 w-4" /> Back to booking
      </Link>

      <h1 className="text-2xl font-bold text-brand-navy mb-1">
        Edit booking #{b.id.slice(0, 8)}
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Every change is recorded in the audit log and appended to the booking
        notes so the history stays traceable.
      </p>

      <div className="card">
        <NewBookingForm
          products={(products as Product[]) || []}
          initial={initial}
        />
      </div>
    </div>
  );
}
