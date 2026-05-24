"use client";

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createQuote, updateQuote } from "./actions";
import { formatCurrency } from "@/lib/utils";

export interface QuoteProduct {
  id: string;
  name: string;
  slug: string;
  price_per_day: number;
}

export interface LineItem {
  product_id?: string | null;
  name: string;
  description?: string | null;
  quantity: number;
  unit_price_cents: number;
}

export interface QuoteFormData {
  id?: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  event_date: string;
  event_end_date: string;
  start_time: string;
  end_time: string;
  line_items: LineItem[];
  discount_cents: number;
  discount_note: string;
  tax_cents: number;
  customer_message: string;
  internal_notes: string;
  expires_days: number;
}

export function QuoteEditor({
  initial,
  products,
}: {
  initial?: QuoteFormData;
  products: QuoteProduct[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [data, setData] = useState<QuoteFormData>(
    initial || {
      customer_first_name: "",
      customer_last_name: "",
      customer_email: "",
      customer_phone: "",
      customer_address: "",
      event_date: "",
      event_end_date: "",
      start_time: "",
      end_time: "",
      line_items: [],
      discount_cents: 0,
      discount_note: "",
      tax_cents: 0,
      customer_message: "",
      internal_notes: "",
      expires_days: 14,
    },
  );

  const subtotal = useMemo(
    () => data.line_items.reduce((s, it) => s + it.unit_price_cents * it.quantity, 0),
    [data.line_items],
  );
  const total = Math.max(0, subtotal - data.discount_cents + data.tax_cents);

  function patch(p: Partial<QuoteFormData>) {
    setData((d) => ({ ...d, ...p }));
  }

  function addLineFromProduct(productId: string) {
    if (!productId) return;
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setData((d) => ({
      ...d,
      line_items: [
        ...d.line_items,
        {
          product_id: p.id,
          name: p.name,
          quantity: 1,
          unit_price_cents: p.price_per_day,
        },
      ],
    }));
  }

  function addCustomLine() {
    setData((d) => ({
      ...d,
      line_items: [
        ...d.line_items,
        { product_id: null, name: "", quantity: 1, unit_price_cents: 0 },
      ],
    }));
  }

  function updateLine(idx: number, p: Partial<LineItem>) {
    setData((d) => ({
      ...d,
      line_items: d.line_items.map((it, i) => (i === idx ? { ...it, ...p } : it)),
    }));
  }

  function removeLine(idx: number) {
    setData((d) => ({ ...d, line_items: d.line_items.filter((_, i) => i !== idx) }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (data.line_items.length === 0) {
      toast.error("Add at least one line item");
      return;
    }
    if (data.line_items.some((it) => !it.name.trim() || it.unit_price_cents < 0)) {
      toast.error("Every line item needs a name and a non-negative price");
      return;
    }
    startTransition(async () => {
      const payload = {
        ...data,
        customer_address: data.customer_address || null,
        event_end_date: data.event_end_date || null,
        start_time: data.start_time || null,
        end_time: data.end_time || null,
        discount_note: data.discount_note || null,
        customer_message: data.customer_message || null,
        internal_notes: data.internal_notes || null,
      };
      const r = data.id
        ? await updateQuote(data.id, payload as any)
        : await createQuote(payload as any);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(data.id ? "Quote updated" : "Quote created");
      if (!data.id && "quote" in r && r.quote) {
        router.push(`/admin/quotes/${r.quote.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
      <Link
        href="/admin/quotes"
        className="text-sm text-slate-500 hover:text-brand-navy inline-flex items-center gap-1"
      >
        <ArrowLeft className="h-3 w-3" /> Back to quotes
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-brand-navy">
          {data.id ? "Edit quote" : "New quote"}
        </h1>
        <p className="text-sm text-slate-500">
          Draft — won't be sent until you click "Send to customer" on the next page.
        </p>
      </div>

      {/* Customer */}
      <Section title="Customer">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required>
            <input
              required
              className="input"
              value={data.customer_first_name}
              onChange={(e) => patch({ customer_first_name: e.target.value })}
            />
          </Field>
          <Field label="Last name" required>
            <input
              required
              className="input"
              value={data.customer_last_name}
              onChange={(e) => patch({ customer_last_name: e.target.value })}
            />
          </Field>
          <Field label="Email" required>
            <input
              required
              type="email"
              className="input"
              value={data.customer_email}
              onChange={(e) => patch({ customer_email: e.target.value })}
            />
          </Field>
          <Field label="Phone" required>
            <input
              required
              type="tel"
              className="input"
              value={data.customer_phone}
              onChange={(e) => patch({ customer_phone: e.target.value })}
            />
          </Field>
          <Field label="Address" full>
            <input
              className="input"
              placeholder="Street, City, ZIP"
              value={data.customer_address}
              onChange={(e) => patch({ customer_address: e.target.value })}
            />
          </Field>
        </div>
      </Section>

      {/* Event */}
      <Section title="Event">
        <div className="grid grid-cols-4 gap-3">
          <Field label="Event date" required>
            <input
              required
              type="date"
              className="input"
              value={data.event_date}
              onChange={(e) => patch({ event_date: e.target.value })}
            />
          </Field>
          <Field label="End date (if multi-day)">
            <input
              type="date"
              className="input"
              value={data.event_end_date}
              onChange={(e) => patch({ event_end_date: e.target.value })}
            />
          </Field>
          <Field label="Start time">
            <input
              type="time"
              className="input"
              value={data.start_time}
              onChange={(e) => patch({ start_time: e.target.value })}
            />
          </Field>
          <Field label="End time">
            <input
              type="time"
              className="input"
              value={data.end_time}
              onChange={(e) => patch({ end_time: e.target.value })}
            />
          </Field>
        </div>
      </Section>

      {/* Line items */}
      <Section title="Line items">
        <div className="flex gap-2 mb-3">
          <select
            className="input flex-1"
            value=""
            onChange={(e) => {
              addLineFromProduct(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">+ Add product from catalog...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatCurrency(p.price_per_day)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addCustomLine}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 text-sm"
          >
            <Plus className="h-4 w-4 mr-1" /> Custom line
          </button>
        </div>

        {data.line_items.length === 0 ? (
          <div className="text-center text-sm text-slate-400 py-6 border-2 border-dashed border-slate-200 rounded">
            No line items yet. Add one above.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left">Item</th>
                <th className="px-2 py-2 text-center w-20">Qty</th>
                <th className="px-2 py-2 text-right w-32">Unit price</th>
                <th className="px-2 py-2 text-right w-28">Total</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.line_items.map((it, i) => (
                <tr key={i}>
                  <td className="px-2 py-2">
                    <input
                      required
                      placeholder="Item name"
                      className="input"
                      value={it.name}
                      onChange={(e) => updateLine(i, { name: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={1}
                      className="input text-center"
                      value={it.quantity}
                      onChange={(e) =>
                        updateLine(i, { quantity: parseInt(e.target.value) || 1 })
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="input text-right"
                      value={(it.unit_price_cents / 100).toFixed(2)}
                      onChange={(e) =>
                        updateLine(i, {
                          unit_price_cents: Math.round(parseFloat(e.target.value || "0") * 100),
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-2 text-right font-mono">
                    {formatCurrency(it.unit_price_cents * it.quantity)}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Totals */}
      <Section title="Pricing">
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 max-w-xl text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-mono">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <Field label="Discount (USD)" small>
              <input
                type="number"
                min={0}
                step="0.01"
                className="input"
                value={(data.discount_cents / 100).toFixed(2)}
                onChange={(e) =>
                  patch({ discount_cents: Math.round(parseFloat(e.target.value || "0") * 100) })
                }
              />
            </Field>
            <Field label="Discount note (e.g. '10% loyalty')" small>
              <input
                className="input"
                value={data.discount_note}
                onChange={(e) => patch({ discount_note: e.target.value })}
              />
            </Field>
          </div>
          <div></div>
          <Field label="Tax (USD)" small>
            <input
              type="number"
              min={0}
              step="0.01"
              className="input"
              value={(data.tax_cents / 100).toFixed(2)}
              onChange={(e) =>
                patch({ tax_cents: Math.round(parseFloat(e.target.value || "0") * 100) })
              }
            />
          </Field>
          <div className="col-span-2 border-t pt-2 flex justify-between text-base">
            <span className="font-semibold">Total</span>
            <span className="font-mono font-bold text-brand-navy text-lg">
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      </Section>

      {/* Notes */}
      <Section title="Messages">
        <Field label="Message to customer (shown on the quote)">
          <textarea
            rows={3}
            className="input"
            placeholder="Hi [name], here's the quote for your event. Let me know if you need anything adjusted!"
            value={data.customer_message}
            onChange={(e) => patch({ customer_message: e.target.value })}
          />
        </Field>
        <Field label="Internal notes (admin only)">
          <textarea
            rows={2}
            className="input"
            value={data.internal_notes}
            onChange={(e) => patch({ internal_notes: e.target.value })}
          />
        </Field>
        <Field label="Expires in (days)">
          <input
            type="number"
            min={1}
            max={90}
            className="input max-w-[100px]"
            value={data.expires_days}
            onChange={(e) => patch({ expires_days: parseInt(e.target.value) || 14 })}
          />
        </Field>
      </Section>

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving..." : data.id ? "Save changes" : "Save draft"}
        </button>
        <Link
          href="/admin/quotes"
          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 text-sm"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  full,
  small,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className={`block ${small ? "text-xs" : "text-sm"} font-medium text-slate-700 mb-1`}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
