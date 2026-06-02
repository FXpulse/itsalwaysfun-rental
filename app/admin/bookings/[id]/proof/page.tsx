// Focused proof-capture view for drivers — only the photo + signature
// capture UI, none of the booking admin fields. Linked from
// /admin/dispatch/route/[id] so drivers stay in their workflow.

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Clock, Phone, User } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { ProofCapture } from "../ProofCapture";

export const dynamic = "force-dynamic";

export default async function BookingProofPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { phase?: string; route?: string };
}) {
  const me = await getCurrentUserRole();
  if (!me) redirect("/admin/login");

  const supabase = createAdminClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id, customer_first_name, customer_last_name, customer_phone, customer_address, product_name, event_date, event_end_date, start_time, end_time",
    )
    .eq("id", params.id)
    .single();
  if (!booking) notFound();

  const { data: proofs } = await supabase
    .from("booking_proofs")
    .select("*")
    .eq("booking_id", params.id);

  const deliveryProof = (proofs as any[])?.find((p) => p.phase === "delivery") || null;
  const pickupProof = (proofs as any[])?.find((p) => p.phase === "pickup") || null;

  // Back link: if came from a route, go back to that route
  const backHref = searchParams.route
    ? `/admin/dispatch/route/${searchParams.route}`
    : me.role === "driver"
    ? "/driver"
    : `/admin/bookings/${params.id}`;
  const backLabel = searchParams.route ? "Back to route" : me.role === "driver" ? "Back to my routes" : "Back to booking";

  const b: any = booking;
  const phase = (searchParams.phase === "pickup" ? "pickup" : "delivery") as "delivery" | "pickup";

  return (
    <div className="max-w-2xl mx-auto p-4">
      <Link
        href={backHref}
        className="text-sm text-slate-500 hover:text-brand-navy inline-flex items-center gap-1 mb-3"
      >
        <ArrowLeft className="h-3 w-3" /> {backLabel}
      </Link>

      {/* Customer + booking quick info */}
      <div className="card mb-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 mb-1">
          {phase === "pickup" ? "📦 PICKUP" : "🚚 DELIVERY"} proof
        </div>
        <h1 className="text-xl font-bold text-brand-navy flex items-center gap-2">
          <User className="h-5 w-5" />
          {b.customer_first_name} {b.customer_last_name}
        </h1>
        <p className="text-sm text-slate-600 mt-1">{b.product_name}</p>

        <div className="mt-3 grid grid-cols-1 gap-1.5 text-sm">
          {b.customer_address && (
            <div className="flex items-start gap-2 text-slate-700">
              <MapPin className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
              <span>{b.customer_address}</span>
            </div>
          )}
          {b.customer_phone && (
            <a
              href={`tel:${b.customer_phone.replace(/\D/g, "")}`}
              className="flex items-center gap-2 text-indigo-600 hover:underline"
            >
              <Phone className="h-4 w-4 text-slate-400" />
              {b.customer_phone}
            </a>
          )}
          {b.start_time && (
            <div className="flex items-center gap-2 text-slate-700">
              <Clock className="h-4 w-4 text-slate-400 shrink-0" />
              <span>{b.start_time}{b.end_time ? ` – ${b.end_time}` : ""}</span>
            </div>
          )}
        </div>
      </div>

      {/* Proof capture for the selected phase (default: delivery) */}
      <ProofCapture
        bookingId={b.id}
        phase={phase}
        existing={phase === "delivery" ? deliveryProof : pickupProof}
      />

      {/* Quick switch between delivery/pickup proof on the same page */}
      <div className="mt-3 text-center">
        {phase === "delivery" ? (
          <Link
            href={`/admin/bookings/${b.id}/proof?phase=pickup${searchParams.route ? `&route=${searchParams.route}` : ""}`}
            className="text-xs text-slate-500 hover:text-brand-navy underline"
          >
            Switch to pickup proof →
          </Link>
        ) : (
          <Link
            href={`/admin/bookings/${b.id}/proof?phase=delivery${searchParams.route ? `&route=${searchParams.route}` : ""}`}
            className="text-xs text-slate-500 hover:text-brand-navy underline"
          >
            ← Switch to delivery proof
          </Link>
        )}
      </div>
    </div>
  );
}
