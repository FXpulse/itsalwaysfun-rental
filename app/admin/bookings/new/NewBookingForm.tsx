"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { createManualBooking } from "../actions";
import type { Product } from "@/types/database";

export function NewBookingForm({ products }: { products: Product[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || "");

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const defaultAmount = selectedProduct ? Math.round(selectedProduct.price_per_day / 100) : 0;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createManualBooking(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Booking created");
      if (result?.booking_id) {
        router.push(`/admin/bookings/${result.booking_id}`);
      } else {
        router.push("/admin/bookings");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Product */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Product *
        </label>
        <select
          name="product_id"
          required
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
          className="input"
          disabled={pending}
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.category} — {formatCurrency(p.price_per_day)}/day
            </option>
          ))}
        </select>
      </div>

      {/* Customer */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">First name *</label>
          <input name="customer_first_name" required className="input" disabled={pending} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Last name *</label>
          <input name="customer_last_name" required className="input" disabled={pending} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
          <input name="customer_email" type="email" required className="input" disabled={pending} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label>
          <input name="customer_phone" required placeholder="(904) 555-1234" className="input" disabled={pending} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Delivery address</label>
        <input name="customer_address" placeholder="123 Main St, City, ST 12345" className="input" disabled={pending} />
      </div>

      {/* Event */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Event date *</label>
          <input name="event_date" type="date" required className="input" disabled={pending} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Start time</label>
          <input name="start_time" type="time" defaultValue="09:00" className="input" disabled={pending} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">End time</label>
          <input name="end_time" type="time" defaultValue="17:00" className="input" disabled={pending} />
        </div>
      </div>

      {/* Payment + status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Total amount (USD) *
          </label>
          <input
            name="total_amount_dollars"
            type="number"
            required
            min={0}
            defaultValue={defaultAmount}
            className="input"
            disabled={pending}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Payment method
          </label>
          <select name="payment_method" defaultValue="cash" className="input" disabled={pending}>
            <option value="cash">Cash</option>
            <option value="venmo">Venmo</option>
            <option value="zelle">Zelle</option>
            <option value="check">Check</option>
            <option value="other">Other</option>
            <option value="none">Not paid yet</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Booking status
          </label>
          <select name="booking_status" defaultValue="confirmed" className="input" disabled={pending}>
            <option value="pending_payment">Pending payment</option>
            <option value="confirmed">Confirmed</option>
            <option value="delivered">Delivered</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
        <textarea name="notes" rows={3} className="input" disabled={pending} />
      </div>

      <div className="flex gap-3 pt-3 border-t border-slate-200">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Creating..." : "Create booking"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/bookings")}
          className="px-4 py-2 text-slate-600 hover:text-slate-900"
          disabled={pending}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
