"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import {
  createManualBooking,
  updateManualBooking,
  type CustomerMatch,
} from "../actions";
import { CustomerAutocomplete } from "./CustomerAutocomplete";
import type { Product } from "@/types/database";

interface CustomerFields {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
}

const EMPTY_CUSTOMER: CustomerFields = {
  first_name: "", last_name: "", email: "", phone: "", address: "",
};

export type BookingFormInitial = {
  id: string;
  product_id: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  total_amount: number; // cents
  payment_method: string | null;
  booking_status: string;
  notes: string | null;
};

export function NewBookingForm({
  products,
  initial,
}: {
  products: Product[];
  initial?: BookingFormInitial;
}) {
  const router = useRouter();
  const isEdit = !!initial;
  const [pending, startTransition] = useTransition();
  const [selectedProductId, setSelectedProductId] = useState(
    initial?.product_id || products[0]?.id || "",
  );
  const [customer, setCustomer] = useState<CustomerFields>(
    initial
      ? {
          first_name: initial.customer_first_name,
          last_name: initial.customer_last_name,
          email: initial.customer_email,
          phone: initial.customer_phone,
          address: initial.customer_address || "",
        }
      : EMPTY_CUSTOMER,
  );
  const [pickedEmail, setPickedEmail] = useState<string | null>(null);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const defaultAmount = initial
    ? Math.round(initial.total_amount / 100)
    : selectedProduct
      ? Math.round(selectedProduct.price_per_day / 100)
      : 0;

  function pickCustomer(c: CustomerMatch) {
    setCustomer({
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
      phone: c.phone || "",
      address: c.address || "",
    });
    setPickedEmail(c.email);
  }

  function clearPicked() {
    setPickedEmail(null);
    setCustomer(EMPTY_CUSTOMER);
  }

  function updateField<K extends keyof CustomerFields>(k: K, v: string) {
    setCustomer((prev) => ({ ...prev, [k]: v }));
    // If the operator edits a field after picking, drop the "reusing" banner —
    // they may be doing it intentionally.
    if (pickedEmail && k === "email" && v.toLowerCase() !== pickedEmail.toLowerCase()) {
      setPickedEmail(null);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = isEdit
        ? await updateManualBooking(initial!.id, formData)
        : await createManualBooking(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Booking updated" : "Booking created");
      if (result?.booking_id) {
        router.push(`/admin/bookings/${result.booking_id}`);
      } else {
        router.push("/admin/bookings");
      }
      router.refresh();
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

      {/* Customer — autocomplete first to avoid duplicates */}
      <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-3 space-y-3">
        <CustomerAutocomplete
          onPick={pickCustomer}
          onClear={clearPicked}
          pickedEmail={pickedEmail}
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">First name *</label>
            <input
              name="customer_first_name"
              required
              className="input"
              disabled={pending}
              value={customer.first_name}
              onChange={(e) => updateField("first_name", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Last name *</label>
            <input
              name="customer_last_name"
              required
              className="input"
              disabled={pending}
              value={customer.last_name}
              onChange={(e) => updateField("last_name", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
            <input
              name="customer_email"
              type="email"
              required
              className="input"
              disabled={pending}
              value={customer.email}
              onChange={(e) => updateField("email", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label>
            <input
              name="customer_phone"
              required
              placeholder="(904) 555-1234"
              className="input"
              disabled={pending}
              value={customer.phone}
              onChange={(e) => updateField("phone", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Delivery address</label>
          <input
            name="customer_address"
            placeholder="123 Main St, City, ST 12345"
            className="input"
            disabled={pending}
            value={customer.address}
            onChange={(e) => updateField("address", e.target.value)}
          />
        </div>
      </div>

      {/* Event */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Event date *</label>
          <input
            name="event_date"
            type="date"
            required
            defaultValue={initial?.event_date}
            className="input"
            disabled={pending}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Start time</label>
          <input
            name="start_time"
            type="time"
            defaultValue={initial?.start_time ?? "09:00"}
            className="input"
            disabled={pending}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">End time</label>
          <input
            name="end_time"
            type="time"
            defaultValue={initial?.end_time ?? "17:00"}
            className="input"
            disabled={pending}
          />
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
          <select
            name="payment_method"
            defaultValue={initial?.payment_method || "cash"}
            className="input"
            disabled={pending}
          >
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
          <select
            name="booking_status"
            defaultValue={initial?.booking_status || "confirmed"}
            className="input"
            disabled={pending}
          >
            <option value="pending_payment">Pending payment</option>
            <option value="confirmed">Confirmed</option>
            <option value="delivered">Delivered</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={initial?.notes ?? ""}
          className="input"
          disabled={pending}
        />
      </div>

      <div className="flex gap-3 pt-3 border-t border-slate-200">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending
            ? isEdit
              ? "Saving..."
              : "Creating..."
            : isEdit
              ? "Save changes"
              : "Create booking"}
        </button>
        <button
          type="button"
          onClick={() =>
            router.push(
              isEdit ? `/admin/bookings/${initial!.id}` : "/admin/bookings",
            )
          }
          className="px-4 py-2 text-slate-600 hover:text-slate-900"
          disabled={pending}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
