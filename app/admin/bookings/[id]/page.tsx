import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency, formatDate } from "@/lib/utils";
import { BookingActions } from "./BookingActions";
import { DeliveryChecklist } from "./DeliveryChecklist";
import { ProofCapture } from "./ProofCapture";
import { DamagesSection } from "./DamagesSection";
import { getDeliveryChecklist } from "@/lib/delivery-checklist";
import type { Booking } from "@/types/database";
import { z } from "zod";

export const dynamic = "force-dynamic";

const IdSchema = z.string().uuid();

export default async function BookingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  if (!IdSchema.safeParse(params.id).success) notFound();

  const supabase = createAdminClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!booking) notFound();
  const b = booking as Booking & {
    payment_method?: string;
    delivery_checked_at?: string | null;
    delivery_checked_by?: string | null;
  };

  // Compute delivery checklist from product inventory requirements
  const checklist = await getDeliveryChecklist(params.id);

  // Load proofs (delivery + pickup) and damages in parallel
  const [{ data: proofs }, { data: damagesRaw }, { data: inventory }] = await Promise.all([
    supabase.from("booking_proofs").select("*").eq("booking_id", params.id),
    supabase
      .from("booking_damages")
      .select(`
        id, inventory_item_id, description, severity, cost_cents,
        customer_responsible, charged_to_customer, resolved, photo_url,
        recorded_at, recorded_by, notes,
        inventory_items (name)
      `)
      .eq("booking_id", params.id)
      .order("recorded_at", { ascending: false }),
    supabase
      .from("inventory_items")
      .select("id, name, category")
      .eq("is_active", true)
      .order("category")
      .order("name"),
  ]);

  const proofsList = (proofs as any[]) || [];
  const deliveryProof =
    proofsList.find((p) => p.phase === "delivery") || null;
  const pickupProof = proofsList.find((p) => p.phase === "pickup") || null;

  const damages = ((damagesRaw as any[]) || []).map((d) => ({
    ...d,
    inventory_name: d.inventory_items?.name || null,
  }));

  return (
    <div className="max-w-4xl">
      <Link
        href="/admin/bookings"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-navy mb-4"
      >
        <ChevronLeft className="h-4 w-4" /> Back to bookings
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy mb-1">
            Booking #{b.id.slice(0, 8)}
          </h1>
          <p className="text-sm text-slate-500">
            Created {new Date(b.created_at).toLocaleString()}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <StatusBadge label="Booking" status={b.booking_status} />
          <StatusBadge label="Payment" status={b.stripe_payment_status} />
        </div>
      </div>

      {/* Booking info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-3">
            Event
          </h2>
          <dl className="space-y-2 text-sm">
            <Row label="Product" value={b.product_name} />
            <Row label="Start date" value={formatDate(b.event_date)} />
            {b.event_end_date && b.event_end_date !== b.event_date && (
              <>
                <Row label="End date" value={formatDate(b.event_end_date)} />
                <Row label="Days" value={(() => {
                  const days = Math.round(
                    (new Date(b.event_end_date).getTime() - new Date(b.event_date).getTime()) / 86400000
                  ) + 1;
                  return <span className="font-bold text-purple-700">{days} days</span>;
                })()} />
              </>
            )}
            {b.start_time && <Row label="Start time" value={b.start_time} />}
            {b.end_time && <Row label="End time" value={b.end_time} />}
          </dl>
        </div>

        <div className="card">
          <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-3">
            Customer
          </h2>
          <dl className="space-y-2 text-sm">
            <Row label="Name" value={`${b.customer_first_name} ${b.customer_last_name}`} />
            <Row label="Email" value={
              <a href={`mailto:${b.customer_email}`} className="text-brand-navy hover:underline">
                {b.customer_email}
              </a>
            } />
            <Row label="Phone" value={b.customer_phone ? (
              <a href={`tel:${b.customer_phone.replace(/\D/g,'')}`} className="text-brand-navy hover:underline">
                {b.customer_phone}
              </a>
            ) : "—"} />
            <Row label="Address" value={b.customer_address || "—"} />
            {b.surface_type && (
              <Row
                label="Setup surface"
                value={
                  <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs uppercase tracking-wide">
                    {b.surface_type}
                  </span>
                }
              />
            )}
            {b.needs_power_supply && (
              <Row
                label="Power supply"
                value={
                  <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs font-semibold">
                    ⚡ INCLUDED (+{formatCurrency(b.power_supply_cents || 0)})
                  </span>
                }
              />
            )}
          </dl>
        </div>

        <div className="card lg:col-span-2">
          <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-3">
            Payment
          </h2>
          <dl className="space-y-2 text-sm">
            <Row label="Total amount" value={
              <span className="font-bold text-brand-navy text-lg">
                {formatCurrency(b.total_amount)}
              </span>
            } />
            <Row label="Status" value={<StatusBadge label="" status={b.stripe_payment_status} />} />
            {b.payment_method && (
              <Row label="Method" value={
                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs uppercase tracking-wider">
                  {b.payment_method}
                </span>
              } />
            )}
            {b.stripe_payment_intent_id && (
              <Row label="Stripe PI" value={
                <code className="text-xs font-mono text-slate-500">
                  {b.stripe_payment_intent_id}
                </code>
              } />
            )}
          </dl>
        </div>
      </div>

      {/* Delivery checklist (internal — inventory items to load on truck) */}
      <DeliveryChecklist
        bookingId={b.id}
        items={checklist.items}
        surfaceType={checklist.surfaceType}
        needsPowerSupply={checklist.needsPowerSupply}
        deliveryCheckedAt={b.delivery_checked_at || null}
        deliveryCheckedBy={b.delivery_checked_by || null}
      />

      {/* Proofs */}
      <div className="space-y-4 mb-6">
        <ProofCapture bookingId={b.id} phase="delivery" existing={deliveryProof} />
        <ProofCapture bookingId={b.id} phase="pickup" existing={pickupProof} />
      </div>

      {/* Damages */}
      <div className="mb-6">
        <DamagesSection
          bookingId={b.id}
          damages={damages}
          inventory={(inventory as any[]) || []}
        />
      </div>

      {/* Actions */}
      <BookingActions booking={b} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-slate-100 pb-2 last:border-0">
      <dt className="text-slate-500 w-32 text-xs uppercase tracking-wider">{label}</dt>
      <dd className="text-slate-900 flex-1">{value}</dd>
    </div>
  );
}

function StatusBadge({ label, status }: { label?: string; status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    refunded: "bg-slate-100 text-slate-600 border-slate-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    pending_payment: "bg-amber-50 text-amber-700 border-amber-200",
    confirmed: "bg-blue-50 text-blue-700 border-blue-200",
    delivered: "bg-purple-50 text-purple-700 border-purple-200",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    cancelled: "bg-slate-100 text-slate-500 border-slate-200",
  };
  const cls = map[status] || "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded border ${cls}`}>
      {label && <span className="text-slate-500 mr-1">{label}:</span>}
      {status.replace(/_/g, " ")}
    </span>
  );
}
