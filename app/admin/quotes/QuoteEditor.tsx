"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { createQuote, updateQuote } from "./actions";
import { formatCurrency } from "@/lib/utils";

export interface QuoteProduct {
  id: string;
  name: string;
  slug: string;
  price_per_day: number;
  tax_exempt?: boolean;
}

export interface QuoteCustomer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  address: string | null;
}

export interface LineItem {
  product_id?: string | null;
  name: string;
  description?: string | null;
  quantity: number;
  unit_price_cents: number;
  tax_exempt?: boolean;
}

export type SurfaceType = "" | "dirt" | "grass" | "concrete" | "paver" | "asphalt" | "other";

export interface QuoteFormData {
  id?: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_company: string;
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
  tax_exempt: boolean;
  customer_message: string;
  internal_notes: string;
  expires_days: number;
  surface_type: SurfaceType;
  needs_power_supply: boolean | null;
  damage_protection_offered: boolean;
  damage_protection_cents: number;
  waiver_required: boolean;
}

export interface QuoteEditorSettings {
  damage_protection_enabled: boolean;
  damage_protection_price_cents: number;
  damage_protection_coverage_cents: number;
  waiver_enabled: boolean;
  waiver_title: string;
  tax_enabled: boolean;
  tax_rate_percent: number;
  tax_label: string;
}

const SURFACE_OPTIONS: { value: SurfaceType; label: string }[] = [
  { value: "grass", label: "Grass" },
  { value: "dirt", label: "Dirt" },
  { value: "concrete", label: "Concrete" },
  { value: "paver", label: "Paver" },
  { value: "asphalt", label: "Asphalt" },
  { value: "other", label: "Other" },
];

export function QuoteEditor({
  initial,
  products,
  customers = [],
  defaultMessage = "",
  settings,
}: {
  initial?: QuoteFormData;
  products: QuoteProduct[];
  customers?: QuoteCustomer[];
  defaultMessage?: string;
  settings?: QuoteEditorSettings;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [data, setData] = useState<QuoteFormData>(
    initial || {
      customer_first_name: "",
      customer_last_name: "",
      customer_company: "",
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
      tax_exempt: false,
      customer_message: defaultMessage,
      internal_notes: "",
      expires_days: 14,
      surface_type: "",
      needs_power_supply: null,
      damage_protection_offered: false,
      damage_protection_cents: settings?.damage_protection_price_cents || 2500,
      waiver_required: settings?.waiver_enabled ?? true,
    },
  );

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

  function pickCustomer(id: string) {
    setSelectedCustomerId(id);
    if (!id) return;
    const c = customers.find((x) => x.id === id);
    if (!c) return;
    setData((d) => ({
      ...d,
      customer_first_name: c.first_name || d.customer_first_name,
      customer_last_name: c.last_name || d.customer_last_name,
      customer_email: c.email || d.customer_email,
      customer_phone: c.phone || d.customer_phone,
      customer_address: c.address || d.customer_address,
    }));
    toast.success(`Loaded ${c.first_name} ${c.last_name}'s info`);
  }

  const subtotal = useMemo(
    () => data.line_items.reduce((s, it) => s + it.unit_price_cents * it.quantity, 0),
    [data.line_items],
  );
  // Taxable subtotal excludes line items marked tax_exempt — used by the
  // auto-rate calculation. The total still includes their revenue.
  const taxableSubtotal = useMemo(
    () =>
      data.line_items
        .filter((it) => !it.tax_exempt)
        .reduce((s, it) => s + it.unit_price_cents * it.quantity, 0),
    [data.line_items],
  );
  const total = Math.max(0, subtotal - data.discount_cents + data.tax_cents);

  function patch(p: Partial<QuoteFormData>) {
    setData((d) => ({ ...d, ...p }));
  }

  // Auto-calculate tax when subtotal/discount changes IF the tenant has tax
  // enabled, the customer is NOT exempt, and the admin hasn't explicitly
  // overridden it. We track overrides via taxManuallyEdited: once the admin
  // types in the field, we stop auto-recalculating until they reset.
  const [taxManuallyEdited, setTaxManuallyEdited] = useState(false);
  const taxRate = settings?.tax_rate_percent || 0;
  const taxAutoActive = !!settings?.tax_enabled && taxRate > 0 && !data.tax_exempt && !taxManuallyEdited;
  useEffect(() => {
    if (!taxAutoActive) return;
    // Discounts apply pro-rata to the taxable portion — if the discount is
    // larger than the taxable subtotal, we floor at 0 (no negative tax).
    const taxableShare =
      subtotal > 0 ? (taxableSubtotal / subtotal) * data.discount_cents : 0;
    const taxableBase = Math.max(0, taxableSubtotal - taxableShare);
    const autoTax = Math.round((taxableBase * taxRate) / 100);
    if (autoTax !== data.tax_cents) {
      setData((d) => ({ ...d, tax_cents: autoTax }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, taxableSubtotal, data.discount_cents, taxRate, taxAutoActive]);

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
          tax_exempt: !!p.tax_exempt,
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
        customer_company: data.customer_company || null,
        customer_address: data.customer_address || null,
        event_end_date: data.event_end_date || null,
        start_time: data.start_time || null,
        end_time: data.end_time || null,
        discount_note: data.discount_note || null,
        customer_message: data.customer_message || null,
        internal_notes: data.internal_notes || null,
        surface_type: data.surface_type || null,
        needs_power_supply: data.needs_power_supply,
      };
      const r = data.id
        ? await updateQuote(data.id, payload as any)
        : await createQuote(payload as any);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(data.id ? "Quote updated" : "Quote created");
      const createdQuote = (r as { quote?: { id: string } }).quote;
      if (!data.id && createdQuote?.id) {
        router.push(`/admin/quotes/${createdQuote.id}`);
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
        {customers.length > 0 && (
          <div className="mb-4 pb-4 border-b border-slate-100">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1">
              <UserIcon className="h-3 w-3" /> Pick an existing customer (optional)
            </label>
            <div className="flex gap-2">
              <select
                className="input flex-1"
                value={selectedCustomerId}
                onChange={(e) => pickCustomer(e.target.value)}
              >
                <option value="">— Recurring customer? Pick from {customers.length} on file —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.last_name}, {c.first_name} — {c.email}
                  </option>
                ))}
              </select>
              {selectedCustomerId && (
                <button
                  type="button"
                  onClick={() => setSelectedCustomerId("")}
                  className="text-xs text-slate-500 hover:text-slate-700 underline"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Or skip and fill in manually below for a new customer.
            </p>
          </div>
        )}
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
          <Field label="Company (optional)" full>
            <input
              className="input"
              placeholder="e.g. Acme Events LLC"
              value={data.customer_company}
              onChange={(e) => patch({ customer_company: e.target.value })}
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

      {/* Customer-decided fields (surface, power) are collected on the public
          quote page after the customer clicks Approve — not here.
          Admin only decides whether to OFFER damage protection and REQUIRE waiver. */}
      <Section title="Customer choices on approval">
        <p className="text-xs text-slate-500 mb-3">
          The customer fills setup surface + power source on the public quote page
          when they approve. Here you only decide what to OFFER them.
        </p>
        <div className="space-y-4">
          {/* Damage protection — admin chooses whether to OFFER it on this quote.
              Only shown if tenant has damage protection enabled globally. */}
          {settings?.damage_protection_enabled && (
            <div className="border-t border-slate-100 pt-4">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={data.damage_protection_offered}
                  onChange={(e) => patch({ damage_protection_offered: e.target.checked })}
                />
                <div>
                  <div className="text-sm font-medium text-slate-700">
                    Offer damage protection on this quote
                  </div>
                  <p className="text-xs text-slate-500">
                    The customer will see an opt-in checkbox before approving.
                    Optional, not required — they decide.
                  </p>
                </div>
              </label>
              {data.damage_protection_offered && (
                <div className="mt-2 ml-6 max-w-xs">
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Price for this quote (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="input pl-7"
                      value={(data.damage_protection_cents / 100).toFixed(2)}
                      onChange={(e) =>
                        patch({
                          damage_protection_cents: Math.round(parseFloat(e.target.value || "0") * 100),
                        })
                      }
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Coverage up to{" "}
                    {formatCurrency(settings.damage_protection_coverage_cents)}.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Waiver — admin decides whether the customer must sign before paying.
              Only shown if tenant has the waiver feature enabled globally. */}
          {settings?.waiver_enabled && (
            <div className="border-t border-slate-100 pt-4">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={data.waiver_required}
                  onChange={(e) => patch({ waiver_required: e.target.checked })}
                />
                <div>
                  <div className="text-sm font-medium text-slate-700">
                    Require liability waiver signature before payment
                  </div>
                  <p className="text-xs text-slate-500">
                    Once approved, the customer signs your liability waiver
                    (configured at <code>/admin/waiver</code>) before Stripe checkout.
                    Strongly recommended.
                  </p>
                </div>
              </label>
            </div>
          )}
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
                    <label className="flex items-center gap-1 text-[11px] text-slate-500 mt-1 cursor-pointer w-fit">
                      <input
                        type="checkbox"
                        className="h-3 w-3"
                        checked={!!it.tax_exempt}
                        onChange={(e) => updateLine(i, { tax_exempt: e.target.checked })}
                      />
                      Tax exempt
                      {it.tax_exempt && (
                        <span className="ml-1 bg-emerald-100 text-emerald-800 rounded px-1.5 py-0.5 text-[10px] font-semibold">
                          NO TAX
                        </span>
                      )}
                    </label>
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
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-700">
                {settings?.tax_label || "Tax"} (USD)
              </label>
              <label className="flex items-center gap-1 text-xs cursor-pointer text-slate-600 hover:text-slate-800">
                <input
                  type="checkbox"
                  className="h-3 w-3"
                  checked={data.tax_exempt}
                  onChange={(e) => {
                    setTaxManuallyEdited(false);
                    patch({
                      tax_exempt: e.target.checked,
                      tax_cents: e.target.checked ? 0 : data.tax_cents,
                    });
                  }}
                />
                Tax exempt customer
              </label>
            </div>
            <input
              type="number"
              min={0}
              step="0.01"
              className="input"
              value={(data.tax_cents / 100).toFixed(2)}
              disabled={data.tax_exempt}
              onChange={(e) => {
                setTaxManuallyEdited(true);
                patch({ tax_cents: Math.round(parseFloat(e.target.value || "0") * 100) });
              }}
            />
            {data.tax_exempt ? (
              <p className="text-[11px] text-emerald-700 mt-1">
                ✓ No tax will be applied at approval. Document the exemption certificate in
                internal notes.
              </p>
            ) : settings?.tax_enabled && taxRate > 0 ? (
              taxManuallyEdited ? (
                <p className="text-[11px] text-amber-700 mt-1 flex items-center justify-between">
                  <span>⚠️ Manual override active — won't auto-update on line item changes.</span>
                  <button
                    type="button"
                    onClick={() => setTaxManuallyEdited(false)}
                    className="text-brand-navy hover:underline ml-2"
                  >
                    ↺ Reset to auto ({taxRate}%)
                  </button>
                </p>
              ) : (
                <p className="text-[11px] text-emerald-700 mt-1">
                  ✓ Auto-calculated at {taxRate}% of (subtotal − discount). Edit the field to override.
                </p>
              )
            ) : (
              <p className="text-[11px] text-slate-400 mt-1">
                Tax is disabled at tenant level. Set it at <code>/admin/site</code> to auto-calculate,
                or type a manual amount here.
              </p>
            )}
          </div>
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
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-slate-700">
              Message to customer (shown on the quote)
            </label>
            {defaultMessage && data.customer_message !== defaultMessage && (
              <button
                type="button"
                onClick={() => patch({ customer_message: defaultMessage })}
                className="text-xs text-brand-navy hover:underline"
              >
                ↺ Reset to default template
              </button>
            )}
          </div>
          <textarea
            rows={10}
            className="input font-mono text-xs"
            placeholder="Hi [name], here's the quote for your event. Let me know if you need anything adjusted!"
            value={data.customer_message}
            onChange={(e) => patch({ customer_message: e.target.value })}
          />
          <p className="text-xs text-slate-400 mt-1">
            Pre-filled from your site settings (business name, area, social handle, website). Edit freely.
          </p>
        </div>
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
